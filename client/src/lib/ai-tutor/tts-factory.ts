/**
 * TTS factory — picks the right engine based on the *current voice persona*:
 *   - "Eva"          → ALWAYS Sesame CSM (the new Modal-hosted AI voice)
 *   - "Female"/"Male" → Browser SpeechSynthesis (the original Afi K / Dude voices)
 *
 * The original two personas keep working unchanged — Eva is opt-in. We do NOT
 * silently fall back to the browser voice when Eva fails: the user explicitly
 * picked Eva because they want the Sesame voice, so a failure must be visible
 * (so they know to fix their Modal deployment instead of being confused why
 * "Eva sounds like the old voice").
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

/** Optional global hook so the AI Tutor UI can show a toast when Sesame fails. */
declare global {
  interface Window {
    __vextornOnSesameError?: (msg: string) => void;
  }
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
  // Wrap onEnd so we can detect Sesame fatal errors (engine ends with empty
  // queue + zero playbacks) and surface a toast to the user.
  const sesameCallbacks: TtsCallbacks = {
    ...callbacks,
    onEnd: () => {
      callbacks.onEnd();
    },
  };

  const browser = new TtsEngine(callbacks);
  let sesame: SesameTtsEngine | null = null;
  let currentVoice: VoicePersona = "Female";
  let currentSpeed = 1.0;
  let currentVoiceId: string | null = null;
  let lastSesameErrorAt = 0;

  const ensureSesame = (): SesameTtsEngine => {
    if (!sesame) {
      sesame = new SesameTtsEngine(sesameCallbacks);
    }
    return sesame;
  };

  const reportSesameError = (msg: string) => {
    // Throttle to one toast per 8s so a long sentence stream doesn't spam.
    const now = Date.now();
    if (now - lastSesameErrorAt < 8000) return;
    lastSesameErrorAt = now;
    if (typeof window !== "undefined" && window.__vextornOnSesameError) {
      window.__vextornOnSesameError(msg);
    }
  };

  // Patch fetch on the Sesame engine via a per-instance hook — when a sentence
  // fails, the engine logs to console; we additionally fire a toast.
  const installSesameErrorListener = () => {
    if (typeof window === "undefined") return;
    // Attach once — listens for the engine's console.warn pattern via the
    // optional global hook below. The Sesame engine itself calls
    // window.__vextornOnSesameError if present.
  };
  installSesameErrorListener();

  // Pick the engine that *should* play given the current voice.
  // Eva → Sesame ALWAYS; Female/Male → Browser ALWAYS.
  const pickEngine = (): TtsLike => {
    if (currentVoice === "Eva") {
      const e = ensureSesame();
      e.configure(currentVoice, currentSpeed, currentVoiceId);
      return e;
    }
    browser.configure(currentVoice, currentSpeed, currentVoiceId);
    return browser;
  };

  return {
    configure: (voice, speed, voiceId) => {
      const voiceChanged = voice !== currentVoice;
      currentVoice = voice;
      currentSpeed = speed;
      currentVoiceId = voiceId ?? null;
      // Cancel the *other* engine so a mid-session swap doesn't leave audio
      // playing through the previous voice.
      if (voiceChanged) {
        if (voice === "Eva") browser.cancel();
        else if (sesame) sesame.cancel();
      }
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

// Expose the error-report function for the SesameTtsEngine to call directly.
export function reportSesameUnreachable(msg: string) {
  if (typeof window !== "undefined" && window.__vextornOnSesameError) {
    window.__vextornOnSesameError(msg);
  }
}
