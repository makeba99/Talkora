/**
 * TTS factory — Maya, Miles, and Eva all speak through the server
 * (`/api/ai-tutor/tts` → Sesame CSM-1B / Edge / OpenAI).
 * Device SpeechSynthesis is never selected for in-room tutors.
 */

import { EvaTtsEngine, primeEvaAudio, type TtsCallbacks } from "./eva-tts";
import type { VoicePersona } from "./types";

export interface TtsLike {
  configure(voice: VoicePersona, speed: number, voiceId?: string | null, provider?: string): void;
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

function cloudProvider(provider?: string): string {
  if (!provider || provider === "unknown" || provider === "browser") return "sesame";
  return provider;
}

/**
 * Rooms always use EvaTtsEngine (HTMLAudio of the server wav).
 * Stale admin "browser" is treated as Sesame so Maya never uses the
 * robotic device voice.
 */
export function createTts(callbacks: TtsCallbacks): TtsLike {
  const eva = new EvaTtsEngine(callbacks);
  let currentVoice: VoicePersona = "Female";
  let currentSpeed = 1.0;
  let currentVoiceId: string | null = null;
  let currentProvider = "sesame";

  return {
    configure: (voice, speed, voiceId, provider) => {
      currentVoice = voice;
      currentSpeed = speed;
      currentVoiceId = voiceId ?? null;
      if (provider !== undefined) currentProvider = cloudProvider(provider);
      eva.configure(voice, speed, voiceId, currentProvider);
    },
    enqueue: (sentence) => {
      primeEvaAudio();
      eva.configure(currentVoice, currentSpeed, currentVoiceId, currentProvider);
      eva.enqueue(sentence);
    },
    cancel: () => {
      eva.cancel();
    },
    get isActive() {
      return eva.isActive;
    },
  };
}

/** Surface an Eva voice failure to the UI (toast). The engine calls this directly. */
export function reportEvaUnreachable(msg: string) {
  if (typeof window !== "undefined" && window.__vextornOnEvaTtsError) {
    window.__vextornOnEvaTtsError(msg);
  }
}
