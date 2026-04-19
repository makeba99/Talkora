/**
 * TTS Module — streams sentences to the browser's speechSynthesis engine.
 * Starts speaking as soon as the first sentence arrives; no full-response wait.
 * Includes:
 *   - Watchdog timer for Chrome's silent onend bug
 *   - Viseme callbacks via SpeechSynthesisUtterance.onboundary for realistic lipsync
 *   - Fallback random animation when boundary events are unsupported
 */

import { getWordViseme, getNextActiveViseme, type Viseme } from "./lipsync";

export type TtsCallbacks = {
  onStart: () => void;
  onEnd: () => void;
  onSentenceEnd: () => void;
  onViseme?: (shape: Viseme) => void;
  onVoiceId?: (voiceId: string) => void;
};

export class TtsEngine {
  private queue: string[] = [];
  private active = false;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private visemeTimer: ReturnType<typeof setInterval> | null = null;
  private boundarySupported = true;
  private voice: "Female" | "Male" = "Female";
  private voiceId: string | null = null;
  private speed = 0.7;
  private callbacks: TtsCallbacks;

  constructor(callbacks: TtsCallbacks) {
    this.callbacks = callbacks;
  }

  configure(voice: "Female" | "Male", speed: number, voiceId?: string | null) {
    this.voice = voice;
    this.speed = speed;
    this.voiceId = voiceId || null;
  }

  /** Add a sentence fragment; auto-starts playback if idle */
  enqueue(sentence: string) {
    if (!sentence.trim()) return;
    this.queue.push(sentence.trim());
    if (!this.active) this.playNext();
  }

  /** Immediately stop all TTS and clear the queue */
  cancel() {
    this.queue = [];
    this.active = false;
    this._clearTimers();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    // Return to rest position immediately
    this.callbacks.onViseme?.("rest");
  }

  get isActive() { return this.active; }

  private _clearTimers() {
    if (this.watchdog) { clearInterval(this.watchdog); this.watchdog = null; }
    if (this.visemeTimer) { clearInterval(this.visemeTimer); this.visemeTimer = null; }
  }

  private playNext() {
    if (this.queue.length === 0) {
      this.active = false;
      this.callbacks.onViseme?.("rest");
      this.callbacks.onEnd();
      return;
    }

    const sentence = this.queue.shift()!;
    if (!sentence.trim()) { this.playNext(); return; }

    this.active = true;
    this.callbacks.onStart();

    const utter = new SpeechSynthesisUtterance(sentence);
    utter.rate = Math.max(0.5, Math.min(2, this.speed));
    utter.pitch = this.voice === "Female" ? 1.15 : 0.85;
    utter.lang = "en-US";

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const savedVoice = this.voiceId
        ? voices.find(v => v.voiceURI === this.voiceId || v.name === this.voiceId)
        : undefined;
      const chosen =
        savedVoice ??
        (this.voice === "Female"
          ? (voices.find(v => /samantha|zira|google us english/i.test(v.name) && v.lang.startsWith("en")) ??
            voices.find(v => v.lang.startsWith("en")))
          : (voices.find(v => /daniel|david|alex|mark/i.test(v.name) && v.lang.startsWith("en")) ??
            voices.find(v => v.lang.startsWith("en"))));
      if (chosen) {
        utter.voice = chosen;
        const stableVoiceId = chosen.voiceURI || chosen.name;
        if (stableVoiceId && stableVoiceId !== this.voiceId) {
          this.voiceId = stableVoiceId;
          this.callbacks.onVoiceId?.(stableVoiceId);
        }
      }
    }

    // ── Word-boundary lipsync ───────────────────────────────────────────────
    let boundaryFired = false;
    utter.onboundary = (e: SpeechSynthesisEvent) => {
      if (e.name !== "word") return;
      boundaryFired = true;
      const word = sentence.slice(e.charIndex, e.charIndex + (e.charLength || 6));
      const viseme = getWordViseme(word);
      this.callbacks.onViseme?.(viseme);
    };

    const onDone = () => {
      this._clearTimers();
      this.callbacks.onViseme?.("rest");
      this.callbacks.onSentenceEnd();
      this.playNext();
    };

    utter.onend = onDone;
    utter.onerror = onDone;

    // ── Watchdog: Chrome silently drops onend for short sentences ──────────
    const expectedMs = Math.max(1500, (sentence.length / 14) * 1000 / Math.max(0.5, utter.rate));
    let elapsed = 0;
    this.watchdog = setInterval(() => {
      elapsed += 300;
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();

      // Start fallback animation if boundary events didn't fire within 600ms
      if (!boundaryFired && elapsed >= 600 && !this.visemeTimer) {
        this.boundarySupported = false;
        this.visemeTimer = setInterval(() => {
          if (this.active) {
            this.callbacks.onViseme?.(getNextActiveViseme());
          }
        }, 140);
      }

      if (!window.speechSynthesis.speaking && elapsed > 800) {
        clearInterval(this.watchdog!); this.watchdog = null;
        this.playNext();
      } else if (elapsed > expectedMs + 3000) {
        clearInterval(this.watchdog!); this.watchdog = null;
        window.speechSynthesis.cancel();
        this.playNext();
      }
    }, 300);

    window.speechSynthesis.speak(utter);
  }
}

/** Split accumulated text into complete sentences, returning [complete[], remainder] */
export function extractSentences(buffer: string): [string[], string] {
  const sentences: string[] = [];
  let remaining = buffer;
  let match: RegExpMatchArray | null;
  while ((match = remaining.match(/^(.*?[.!?])(\s+|$)/))) {
    const s = match[1].trim();
    remaining = remaining.slice(match[0].length);
    if (s) sentences.push(s);
  }
  return [sentences, remaining];
}
