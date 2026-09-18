/**
 * EvaTtsEngine — drop-in replacement for TtsEngine that streams generated
 * audio from Vextorn's `/api/ai-tutor/tts` (Sesame CSM / Edge / OpenAI).
 *
 * Same callback contract as the browser TtsEngine, so `useAiTutor` doesn't
 * have to know which one is in use:
 *   onStart / onEnd / onSentenceEnd / onViseme / onVoiceId
 *
 * Playback uses a primed HTMLAudioElement (same as Admin Test Sesame) so
 * later tutor lines are not blocked by autoplay and never fall back to the
 * robotic device SpeechSynthesis voice while Sesame is configured.
 */

import { TtsEngine, type TtsCallbacks } from "./tts";
export type { TtsCallbacks };
import type { Viseme } from "./lipsync";
import { getNextActiveViseme } from "./lipsync";
import type { VoicePersona } from "./types";

/** 0.05s silent WAV — unlocks HTMLAudio during the persona-click gesture. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

let primedAudio: HTMLAudioElement | null = null;

function ensurePrimedAudio(): HTMLAudioElement {
  if (primedAudio) return primedAudio;
  const audio = new Audio();
  audio.preload = "auto";
  audio.setAttribute("playsinline", "true");
  (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  primedAudio = audio;
  return audio;
}

/** Call from a user gesture (Start Maya) so later Sesame wavs can play(). */
export function primeEvaAudio(): void {
  if (typeof window === "undefined") return;
  const audio = ensurePrimedAudio();
  try {
    audio.src = SILENT_WAV;
    audio.volume = 0.01;
    void audio.play().then(() => {
      audio.pause();
      audio.volume = 1;
    }).catch(() => {
      audio.volume = 1;
    });
  } catch {
    audio.volume = 1;
  }
  const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (Ctor) {
    try {
      const ctx = new Ctor();
      void ctx.resume();
    } catch {}
  }
}

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
  // Device SpeechSynthesis only when admin explicitly chose "browser".
  // Sesame rooms must never use it — that is the robotic voice.
  private fallback: TtsEngine | null = null;
  private fallbackEngaged = false;
  private allowBrowserFallback = false;

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

  configure(voice: VoicePersona, speed: number, voiceId?: string | null, provider = "sesame") {
    this.voice = voice;
    this.speed = speed;
    this.voiceId = voiceId || null;
    this.allowBrowserFallback = provider === "browser";
    if (provider !== "browser") {
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
      console.warn("[EvaTts] sentence failed:", err?.message || err);
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

  /** Play CSM bytes with HTMLAudioElement — same path as Admin Test Sesame Voice. */
  private async playSesameBytes(audioData: ArrayBuffer, contentType: string, signal: AbortSignal): Promise<void> {
    const type = /audio\//i.test(contentType) && !/json/i.test(contentType)
      ? contentType.split(";")[0]
      : "audio/wav";
    const blob = new Blob([audioData], { type });
    const url = URL.createObjectURL(blob);
    const audio = ensurePrimedAudio();
    try {
      audio.pause();
    } catch {}
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    audio.volume = 1;
    audio.src = url;
    audio.playbackRate = Math.max(0.85, Math.min(1.15, this.speed));
    this.htmlAudio = audio;
    this.startFakeVisemeLoop();

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let started = false;
        const done = () => {
          if (settled) return;
          settled = true;
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
        const start = () => {
          if (settled || started) return;
          started = true;
          const p = audio.play();
          if (p && typeof p.catch === "function") {
            p.catch((err: unknown) => {
              // Retry once after resume — never SpeechSynthesis.
              const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
              if (Ctor) {
                try {
                  const ctx = new Ctor();
                  void ctx.resume().then(() => audio.play().catch(() => reject(err)));
                  return;
                } catch {}
              }
              reject(err);
            });
          }
        };
        if (audio.readyState >= 2) start();
        else {
          audio.oncanplaythrough = () => start();
          audio.onloadeddata = () => start();
          window.setTimeout(start, 250);
        }
      });
    } finally {
      URL.revokeObjectURL(url);
      if (this.htmlAudio === audio) this.htmlAudio = null;
      if (this.visemeRaf != null) {
        cancelAnimationFrame(this.visemeRaf);
        this.visemeRaf = null;
      }
    }
  }

  private startFakeVisemeLoop() {
    if (this.visemeRaf != null) cancelAnimationFrame(this.visemeRaf);
    let lastEmit = 0;
    const tick = (ts: number) => {
      if (!this.htmlAudio || this.htmlAudio.paused) return;
      if (ts - lastEmit > 90) {
        lastEmit = ts;
        this.callbacks.onViseme?.(this.htmlAudio.paused ? "rest" : getNextActiveViseme());
      }
      this.visemeRaf = requestAnimationFrame(tick);
    };
    this.visemeRaf = requestAnimationFrame(tick);
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
