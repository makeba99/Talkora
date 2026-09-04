/**
 * STT Module — Web Speech API wrapper with barge-in support.
 *
 * Primary recognizer: runs in CONTINUOUS mode with a 400ms silence timer.
 *   - Continuous mode captures fast speech and long sentences without cutting off.
 *   - A silence timer (400ms after last speech activity) flushes the accumulated buffer.
 *   - "lastInterim" fallback: Chrome often skips isFinal for short utterances and
 *     fires onend directly — we capture the best interim result seen and use it as
 *     the user's message when no isFinal data was collected.
 *
 * Barge-in recognizer: lightweight always-on mic that detects voice while AI is
 *   speaking and cancels the TTS pipeline. Two guards prevent echo loops:
 *   1. 1800ms grace period after AI starts speaking.
 *   2. Minimum 2 words to trigger (single words are almost always echo artifacts).
 *
 * No-speech extended: after 6 consecutive no-speech events (~30s of silence),
 *   fires onNoSpeechExtended so the hook can speak a reminder to the user.
 */

import { SPEECH_LANG_MAP } from "./types";

/** Pure-filler transcript pattern — recognized but carries no real content */
export const FILLER_ONLY_PATTERN = /^(um+|uh+|hmm+|hm+|err+|erm+|ah+|mm+|mhm+|ugh+)(\s+(um+|uh+|hmm+|hm+|err+|erm+|ah+|mm+|mhm+|ugh+))*\.?$/i;

export type WakePersona = "maya" | "miles" | "ai";

export interface WakeMatch {
  persona: WakePersona;
  afterText: string;
}

const WAKE_GREET = "(?:hey|hi|hello|ok|okay|yo|wake\\s+up|start|listen|activate)";
const WAKE_MAYA = "(?:maya|maia|mya)";
const WAKE_MILES = "(?:miles|myles)";
const WAKE_AI = "(?:ai|a\\.i\\.?|tutor|afi(?:\\s*k)?|eva|dude|agent)";

/**
 * Wake-word pattern. Matches any of:
 *   "hey AI / hey A.I. / hey tutor / hey Afi / hey Afi K / hey Eva / hey Dude / hey agent"
 *   "ok AI / okay AI / yo AI / hi AI / hello AI"
 *   "wake up AI / wake up tutor"
 *   "start AI / listen AI / activate AI"
 *   "Maya" / "hey Maya" / "Miles" / "hey Miles"
 *
 * Kept for callers that only need a boolean "is this a wake phrase".
 */
export const WAKE_PATTERN = new RegExp(
  `\\b(?:${WAKE_GREET}\\s+${WAKE_AI}|(?:${WAKE_GREET}\\s+)?(?:${WAKE_MAYA}|${WAKE_MILES}))\\b`,
  "i",
);

/**
 * Parse a transcript into a wake persona + leftover question.
 * Bare "Maya" / "Miles" only match as the whole utterance so chatting about
 * someone named Maya does not summon the tutor.
 */
export function matchWakePhrase(raw: string): WakeMatch | null {
  const text = raw
    .trim()
    .replace(/^[,\s]+/, "")
    .replace(/[.!?]+$/g, "")
    .trim();
  if (!text) return null;

  if (new RegExp(`^${WAKE_MAYA}$`, "i").test(text)) {
    return { persona: "maya", afterText: "" };
  }
  if (new RegExp(`^${WAKE_MILES}$`, "i").test(text)) {
    return { persona: "miles", afterText: "" };
  }

  let m = new RegExp(`^${WAKE_GREET}[,\\s]+${WAKE_MAYA}\\b[,!.]?\\s*(.*)$`, "i").exec(text);
  if (m) return { persona: "maya", afterText: (m[1] || "").trim() };

  m = new RegExp(`^${WAKE_GREET}[,\\s]+${WAKE_MILES}\\b[,!.]?\\s*(.*)$`, "i").exec(text);
  if (m) return { persona: "miles", afterText: (m[1] || "").trim() };

  m = new RegExp(`^${WAKE_GREET}[,\\s]+${WAKE_AI}\\b[,!.]?\\s*(.*)$`, "i").exec(text);
  if (m) return { persona: "ai", afterText: (m[1] || "").trim() };

  return null;
}

/**
 * WakeWordDetector — a lightweight always-on background listener.
 *
 * Runs a separate SpeechRecognition session in continuous mode while the AI is
 * inactive. When the user says a wake phrase ("hey AI", "Maya", "Miles", …) it
 * fires onWake with the matched persona and any extra text after the phrase
 * (e.g. "hey Maya what's up" → persona maya, afterText = "what's up").
 *
 * Lifecycle:
 *   start()  — begin background listening (idempotent)
 *   stop()   — tear down the session (idempotent)
 *
 * The detector stops itself immediately after a wake event so the primary STT
 * engine can take over without competing for the microphone.
 */
