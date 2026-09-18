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
  // Browser fallback is always allowed when a cloud provider fails so the
  // tutor never goes silent. Free forever; quality depends on the device.
  private allowBrowserFallback = true;

  // Web Audio
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private htmlAudio: HTMLAudioElement | null = null;
  private analyser: AnalyserNode | null = null;
  private visemeRaf: number | null = null;
  private currentAbort: AbortController | null = null;

  constructor(callbacks: TtsCallbacks) {
    this.callbacks = callbacks;
  }

  configure(voice: VoicePersona, speed: number, voiceId?: string | null, provider = "unknown") {
    this.voice = voice;
    this.speed = speed;
    this.voiceId = voiceId || null;
    // Always keep a free browser fallback available for one-off failures.
    this.allowBrowserFallback = true;
    // Re-enable cloud TTS whenever admin/provider config refreshes — do NOT
    // leave the session stuck on robotic browser voice after a single glitch.
    if (provider === "browser" || provider === "edge" || provider === "openai" || provider === "elevenlabs" || provider === "sesame") {
      this.fallbackEngaged = false;
    }
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
    if (this.htmlAudio) {
      try {
        this.htmlAudio.onended = null;
        this.htmlAudio.onerror = null;
        this.htmlAudio.pause();
        this.htmlAudio.src = "";
      } catch {}
      this.htmlAudio = null;
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
    // Match gender so Maya stays female and Miles stays male on fallback.
    this.fallback.configure(this.voice === "Male" ? "Male" : "Female", this.speed, null);
    return this.fallback;
  }

  private engageFallback(reason: string, queuedItem?: QueueItem) {
    if (!this.allowBrowserFallback) {
      this.queue = [];
      this.currentAbort = null;
      this.active = false;
      this.callbacks.onViseme?.("rest");
      this.callbacks.onEnd();
      if (typeof window !== "undefined" && (window as any).__vextornOnEvaTtsError) {
        (window as any).__vextornOnEvaTtsError(
          `Configured AI voice unavailable (${reason}).`,
        );
      }
      return;
    }
    // Per-utterance browser fallback only — next sentences retry cloud TTS
    // so a single Edge/OpenAI blip does not lock Maya into a robotic male voice.
    if (typeof window !== "undefined" && (window as any).__vextornOnEvaTtsError && !this.fallbackEngaged) {
      (window as any).__vextornOnEvaTtsError(
        `Cloud voice blip (${reason}) — using on-device voice for this line.`,
      );
    }
    const fb = this.ensureFallback();
    if (queuedItem) fb.enqueue(queuedItem.text);
    // Drain only currently queued items through browser once, then resume cloud.
    while (this.queue.length > 0) {
      const next = this.queue.shift()!;
      fb.enqueue(next.text);
    }
    this.active = false;
    this.callbacks.onViseme?.("rest");
    // Do NOT set fallbackEngaged sticky — cloud path stays preferred.
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

    // ── Fire onStart immediately when the fetch begins ────────────────────
    // Previously onStart fired only after audio data was decoded and ready
    // to play — adding 200-800ms of perceived silence after the user speaks.
    // Firing it here means the UI (face animation, speaking indicator) lights
    // up as soon as the AI starts fetching the voice, not when audio plays.
    // This makes the response feel instant even if ElevenLabs takes a moment.
    if (!this.currentSource && !this.htmlAudio) this.callbacks.onStart();

    try {
      let res: Response | null = null;
      let lastReason = "tts-failed";
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("/api/ai-tutor/tts", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", "Accept": "audio/wav, audio/mpeg, audio/*" },
          body: JSON.stringify({
            text: item.text,
            voice: this.voice,
            speed: this.speed,
            language: this.language,
            voiceId: this.voiceId,
          }),
          signal: item.abort.signal,
        });
        if (res.ok) break;
        const errText = await res.text().catch(() => "");
        let detail = "";
        try {
          const j = JSON.parse(errText);
          detail = j?.error || j?.detail?.message || j?.detail || j?.message || "";
        } catch {}
        lastReason = res.status === 429
          ? "rate limited"
          : res.status === 502 || res.status === 504
            ? "voice provider unreachable"
            : detail
              ? `HTTP ${res.status}: ${String(detail).slice(0, 120)}`
              : `HTTP ${res.status}`;
        if (item.abort.signal.aborted) return;
        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
          continue;
        }
        break;
      }

      if (!res || !res.ok) {
        this.engageFallback(lastReason, item);
        return;
      }

      const audioData = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "audio/wav";
      if (!audioData || audioData.byteLength < 64) {
        this.engageFallback("empty audio", item);
        return;
      }
      await this.playSesameBytes(audioData, contentType, item.abort.signal);
      this.finishSentence();
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

  private finishSentence() {
    this.callbacks.onViseme?.("rest");
    this.callbacks.onSentenceEnd();
    if (this.queue.length > 0) {
      this.playNext();
    } else {
      this.active = false;
      this.callbacks.onEnd();
    }
  }

  /** Play CSM/Edge/OpenAI bytes the same way Admin Test does (HTML audio). */
  private async playSesameBytes(audioData: ArrayBuffer, contentType: string, signal: AbortSignal): Promise<void> {
    const type = /audio\//i.test(contentType) ? contentType.split(";")[0] : "audio/wav";
    const blob = new Blob([audioData], { type });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.playbackRate = Math.max(0.5, Math.min(1.6, this.speed));
    this.htmlAudio = audio;

    try {
      const ctx = await this.ensureAudioContext();
      const node = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      node.connect(analyser);
      analyser.connect(ctx.destination);
      this.analyser = analyser;
      this.startVisemeLoop(analyser);
    } catch {
      // Playing through the element still yields Sesame audio even if Web Audio visemes fail.
    }

    await new Promise<void>((resolve, reject) => {
      const done = () => {
        audio.onended = null;
        audio.onerror = null;
        resolve();
      };
      audio.onended = done;
      audio.onerror = () => reject(new Error("html-audio-error"));
      if (signal.aborted) {
        done();
        return;
      }
      signal.addEventListener("abort", () => {
        try { audio.pause(); } catch {}
        done();
      }, { once: true });
      audio.play().catch(reject);
    });

    URL.revokeObjectURL(url);
    if (this.htmlAudio === audio) this.htmlAudio = null;
    this.analyser = null;
    if (this.visemeRaf != null) {
      cancelAnimationFrame(this.visemeRaf);
      this.visemeRaf = null;
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
