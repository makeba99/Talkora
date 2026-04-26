/**
 * TTS factory — picks the right engine based on the *current voice persona*:
 *   - "Eva"          → ALWAYS ElevenLabs (the new hosted AI voice)
 *   - "Female"/"Male" → Browser SpeechSynthesis (the original Afi K / Dude voices)
 *
 * The original two personas keep working unchanged — Eva is opt-in. We do NOT
 * silently fall back to the browser voice when Eva fails: the user explicitly
 * picked Eva because they want the ElevenLabs voice, so a failure must be
 * visible (so they know to fix their API key instead of being confused why
 * "Eva sounds like the old voice").
 */

import { TtsEngine, type TtsCallbacks } from "./tts";
import { EvaTtsEngine } from "./eva-tts";
import type { VoicePersona } from "./types";

export interface TtsLike {
  configure(voice: VoicePersona, speed: number, voiceId?: string | null): void;
  enqueue(sentence: string): void;
  cancel(): void;
  readonly isActive: boolean;
}

/** Optional global hook so the AI Tutor UI can show a toast when Eva fails. */
declare global {
  interface Window {
    __vextornOnEvaTtsError?: (msg: string) => void;
  }
}

/**
 * Returns a routing TTS engine that picks Browser vs Eva (ElevenLabs) per-call
 * based on the configured voice persona. The wrapper holds both underlying
 * engines and forwards enqueue()/cancel() to whichever one matches the current
 * voice.
 *
 * The "Eva" voice is intentionally always routed through ElevenLabs; selecting
 * Female or Male keeps the existing browser voice (so the original AI Tutor
 * personas — Afi K / Dude — sound exactly as before).
 */
export function createTts(callbacks: TtsCallbacks): TtsLike {
  const browser = new TtsEngine(callbacks);
  let eva: EvaTtsEngine | null = null;
  let currentVoice: VoicePersona = "Female";
  let currentSpeed = 1.0;
  let currentVoiceId: string | null = null;

  const ensureEva = (): EvaTtsEngine => {
    if (!eva) {
      eva = new EvaTtsEngine(callbacks);
    }
    return eva;
  };

  // Pick the engine that *should* play given the current voice.
  // Eva → ElevenLabs ALWAYS; Female/Male → Browser ALWAYS.
  const pickEngine = (): TtsLike => {
    if (currentVoice === "Eva") {
      const e = ensureEva();
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
        else if (eva) eva.cancel();
      }
      browser.configure(voice, speed, voiceId);
      if (eva) eva.configure(voice, speed, voiceId);
    },
    enqueue: (sentence) => {
      pickEngine().enqueue(sentence);
    },
    cancel: () => {
      browser.cancel();
      if (eva) eva.cancel();
    },
    get isActive() {
      return browser.isActive || (eva?.isActive ?? false);
    },
  };
}

/** Surface an Eva voice failure to the UI (toast). The engine calls this directly. */
export function reportEvaUnreachable(msg: string) {
  if (typeof window !== "undefined" && window.__vextornOnEvaTtsError) {
    window.__vextornOnEvaTtsError(msg);
  }
}
