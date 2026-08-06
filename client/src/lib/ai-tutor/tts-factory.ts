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
  // The server is authoritative. Until its config arrives, route through the
  // server so it can make the same decision as the admin panel.
  let currentProvider = "unknown";

  const ensureEva = (): EvaTtsEngine => {
    if (!eva) {
      eva = new EvaTtsEngine(callbacks);
    }
    return eva;
  };

  // Pick the engine that *should* play given the current voice.
  // All three personas → ElevenLabs ALWAYS via EvaTtsEngine.
  // EvaTtsEngine gracefully falls back to browser SpeechSynthesis when no
  // ElevenLabs API key is configured, so users always hear something.
  const pickEngine = (): TtsLike => {
    if (currentProvider === "browser") {
      browser.configure(currentVoice, currentSpeed, null);
      return browser;
    }
    const e = ensureEva();
    e.configure(currentVoice, currentSpeed, currentVoiceId, currentProvider);
    return e;
  };

  return {
    configure: (voice, speed, voiceId, provider) => {
      const voiceChanged = voice !== currentVoice;
      const providerChanged = provider !== undefined && provider !== currentProvider;
      currentVoice = voice;
      currentSpeed = speed;
      currentVoiceId = voiceId ?? null;
      if (provider !== undefined) currentProvider = provider;
      // Cancel the *other* engine so a mid-session swap doesn't leave audio
      // playing through the previous voice.
      if (voiceChanged || providerChanged) {
        if (currentProvider === "browser") {
          if (eva) eva.cancel();
        } else {
          browser.cancel();
        }
      }
      browser.configure(voice, speed, voiceId);
      if (eva) eva.configure(voice, speed, voiceId, currentProvider);
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
