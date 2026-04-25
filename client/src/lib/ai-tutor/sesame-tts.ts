/**
 * SesameTtsEngine — drop-in replacement for TtsEngine that streams generated
 * audio from Vextorn's `/api/ai-tutor/tts` proxy (which fronts a self-hosted
 * Sesame CSM inference server).
 *
 * Same callback contract as the browser TtsEngine, so `useAiTutor` doesn't
 * have to know which one is in use:
 *   onStart / onEnd / onSentenceEnd / onViseme / onVoiceId
 *
 * Visemes are driven by an AnalyserNode running over the decoded audio
 * (RMS amplitude → mouth shape), since CSM doesn't emit word-boundary
 * events the way SpeechSynthesisUtterance does.
 */

import type { TtsCallbacks } from "./tts";
import type { Viseme } from "./lipsync";
import { getNextActiveViseme } from "./lipsync";

interface QueueItem {
  text: string;
  abort: AbortController;
}

export class SesameTtsEngine {
  private queue: QueueItem[] = [];
  private active = false;
  private voice: "Female" | "Male" = "Female";
  private voiceId: string | null = null;
  private speed = 1.0;
  private language = "en";
  private callbacks: TtsCallbacks;

  // Web Audio
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private visemeRaf: number | null = null;
  private currentAbort: AbortController | null = null;

  constructor(callbacks: TtsCallbacks) {
    this.callbacks = callbacks;
  }

  configure(voice: "Female" | "Male", speed: number, voiceId?: string | null) {
    this.voice = voice;
    this.speed = speed;
    this.voiceId = voiceId || null;
  }

  setLanguage(lang: string) {
    this.language = lang;
  }

  enqueue(sentence: string) {
    const text = (sentence || "").trim();
    if (!text) return;
    this.queue.push({ text, abort: new AbortController() });
    if (!this.active) this.playNext();
  }

  cancel() {
    // Abort everything in flight + clear queue
    this.queue.forEach(q => q.abort.abort());
    this.queue = [];
    this.currentAbort?.abort();
    this.currentAbort = null;

    if (this.currentSource) {
      try { this.currentSource.onended = null; this.currentSource.stop(); } catch {}
      this.currentSource = null;
    }
    if (this.visemeRaf != null) {
      cancelAnimationFrame(this.visemeRaf);
      this.visemeRaf = null;
    }
    this.active = false;
    this.callbacks.onViseme?.("rest");
  }

  get isActive() { return this.active; }

  private async ensureAudioContext(): Promise<AudioContext> {
    if (!this.audioCtx) {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      this.audioCtx = new Ctor();
    }
    if (this.audioCtx.state === "suspended") {
      try { await this.audioCtx.resume(); } catch {}
    }
    return this.audioCtx;
  }

  private async playNext(): Promise<void> {
    const item = this.queue.shift();
    if (!item) {
      this.active = false;
      this.callbacks.onViseme?.("rest");
      this.callbacks.onEnd();
      return;
    }

    this.active = true;
    this.currentAbort = item.abort;

    if (!this.queue.length) this.callbacks.onStart();
    else if (!this.currentSource) this.callbacks.onStart();

    try {
      const res = await fetch("/api/ai-tutor/tts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Accept": "audio/wav, audio/mpeg" },
        body: JSON.stringify({
          text: item.text,
          voice: this.voice,
          speed: this.speed,
          language: this.language,
          voiceId: this.voiceId,
        }),
        signal: item.abort.signal,
      });

      if (!res.ok) {
        // Surface the error so the caller can fall back to the browser engine
        const errText = await res.text().catch(() => "");
        throw new Error(`tts ${res.status}: ${errText.slice(0, 120)}`);
      }

      const audioData = await res.arrayBuffer();
      const ctx = await this.ensureAudioContext();
      // Some browsers mutate the buffer during decode — pass a copy
      const buffer = await ctx.decodeAudioData(audioData.slice(0));

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      // CSM rarely needs >1.0; we apply a soft playback rate for client-side speed.
      source.playbackRate.value = Math.max(0.5, Math.min(1.6, this.speed));

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;

      source.connect(analyser);
      analyser.connect(ctx.destination);

      this.currentSource = source;
      this.analyser = analyser;

      const onDone = () => {
        if (this.currentSource !== source) return; // already replaced
        this.currentSource = null;
        this.analyser = null;
        if (this.visemeRaf != null) {
          cancelAnimationFrame(this.visemeRaf);
          this.visemeRaf = null;
        }
        this.callbacks.onViseme?.("rest");
        this.callbacks.onSentenceEnd();
        // Drain queue
        if (this.queue.length > 0) {
          this.playNext();
        } else {
          this.active = false;
          this.callbacks.onEnd();
        }
      };

      source.onended = onDone;
      source.start();

      // Amplitude-driven viseme loop — runs at rAF, throttled to ~14fps for
      // the SVG mouth so it feels like natural speech rather than buzzing.
      this.startVisemeLoop(analyser);
    } catch (err: any) {
      if (item.abort.signal.aborted || err?.name === "AbortError") {
        // Cancelled — playNext may already have been called by cancel(); just stop here.
        if (!this.queue.length) {
          this.active = false;
          this.callbacks.onViseme?.("rest");
          this.callbacks.onEnd();
        }
        return;
      }
      // Bubble error so the wrapping factory can fall back to browser TTS.
      console.warn("[SesameTts] sentence failed, skipping:", err?.message || err);
      this.callbacks.onSentenceEnd();
      // Try the next sentence; if none, end.
      if (this.queue.length > 0) {
        this.playNext();
      } else {
        this.active = false;
        this.callbacks.onViseme?.("rest");
        this.callbacks.onEnd();
        // Re-throw via callback? No — emit a soft signal by returning quietly.
        // The factory probes /health up front so most cases never reach here.
        throw err;
      }
    }
  }

  private startVisemeLoop(analyser: AnalyserNode) {
    if (this.visemeRaf != null) cancelAnimationFrame(this.visemeRaf);
    const data = new Uint8Array(analyser.fftSize);
    let lastEmit = 0;
    let lastShape: Viseme | null = null;

    const tick = (ts: number) => {
      if (!this.analyser || this.analyser !== analyser) return;
      analyser.getByteTimeDomainData(data);

      // RMS over the time-domain buffer
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);

      // Throttle to ~14fps so the SVG mouth reads naturally
      if (ts - lastEmit > 70) {
        lastEmit = ts;
        let next: Viseme;
        if (rms < 0.04) next = "rest";
        else if (rms < 0.10) next = "mbp";
        else if (rms < 0.18) next = getNextActiveViseme();
        else next = "ah";

        if (next !== lastShape) {
          lastShape = next;
          this.callbacks.onViseme?.(next);
        }
      }

      this.visemeRaf = requestAnimationFrame(tick);
    };
    this.visemeRaf = requestAnimationFrame(tick);
  }
}
