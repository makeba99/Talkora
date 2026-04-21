/**
 * STT Module — Web Speech API wrapper with barge-in support.
 *
 * Primary recognizer: runs in CONTINUOUS mode with a 750ms silence timer.
 *   - Continuous mode captures fast speech and long sentences without cutting off.
 *   - A silence timer (750ms after last isFinal) flushes the accumulated buffer.
 *   - Auto-restarts within 50ms after session ends so the gap between sentences
 *     is imperceptible.
 *
 * Barge-in recognizer: lightweight always-on mic that detects ANY voice
 *   while AI is speaking and immediately cancels the TTS pipeline.
 */

import { SPEECH_LANG_MAP } from "./types";

export type SttCallbacks = {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onStart: () => void;
  onStop: () => void;
  onBargeIn: () => void;
  onError?: (msg: string) => void;
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
   * Accumulates isFinal results into a buffer and flushes when the user
   * pauses for 750ms — this captures fast speech and long sentences fully.
   */
  startListening() {
    if (!SpeechRec) return;
    if (this.micDenied) return;
    if (!this.activeRef.current || this.speakingRef.current || this.loadingRef.current) return;

    this.clearSilenceTimer();
    try { this.primary?.abort(); } catch {}
    this.primary = null;

    const rec = new SpeechRec();
    rec.continuous = true;         // continuous — no early cut-off on mid-sentence pauses
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = this.lang;
    this.primary = rec;

    let finalBuffer = "";

    // Flush accumulated text to the AI after 750ms of silence
    const flush = () => {
      this.clearSilenceTimer();
      const text = finalBuffer.trim();
      finalBuffer = "";
      if (text && this.activeRef.current && !this.loadingRef.current) {
        this.callbacks.onFinal(text);
      }
    };

    const resetSilence = () => {
      this.clearSilenceTimer();
      this.silenceTimer = setTimeout(flush, 750);
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
            resetSilence(); // reset the 750ms silence window after each final chunk
          }
        } else {
          interim += result[0].transcript;
        }
      }
      // Show the running transcript (finals + current interim) to the user
      const display = (finalBuffer + (interim ? " " + interim : "")).trim();
      if (display) this.callbacks.onInterim(display);
    };

    rec.onerror = (e: any) => {
      const err: string = e?.error || "unknown";
      this.clearSilenceTimer();

      if (err === "not-allowed" || err === "service-not-allowed") {
        this.micDenied = true;
        this.callbacks.onStop();
        this.callbacks.onError?.("Microphone access denied. Please allow microphone access in your browser and refresh.");
        return;
      }

      if (err === "aborted") {
        // Intentional abort from stopListening() — don't restart from here
        return;
      }

      this.callbacks.onStop();

      if (err === "no-speech") {
        // No speech detected — restart quickly to keep the session alive
        this.scheduleRestart(150);
        return;
      }

      if (err === "network") {
        this.callbacks.onError?.("Speech recognition network error. Check your connection.");
        this.scheduleRestart(2000);
        return;
      }

      // Other errors — restart after a brief pause
      this.callbacks.onError?.(`Speech recognition error: ${err}`);
      this.scheduleRestart(600);
    };

    rec.onend = () => {
      this.clearSilenceTimer();
      // If there's buffered text (session ended before silence timer fired), send it now
      const text = finalBuffer.trim();
      finalBuffer = "";
      this.callbacks.onStop();
      if (text && this.activeRef.current && !this.loadingRef.current) {
        this.callbacks.onFinal(text);
        // sendAiMessage will restart listening after AI responds
        return;
      }
      // Continuous session ended without new text — restart immediately
      this.scheduleRestart(50);
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
   *   1. 1800ms grace period — ignore all audio for the first 1.8s of AI speech
   *      (the AI's voice is loudest at the start; real user interruptions come later)
   *   2. Minimum 3 words — single words/syllables are almost always echo artifacts
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
      // Grace period: ignore all audio for the first 1800ms.
      // The AI's own TTS voice comes out of the speakers and would be picked up
      // immediately — this window lets that echo pass without triggering.
      if (Date.now() - activatedAt < 1800) return;

      const results = Array.from(e.results as SpeechRecognitionResultList);
      // Require at least 3 words — brief sounds and single words are echo artifacts.
      const wordCount = results.reduce(
        (sum, r: SpeechRecognitionResult) =>
          sum + r[0].transcript.trim().split(/\s+/).filter(Boolean).length,
        0
      );
      if (wordCount >= 3) {
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
}