export class WakeWordDetector {
  private rec: any = null;
  private lang = "en-US";
  private _active = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private onWake: (match: WakeMatch) => void;
  private onStatusChange: (listening: boolean) => void;

  constructor(
    onWake: (match: WakeMatch) => void,
    onStatusChange: (listening: boolean) => void
  ) {
    this.onWake = onWake;
    this.onStatusChange = onStatusChange;
  }

  get isActive() {
    return this._active;
  }

  setLanguage(lang: string) {
    this.lang = SPEECH_LANG_MAP[lang] || lang || "en-US";
  }

  start() {
    if (!SpeechRec) return;
    if (this._active) return;
    this._active = true;
    this._launch();
  }

  stop() {
    this._active = false;
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
    try { this.rec?.abort(); } catch {}
    this.rec = null;
    this.onStatusChange(false);
  }

  private _launch() {
    if (!SpeechRec || !this._active) return;

    try { this.rec?.abort(); } catch {}
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = this.lang;
    this.rec = rec;

    rec.onstart = () => { this.onStatusChange(true); };

    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript.trim();
        if (!transcript) continue;
        const match = matchWakePhrase(transcript);
        if (!match) continue;
        // Bare names ("Maya" / "Miles") wait for a final result so mid-sentence
        // mentions do not summon the tutor. "Hey AI" / "hey Maya" can fire early.
        const greeted = new RegExp(`^${WAKE_GREET}\\b`, "i").test(transcript);
        if (!greeted && !e.results[i].isFinal) continue;
        // Stop before firing so the primary STT can open the mic cleanly
        this.stop();
        this.onWake(match);
        return;
      }
    };

    rec.onerror = (e: any) => {
      const err = e?.error || "";
      if (err === "not-allowed" || err === "service-not-allowed") {
        this._active = false;
        this.onStatusChange(false);
        return;
      }
      if (err === "aborted") return;
      this._scheduleRestart(1500);
    };

    rec.onend = () => {
      if (this._active) this._scheduleRestart(300);
      else this.onStatusChange(false);
    };

    try {
      rec.start();
    } catch {
      this._scheduleRestart(1500);
    }
  }

  private _scheduleRestart(ms: number) {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this._active) this._launch();
    }, ms);
  }
}

export type SttCallbacks = {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onStart: () => void;
  onStop: () => void;
  onBargeIn: () => void;
  onError?: (msg: string) => void;
  /** Fired after ~30 s of continuous silence (6 no-speech events). */
  onNoSpeechExtended?: () => void;
};

const SpeechRec: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export const hasSpeechRecognition = !!SpeechRec;

export class SttEngine {
  private primary: any = null;
  private bargeIn: any = null;
  private lang = "en-US";
  private callbacks: SttCallbacks;
  private panelOpenRef: { current: boolean };
  private speakingRef: { current: boolean };
  private loadingRef: { current: boolean };
  private activeRef: { current: boolean };
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private micDenied = false;
  /** Consecutive no-speech events — resets on any real transcript. */
  private noSpeechCount = 0;
  /** How many consecutive no-speech events before firing onNoSpeechExtended. */
  private static readonly NO_SPEECH_EXTENDED_THRESHOLD = 6;

  constructor(
    callbacks: SttCallbacks,
    refs: {
      panelOpen: { current: boolean };
      speaking: { current: boolean };
      loading: { current: boolean };
      active: { current: boolean };
    }
  ) {
    this.callbacks = callbacks;
    this.panelOpenRef = refs.panelOpen;
    this.speakingRef = refs.speaking;
    this.loadingRef = refs.loading;
    this.activeRef = refs.active;
  }

  setLanguage(roomLanguage: string) {
    this.lang = SPEECH_LANG_MAP[roomLanguage] || "en-US";
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
  }

