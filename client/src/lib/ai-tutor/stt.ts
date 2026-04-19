/**
 * STT Module — Web Speech API wrapper with barge-in support.
 *
 * Primary recognizer: runs while AI is idle, sends transcripts to AI.
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

  /** Start primary recognition (no-op when AI is speaking or loading) */
  startListening() {
    if (!SpeechRec) return;
    if (!this.activeRef.current || this.speakingRef.current || this.loadingRef.current) return;

    try { this.primary?.abort(); } catch {}

    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.lang;
    this.primary = rec;

    rec.onstart = () => this.callbacks.onStart();

    rec.onresult = (e: any) => {
      const results = Array.from(e.results as SpeechRecognitionResultList).slice(e.resultIndex || 0);

      if (this.panelOpenRef.current) {
        const interim = results
          .filter((r: SpeechRecognitionResult) => !r.isFinal)
          .map((r: SpeechRecognitionResult) => r[0].transcript)
          .join(" ")
          .trim();
        if (interim) this.callbacks.onInterim(interim);
      }

      const transcript = results
        .filter((r: SpeechRecognitionResult) => r.isFinal)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join(" ")
        .trim();

      if (transcript && this.panelOpenRef.current) {
        this.callbacks.onFinal(transcript);
      }
    };

    rec.onerror = (e: any) => {
      this.callbacks.onStop();
      if (e.error === "aborted" || e.error === "no-speech") {
        setTimeout(() => {
          if (this.activeRef.current && !this.speakingRef.current && !this.loadingRef.current) {
            this.startListening();
          }
        }, 300);
        return;
      }
      setTimeout(() => {
        if (this.activeRef.current && !this.speakingRef.current && !this.loadingRef.current) {
          this.startListening();
        }
      }, 800);
    };

    rec.onend = () => {
      this.callbacks.onStop();
      setTimeout(() => {
        if (this.activeRef.current && !this.speakingRef.current && !this.loadingRef.current) {
          this.startListening();
        }
      }, 300);
    };

    try { rec.start(); } catch {}
  }

  /**
   * Start barge-in detector: runs even while AI is speaking.
   * Uses energy-based detection (any voice triggers immediate interrupt).
   */
  startBargeIn() {
    if (!SpeechRec) return;
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
    try { this.primary?.abort(); } catch {}
    this.primary = null;
    this.callbacks.onStop();
  }

  stopAll() {
    this.stopListening();
    this.stopBargeIn();
  }
}
