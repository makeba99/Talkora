/**
 * EvaTtsEngine — drop-in replacement for TtsEngine that streams generated
 * audio from Vextorn's `/api/ai-tutor/tts` proxy (which fronts ElevenLabs).
 *
 * Same callback contract as the browser TtsEngine, so `useAiTutor` doesn't
 * have to know which one is in use:
 *   onStart / onEnd / onSentenceEnd / onViseme / onVoiceId
 *
 * Visemes are driven by an AnalyserNode running over the decoded audio
 * (RMS amplitude → mouth shape), since ElevenLabs doesn't emit word-boundary
 * events the way SpeechSynthesisUtterance does.
 */

import { TtsEngine, type TtsCallbacks } from "./tts";
import type { Viseme } from "./lipsync";
import { getNextActiveViseme } from "./lipsync";
import type { VoicePersona } from "./types";

interface QueueItem {
  text: string;
  abort: AbortController;
}

export class EvaTtsEngine {
  private queue: QueueItem[] = [];
  private active = false;
  private voice: VoicePersona = "Eva";
  private voiceId: string | null = null;
  private speed = 1.0;
  private language = "en";
  private callbacks: TtsCallbacks;
  // Browser fallback engine — used automatically when ElevenLabs returns any
  // error (rate-limit, invalid key, out of credits, network) so the AI Tutor
  // ALWAYS has a voice. The user gets a one-time toast about Eva being
  // unavailable but the conversation keeps flowing through the system voice.
  private fallback: TtsEngine | null = null;
  private fallbackEngaged = false;

  // Web Audio
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private visemeRaf: number | null = null;
  private currentAbort: AbortController | null = null;

  constructor(callbacks: TtsCallbacks) {
    this.callbacks = callbacks;
  }

  configure(voice: VoicePersona, speed: number, voiceId?: string | null) {
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
    if (this.fallbackEngaged) {
      this.ensureFallback().enqueue(sentence);
      return;
    }
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
    this.fallback?.cancel();
  }

  private ensureFallback(): TtsEngine {
    if (!this.fallback) {
      this.fallback = new TtsEngine(this.callbacks);
    }
    // Use the Female persona on the browser so Afi K still sounds female
    // when ElevenLabs is unreachable.
    this.fallback.configure("Female", this.speed, null);
    return this.fallback;
  }

  private engageFallback(reason: string, queuedItem?: QueueItem) {
    if (this.fallbackEngaged) return;
    this.fallbackEngaged = true;
    if (typeof window !== "undefined" && (window as any).__vextornOnEvaTtsError) {
      (window as any).__vextornOnEvaTtsError(
        `Eva voice unavailable (${reason}) — switched to the system voice for this session.`
      );
    }
    const fb = this.ensureFallback();
    if (queuedItem) fb.enqueue(queuedItem.text);
    // Drain remaining queue through the fallback so the conversation continues
    while (this.queue.length > 0) {
      const next = this.queue.shift()!;
      fb.enqueue(next.text);
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
        // Try to extract the real ElevenLabs error message from the JSON body
        // so the user sees the actual reason (rate limit / wrong voice id /
        // missing permission / etc) instead of a generic "may be invalid".
        const errText = await res.text().catch(() => "");
        let detail = "";
        try {
          const j = JSON.parse(errText);
          detail = j?.error || j?.detail?.message || j?.detail || "";
        } catch {}
        const reason = res.status === 502 || res.status === 504
          ? "ElevenLabs unreachable"
          : res.status === 501
            ? "no API key configured"
            : res.status === 401 || res.status === 403
              ? "API key rejected (invalid or out of credits)"
              : res.status === 429
                ? "rate limited"
                : detail
                  ? `HTTP ${res.status}: ${String(detail).slice(0, 120)}`
                  : `HTTP ${res.status}`;
        // Engage browser-TTS fallback for THIS sentence and all following
        // sentences in the session, so the AI Tutor never goes silent.
        this.engageFallback(reason, item);
        return;
      }

      const audioData = await res.arrayBuffer();
      const ctx = await this.ensureAudioContext();
      // Some browsers mutate the buffer during decode — pass a copy
      const buffer = await ctx.decodeAudioData(audioData.slice(0));

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      // ElevenLabs returns natural pace; we apply a soft playback rate for client-side speed.
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
      // Network or other unexpected error — engage browser-TTS fallback for
      // this sentence and the rest of the session so the AI Tutor never
      // goes silent. The user gets a one-time toast explaining the swap.
      console.warn("[EvaTts] sentence failed, falling back to browser TTS:", err?.message || err);
      this.engageFallback(`network error (${(err?.message || err || "unknown")})`, item);
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