  private scheduleRestart(delayMs: number) {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.activeRef.current && !this.speakingRef.current && !this.loadingRef.current && !this.micDenied) {
        this.startListening();
      }
    }, delayMs);
  }

  /**
   * Start primary recognition in CONTINUOUS mode.
   *
   * Chrome's continuous mode behaviour:
   *  - Long utterances: fires isFinal=true progressively → accumulated in finalBuffer.
   *  - Short utterances: often fires only interim results, then ends the session without
   *    ever sending isFinal=true. We track "lastInterim" and use it as a fallback so
   *    these short phrases aren't silently dropped.
   */
  startListening() {
    if (!SpeechRec) return;
    if (this.micDenied) return;
    if (!this.activeRef.current || this.speakingRef.current || this.loadingRef.current) return;

    this.clearSilenceTimer();
    try { this.primary?.abort(); } catch {}
    this.primary = null;

    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = this.lang;
    this.primary = rec;

    let finalBuffer = "";
    let lastInterim = "";
    let errorHandled = false;

    // Flush accumulated speech after 260ms of silence — tight enough to feel
    // instant while still letting most natural speech pauses complete.
    const flush = () => {
      this.clearSilenceTimer();
      const text = (finalBuffer || lastInterim).trim();
      finalBuffer = "";
      lastInterim = "";
      if (text && this.activeRef.current && !this.loadingRef.current) {
        this.noSpeechCount = 0; // real speech — reset the silence counter
        this.callbacks.onFinal(text);
      }
    };

    const resetSilence = () => {
      this.clearSilenceTimer();
      this.silenceTimer = setTimeout(flush, 260);
    };

    rec.onstart = () => {
      this.callbacks.onStart();
    };

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          const word = result[0].transcript.trim();
          if (word) {
            finalBuffer += (finalBuffer ? " " : "") + word;
            lastInterim = "";
            resetSilence();
          }
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim.trim()) lastInterim = interim.trim();

      const display = (finalBuffer + (interim ? " " + interim : "")).trim();
      if (display) this.callbacks.onInterim(display);
    };

    rec.onerror = (e: any) => {
      const err: string = e?.error || "unknown";
      this.clearSilenceTimer();

      if (err === "not-allowed" || err === "service-not-allowed") {
        this.micDenied = true;
        errorHandled = true;
        this.callbacks.onStop();
        this.callbacks.onError?.("Microphone access denied. Please allow microphone access in your browser and refresh.");
        return;
      }

      if (err === "aborted") {
        errorHandled = true;
        return;
      }

      this.callbacks.onStop();
      errorHandled = true;

      if (err === "no-speech") {
        this.noSpeechCount++;
        if (this.noSpeechCount >= SttEngine.NO_SPEECH_EXTENDED_THRESHOLD) {
          this.noSpeechCount = 0;
          this.callbacks.onNoSpeechExtended?.();
        }
        this.scheduleRestart(300);
        return;
      }

      if (err === "network") {
        this.callbacks.onError?.("network");
        this.scheduleRestart(2000);
        return;
      }

      // audio-capture: another app is using the mic, or the device is unavailable.
      // Retry after a longer pause to give the OS time to release the device.
      if (err === "audio-capture") {
        this.callbacks.onError?.("audio-capture");
        this.scheduleRestart(2500);
        return;
      }

      // Any other browser-level error (e.g. "service-not-allowed" during runtime,
      // "bad-grammar", browser bug). Pass the raw code so the hook can log it.
      this.callbacks.onError?.(`recognition-error:${err}`);
      this.scheduleRestart(800);
    };

    rec.onend = () => {
      this.clearSilenceTimer();

      if (errorHandled) return;

      const text = (finalBuffer || lastInterim).trim();
      finalBuffer = "";
      lastInterim = "";

      this.callbacks.onStop();
      if (text && this.activeRef.current && !this.loadingRef.current) {
        this.noSpeechCount = 0;
        this.callbacks.onFinal(text);
        return;
      }
      this.scheduleRestart(300);
    };

    try {
      rec.start();
    } catch {
      this.callbacks.onStop();
      this.callbacks.onError?.("Could not start microphone. Try refreshing the page.");
    }
  }

  /**
   * Start barge-in detector: runs while AI is speaking.
   * Two guards prevent the AI's own voice (echo from speakers) from triggering a loop:
   *   1. 1400ms grace period — ignore all audio for the first 1.4s of AI speech.
   *      (Reduced from 1800ms — most echo artifacts fade within 1s.)
   *   2. Minimum 2 words — single words/syllables are almost always echo artifacts.
   */
  startBargeIn() {
    if (!SpeechRec || this.micDenied) return;
    try { this.bargeIn?.abort(); } catch {}

    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = this.lang;
    this.bargeIn = rec;

    const activatedAt = Date.now();

    rec.onresult = (e: any) => {
      if (Date.now() - activatedAt < 1400) return;

      const results = Array.from(e.results as SpeechRecognitionResultList);
      const wordCount = results.reduce(
        (sum, r: SpeechRecognitionResult) =>
          sum + r[0].transcript.trim().split(/\s+/).filter(Boolean).length,
        0
      );
      // 2-word threshold — responsive while still blocking single-word echo
      if (wordCount >= 2) {
        this.callbacks.onBargeIn();
        this.stopBargeIn();
      }
    };

    rec.onerror = () => {};
    rec.onend = () => {};

    try { rec.start(); } catch {}
  }

  stopBargeIn() {
    try { this.bargeIn?.abort(); } catch {}
    this.bargeIn = null;
  }

  stopListening() {
    this.clearSilenceTimer();
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
    try { this.primary?.abort(); } catch {}
    this.primary = null;
    this.callbacks.onStop();
  }

  stopAll() {
    this.stopListening();
    this.stopBargeIn();
  }

  /** Reset mic-denied state (e.g. after user grants permission) */
  resetMicDenied() {
    this.micDenied = false;
  }

  /** Reset the no-speech counter (e.g. after AI speaks a reminder) */
  resetNoSpeechCount() {
    this.noSpeechCount = 0;
  }
}
