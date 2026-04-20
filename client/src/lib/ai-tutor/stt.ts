/**
 * STT Module — Web Speech API wrapper with barge-in support.
 *
 * Primary recognizer: runs in single-utterance mode (continuous: false).
 *   - More reliable than continuous mode; Chrome always fires isFinal after a pause
 *   - Auto-restarts after each utterance so the AI keeps listening indefinitely
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
   * Start primary recognition.
   * Uses single-utterance mode (continuous: false) — fires a final result
   * reliably after the user pauses speaking, then auto-restarts.
   */
  startListening() {
    if (!SpeechRec) return;
    if (this.micDenied) return;
    if (!this.activeRef.current || this.speakingRef.current || this.loadingRef.current) return;

    try { this.primary?.abort(); } catch {}
    this.primary = null;

    const rec = new SpeechRec();
    // Single-utterance mode: much more reliable for getting isFinal results
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = this.lang;
    this.primary = rec;

    let gotFinal = false;

    rec.onstart = () => {
      this.callbacks.onStart();
    };

    rec.onresult = (e: any) => {
      const results = Array.from(e.results as SpeechRecognitionResultList);

      // Always show interim text so user can see mic is picking up their voice
      const interim = results
        .filter((r: SpeechRecognitionResult) => !r.isFinal)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join(" ")
        .trim();
      if (interim) this.callbacks.onInterim(interim);

      // Final transcript — send to AI
      const transcript = results
        .filter((r: SpeechRecognitionResult) => r.isFinal)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join(" ")
        .trim();

      if (transcript) {
        gotFinal = true;
        this.callbacks.onFinal(transcript);
      }
    };

    rec.onerror = (e: any) => {
      const err: string = e?.error || "unknown";

      if (err === "not-allowed" || err === "service-not-allowed") {
        this.micDenied = true;
        this.callbacks.onStop();
        this.callbacks.onError?.("Microphone access denied. Please allow microphone access in your browser and refresh.");
        return;
      }

      if (err === "aborted") {
        // Intentional abort — don't log or restart from here
        return;
      }

      this.callbacks.onStop();

      if (err === "no-speech") {
        // No speech heard — restart quickly to keep listening
        this.scheduleRestart(400);
        return;
      }

      if (err === "network") {
        this.callbacks.onError?.("Speech recognition network error. Check your connection.");
        this.scheduleRestart(2000);
        return;
      }

      // Other errors — restart after a short pause
      this.callbacks.onError?.(`Speech recognition error: ${err}`);
      this.scheduleRestart(800);
    };

    rec.onend = () => {
      this.callbacks.onStop();
      if (!gotFinal && !this.micDenied) {
        // Recognition ended without capturing speech — restart to keep listening
        this.scheduleRestart(300);
      }
      // If gotFinal is true, DO NOT restart here.
      // sendAiMessage will restart after AI responds (via onTtsEnd → startListening).
    };

    try {
      rec.start();
    } catch (err) {
      this.callbacks.onStop();
      this.callbacks.onError?.("Could not start microphone. Try refreshing the page.");
    }
  }

  /**
   * Start barge-in detector: runs even while AI is speaking.
   * Any detected speech immediately triggers an interrupt.
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

    rec.onresult = (e: any) => {
      const results = Array.from(e.results as SpeechRecognitionResultList);
      const hasAny = results.some((r: SpeechRecognitionResult) => r[0].transcript.trim().length > 0);
      if (hasAny) {
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
