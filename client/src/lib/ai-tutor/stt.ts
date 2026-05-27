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

    // Flush accumulated speech after 400ms of silence (tighter than the old 500ms).
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
      this.silenceTimer = setTimeout(flush, 400);
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
        this.callbacks.onError?.("Speech recognition network error. Check your connection.");
        this.scheduleRestart(2000);
        return;
      }

      this.callbacks.onError?.(`Speech recognition error: ${err}`);
      this.scheduleRestart(600);
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
   *   1. 1800ms grace period — ignore all audio for the first 1.8s of AI speech.
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
      if (Date.now() - activatedAt < 1800) return;

      const results = Array.from(e.results as SpeechRecognitionResultList);
      const wordCount = results.reduce(
        (sum, r: SpeechRecognitionResult) =>
          sum + r[0].transcript.trim().split(/\s+/).filter(Boolean).length,
        0
      );
      // 2-word threshold (was 3) — more responsive while still blocking single-word echo
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
