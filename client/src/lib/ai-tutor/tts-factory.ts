/**
 * TTS factory — picks Sesame CSM if the server reports it's configured,
 * otherwise falls back to the browser SpeechSynthesis engine.
 *
 * The factory probes `/api/ai-tutor/tts/health` once per app load and caches
 * the result on `window` so subsequent rooms / sessions don't re-probe.
 *
 * Both engines share the same callback shape so callers don't branch.
 */

import { TtsEngine, type TtsCallbacks } from "./tts";
import { SesameTtsEngine } from "./sesame-tts";

export interface TtsLike {
  configure(voice: "Female" | "Male", speed: number, voiceId?: string | null): void;
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
 * Returns a TTS engine that prefers Sesame when available.
 *
 * The wrapper transparently falls back to the browser engine on construction
 * (decided once via the cached probe) — no per-sentence retry logic, which
 * keeps the speak path predictable.
 */
export function createTts(callbacks: TtsCallbacks): TtsLike {
  // If the probe is already cached, honor it synchronously so one-shot
  // utterances (e.g. observing another user's AI broadcast) immediately use
  // Sesame and never trigger a browser TTS flash.
  const cached = typeof window !== "undefined" ? window.__vextornSesameAvailable : null;
  let active: TtsLike = cached === true
    ? new SesameTtsEngine(callbacks)
    : new TtsEngine(callbacks);
  let swapped = cached === true;

  if (!swapped) {
    probeSesame().then(available => {
      if (!available || swapped) return;
      swapped = true;
      // If nothing is currently speaking, swap immediately.
      if (!active.isActive) {
        active = new SesameTtsEngine(callbacks);
        return;
      }
      // Defer swap until the current browser utterance finishes, so we don't
      // cut speech mid-word.
      const interval = setInterval(() => {
        if (!active.isActive) {
          clearInterval(interval);
          active = new SesameTtsEngine(callbacks);
        }
      }, 250);
    });
  }

  return {
    configure: (voice, speed, voiceId) => active.configure(voice, speed, voiceId),
    enqueue: (sentence) => active.enqueue(sentence),
    cancel: () => active.cancel(),
    get isActive() { return active.isActive; },
  };
}

/** Force-refresh the cached probe (e.g. after admin sets the env var) */
export function resetSesameProbe() {
  if (typeof window === "undefined") return;
  window.__vextornSesameAvailable = null;
  window.__vextornSesameProbe = undefined;
}
