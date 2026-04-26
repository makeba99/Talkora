/**
 * TTS factory — picks the right engine based on the *current voice persona*:
 *   - "Eva"          → Sesame CSM (the new Modal-hosted AI voice)
 *   - "Female"/"Male" → Browser SpeechSynthesis (the original Afi K / Dude voices)
 *
 * If Eva is selected but Sesame isn't reachable, we transparently fall back to
 * the browser engine so the AI never goes silent. The factory probes the
 * server's /api/ai-tutor/tts/health once per app load and caches it on
 * `window`.
 */

import { TtsEngine, type TtsCallbacks } from "./tts";
import { SesameTtsEngine } from "./sesame-tts";
import type { VoicePersona } from "./types";

export interface TtsLike {
  configure(voice: VoicePersona, speed: number, voiceId?: string | null): void;
  enqueue(sentence: string): void;
  cancel(): void;
  readonly isActive: boolean;
}

declare global {
  interface Window {
    __vextornSesameAvailable?: boolean | null;
    __vextornSesameProbe?: Promise<boolean>;
  }
}

async function probeSesame(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.__vextornSesameAvailable === true) return true;
  if (window.__vextornSesameAvailable === false) return false;
  if (window.__vextornSesameProbe) return window.__vextornSesameProbe;

  window.__vextornSesameProbe = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch("/api/ai-tutor/tts/health", {
        credentials: "include",
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        window.__vextornSesameAvailable = false;
        return false;
      }
      const json = await res.json().catch(() => ({}));
      const available = !!json?.available;
      window.__vextornSesameAvailable = available;
      return available;
    } catch {
      window.__vextornSesameAvailable = false;
      return false;
    }
  })();

  return window.__vextornSesameProbe;
}

/**
 * Returns a routing TTS engine that picks Browser vs Sesame per-call based on
 * the configured voice persona. The wrapper holds both underlying engines and
 * forwards enqueue()/cancel() to whichever one matches the current voice.
 *
 * The "Eva" voice is intentionally always routed through Sesame; selecting
 * Female or Male keeps the existing browser voice (so the original AI Tutor
 * personas — Afi K / Dude — sound exactly as before).
 */
export function createTts(callbacks: TtsCallbacks): TtsLike {
  const browser = new TtsEngine(callbacks);
  let sesame: SesameTtsEngine | null = null;
  let sesameReady = typeof window !== "undefined" && window.__vextornSesameAvailable === true;
  let currentVoice: VoicePersona = "Female";
  let currentSpeed = 1.0;
  let currentVoiceId: string | null = null;

  // Kick off the probe in the background so by the time the user picks Eva
  // we already know whether Sesame is up. This does NOT block the UI.
  if (!sesameReady && typeof window !== "undefined" && window.__vextornSesameAvailable !== false) {
    probeSesame().then(ok => { sesameReady = ok; }).catch(() => {});
  }

  const ensureSesame = (): SesameTtsEngine => {
    if (!sesame) sesame = new SesameTtsEngine(callbacks);
    return sesame;
  };

  // Pick the engine that *should* play given the current voice + Sesame health.
  const pickEngine = (): TtsLike => {
    if (currentVoice === "Eva" && sesameReady) {
      const e = ensureSesame();
      e.configure(currentVoice, currentSpeed, currentVoiceId);
      return e;
    }
    browser.configure(currentVoice, currentSpeed, currentVoiceId);
    return browser;
  };

  return {
    configure: (voice, speed, voiceId) => {
      currentVoice = voice;
      currentSpeed = speed;
      currentVoiceId = voiceId ?? null;
      // Push config to both engines so a mid-session voice swap is instant.
      browser.configure(voice, speed, voiceId);
      if (sesame) sesame.configure(voice, speed, voiceId);
    },
    enqueue: (sentence) => {
      pickEngine().enqueue(sentence);
    },
    cancel: () => {
      browser.cancel();
      if (sesame) sesame.cancel();
    },
    get isActive() {
      return browser.isActive || (sesame?.isActive ?? false);
    },
  };
}

/** Force-refresh the cached probe (e.g. after admin sets the env var) */
export function resetSesameProbe() {
  if (typeof window === "undefined") return;
  window.__vextornSesameAvailable = null;
  window.__vextornSesameProbe = undefined;
}
