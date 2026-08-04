/**
 * TTS factory — ALL three personas (Female/Afi K, Male/Lebroski, Eva/Lebroskiu)
 * route through ElevenLabs via EvaTtsEngine. EvaTtsEngine automatically falls
 * back to browser SpeechSynthesis when ElevenLabs is unreachable or unconfigured,
 * so users always hear something — but the target is always ElevenLabs.
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
  // Eva    → ElevenLabs ALWAYS.
  // Female (Afik K) → ElevenLabs ALWAYS (Bella voice set in admin panel);
  //   EvaTtsEngine gracefully falls back to browser TTS when no API key is set.
  // Male (Dude) + voiceId → ElevenLabs; Male + no voiceId → Browser.
  const pickEngine = (): TtsLike => {
    if (currentVoice === "Eva" || currentVoice === "Female" || currentVoiceId) {
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
