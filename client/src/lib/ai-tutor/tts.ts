/**
 * TTS Module — streams sentences to the browser's speechSynthesis engine.
 * Starts speaking as soon as the first sentence arrives; no full-response wait.
 * Includes:
 *   - Watchdog timer for Chrome's silent onend bug
 *   - Viseme callbacks via SpeechSynthesisUtterance.onboundary for realistic lipsync
 *   - Fallback random animation when boundary events are unsupported
 */

import { getWordViseme, getNextActiveViseme, type Viseme } from "./lipsync";
import type { VoicePersona } from "./types";

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
  // Browser engine internally treats Eva as Female (it's a bright young
  // female voice); Eva is normally routed to ElevenLabs, this is just the
  // graceful fallback if ElevenLabs is unreachable.
  private voice: "Female" | "Male" = "Female";
  private voiceId: string | null = null;
  // Natural conversational pace — 0.7 was robotically slow.
  private speed = 0.95;
  private callbacks: TtsCallbacks;
  // Eagerly cached voice list — avoids Chrome returning empty on first playback
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private waitedForVoices = false;

  constructor(callbacks: TtsCallbacks) {
    this.callbacks = callbacks;
    // Pre-load the browser voice list immediately so it is ready on first speak.
    // Chrome loads voices asynchronously — without this the default (often male)
    // voice is used even for Female persona on the very first utterance.
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => {
        const v = window.speechSynthesis.getVoices();
        if (v.length > 0) this.cachedVoices = v;
      };
      loadVoices(); // may return immediately on Firefox / Safari
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  configure(voice: VoicePersona, speed: number, voiceId?: string | null) {
    // Browser engine has no Eva voice — collapse it onto Female.
    this.voice = voice === "Male" ? "Male" : "Female";
    this.speed = speed;
    // Sesame speaker ids are not browser voices — passing them makes Chrome
    // keep the default male voice. Always pick by gender for Maya/Miles.
    this.voiceId = voiceId && /^(conversational|read_speech)_[a-d]$/i.test(voiceId) ? null : voiceId || null;
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

    const freshVoicesEarly = typeof window !== "undefined" ? window.speechSynthesis.getVoices() : [];
    if (freshVoicesEarly.length > 0) this.cachedVoices = freshVoicesEarly;
    if (this.cachedVoices.length === 0 && !this.waitedForVoices) {
      this.waitedForVoices = true;
      this.queue.unshift(sentence);
      window.setTimeout(() => this.playNext(), 250);
      return;
    }

    this.active = true;
    this.callbacks.onStart();

    const isFemale = this.voice === "Female";
    const utter = new SpeechSynthesisUtterance(sentence);
    utter.rate = Math.max(0.5, Math.min(2, this.speed));
    utter.pitch = isFemale ? 1.08 : 0.85;
    utter.volume = 1.0;
    utter.lang = "en-US";

    const freshVoices = window.speechSynthesis.getVoices();
    if (freshVoices.length > 0) this.cachedVoices = freshVoices;
    const voices = this.cachedVoices;
    if (voices.length > 0) {
      const isNovelty = (v: SpeechSynthesisVoice) =>
        /albert|bahh|bells|boing|bubbles|cellos|deranged|hysterical|good news|bad news|jester|organ|trinoids|whisper|zarvox|wobble|kathy|junior|princess|ralph|bruce|fred|grandma|grandpa/i.test(v.name);
      const isLikelyMale = (v: SpeechSynthesisVoice) =>
        /\bmale\b|google us english(?!.*female)|google uk english male|microsoft david|daniel|david|alex|mark|george|tom|oliver|james|arthur|guy|aaron|brian|christopher|eric|justin|liam|matthew|michael|paul|ravi|ryan|stephen|thomas|william|diego/i.test(v.name);
      const isLikelyFemale = (v: SpeechSynthesisVoice) =>
        /female|woman|google uk english female|microsoft zira|samantha|victoria|serena|aria|jenny|libby|sonia|emma|ava|susan|zira|hazel|moira|tessa|fiona|karen|siri|alice|vicki|olivia|amelia|eva|nora|clara|catherine|linda|heather|michelle/i.test(v.name);

      const savedVoice = this.voiceId
        ? voices.find(v => (v.voiceURI === this.voiceId || v.name === this.voiceId) && (isFemale ? !isLikelyMale(v) : true))
        : undefined;

      const naturalFemale =
        voices.find(v => /aria.*online|jenny.*online|libby.*online|sonia.*online|emma.*online|zira.*online|natural/i.test(v.name) && v.lang.startsWith("en") && !isLikelyMale(v)) ??
        voices.find(v => /google uk english female/i.test(v.name));

      const matureFemale =
        voices.find(v => /\b(samantha|victoria|serena|kate|allison|ava|susan|zira)\b/i.test(v.name) && v.lang.startsWith("en")) ??
        voices.find(v => isLikelyFemale(v) && v.lang.startsWith("en") && !isNovelty(v) && !isLikelyMale(v));

      const femaleVoice = naturalFemale ?? matureFemale;

      const maleVoice =
        voices.find(v => /google us english(?!.*female)|google uk english male|microsoft david/i.test(v.name) && v.lang.startsWith("en")) ??
        voices.find(v => isLikelyMale(v) && v.lang.startsWith("en") && !isNovelty(v));

      const chosen =
        savedVoice ??
        (isFemale
          ? (femaleVoice ?? voices.find(v => isLikelyFemale(v) && v.lang.startsWith("en")))
          : (maleVoice ?? voices.find(v => isLikelyMale(v) && v.lang.startsWith("en"))));

      if (chosen) {
        utter.voice = chosen;
        const stableVoiceId = chosen.voiceURI || chosen.name;
        if (this.voiceId && stableVoiceId && stableVoiceId !== this.voiceId) {
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
