/**
 * CloudSttEngine — speech recognition that listens to the microphone stream
 * the voice room already owns.
 *
 * Why this exists: the Web Speech API (SttEngine) opens a *second*, independent
 * capture of the microphone. Inside a voice room the device is already held by
 * the WebRTC stream, and most mobile browsers hand that second capture silence —
 * recognition starts, the UI says "Listening…", and not one word ever arrives.
 * Web Speech is also completely absent from Safari on iOS and from Firefox.
 *
 * This engine taps the existing stream through Web Audio instead, so there is
 * no second capture to fight over:
 *
 *   room MediaStream → AudioContext → energy VAD → WAV of each phrase
 *                                                → POST /api/ai-tutor/transcribe
 *
 * Phrases are detected locally (free) and only the audio between speech onset
 * and 700 ms of silence is uploaded, so a quiet room costs nothing.
 */

import { SPEECH_LANG_MAP } from "./types";

export interface CloudSttCallbacks {
  /** Speech energy crossed the threshold — the user has started talking. */
  onSpeechStart?: () => void;
  /** A finished phrase. Never called with an empty transcript. */
  onTranscript: (text: string, meta: { durationMs: number }) => void;
  /** Recoverable problem worth showing in the debug log. */
  onNotice?: (message: string) => void;
  /** Transcription cannot work — the caller should fall back to Web Speech. */
  onUnavailable?: (reason: string) => void;
}

export interface CloudSttOptions {
  /** Scopes the request to a room so the server can check session ownership. */
  roomId?: string;
  /** Cost guard: transcription requests allowed per rolling minute. */
  maxRequestsPerMinute?: number;
  /** Phrases shorter than this are dropped (coughs, clicks, door slams). */
  minSpeechMs?: number;
  /** A phrase this long is uploaded as-is and recording continues. */
  maxSpeechMs?: number;
  /**
   * What to do with the rest of a phrase that runs past maxSpeechMs.
   * "continue" transcribes it in parts (a session must catch every word);
   * "firstOnly" drops it, which is all wake-word listening needs since the
   * name always comes first — and it caps a long monologue at one request.
   */
  overflow?: "continue" | "firstOnly";
}

const TARGET_SAMPLE_RATE = 16000;
/** 64 ms at 16 kHz — small enough to react quickly to speech onset. */
const FRAME_SIZE = 1024;
/** Audio kept before speech onset so the first syllable is never clipped. */
const PREROLL_MS = 400;
/** Silence that ends a phrase. Long enough to survive mid-sentence pauses. */
const HANGOVER_MS = 700;
/** Consecutive loud frames required to open a phrase. */
const ONSET_FRAMES = 2;
const MAX_IN_FLIGHT = 2;
const MAX_CONSECUTIVE_FAILURES = 3;

function hasAudioSupport(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.AudioContext || (window as any).webkitAudioContext);
}

export const hasCloudSttSupport = hasAudioSupport();

/** Whisper wants a bare ISO-639-1 code ("en"), not a BCP-47 tag ("en-US"). */
export function whisperLanguage(roomLanguage: string): string | null {
  const tag = SPEECH_LANG_MAP[roomLanguage] || roomLanguage || "";
  const code = tag.slice(0, 2).toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : null;
}

function encodeWav(frames: Float32Array[], sampleRate: number): Blob {
  let samples = 0;
  for (const frame of frames) samples += frame.length;

  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeText(36, "data");
  view.setUint32(40, samples * 2, true);

  let offset = 44;
  for (const frame of frames) {
    for (let i = 0; i < frame.length; i++) {
      const clamped = Math.max(-1, Math.min(1, frame[i]));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export class CloudSttEngine {
  private callbacks: CloudSttCallbacks;
  private options: Required<Omit<CloudSttOptions, "roomId">> & { roomId?: string };

  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sink: GainNode | null = null;
  private stream: MediaStream | null = null;
  /** True when the engine, not the caller, opened the microphone. */
  private ownsStream = false;

  private running = false;
  private language: string | null = "en";

  // ── Voice activity state ──
  private preroll: Float32Array[] = [];
  private prerollFrames = 1;
  private segment: Float32Array[] = [];
  private inSpeech = false;
  private loudFrames = 0;
  private quietFrames = 0;
  /** Set once a phrase overruns maxSpeechMs in "firstOnly" mode. */
  private droppingRest = false;
  private hangoverFrames = 1;
  private maxSegmentFrames = 1;
  private minSegmentFrames = 1;
  private noiseFloor = 0.004;

  private inFlight = 0;
  private requestTimes: number[] = [];
  private consecutiveFailures = 0;
  /** Set once transcription is declared unusable — no more uploads. */
  private disabled = false;

  constructor(callbacks: CloudSttCallbacks, options: CloudSttOptions = {}) {
    this.callbacks = callbacks;
    this.options = {
      roomId: options.roomId,
      maxRequestsPerMinute: options.maxRequestsPerMinute ?? 60,
      minSpeechMs: options.minSpeechMs ?? 350,
      maxSpeechMs: options.maxSpeechMs ?? 12000,
      overflow: options.overflow ?? "continue",
    };
  }

  get isRunning() {
    return this.running;
  }

  setLanguage(roomLanguage: string) {
    this.language = whisperLanguage(roomLanguage);
  }

  setOptions(options: CloudSttOptions) {
    this.options = { ...this.options, ...options };
    this.recomputeFrameBudgets();
  }

  /**
   * Begin listening. `stream` should be the room's raw microphone stream so no
   * second capture is opened; when it is missing the engine falls back to its
   * own getUserMedia call.
   */
  async start(
    stream: MediaStream | null,
    opts: { allowOwnMic?: boolean } = {},
  ): Promise<boolean> {
    if (!hasAudioSupport()) {
      this.callbacks.onUnavailable?.("Web Audio unavailable");
      return false;
    }
    if (this.running && stream && stream === this.stream) return true;
    if (this.running && !stream && this.ownsStream) return true;
    this.stop();

    let micStream = stream;
    if (!micStream || micStream.getAudioTracks().length === 0) {
      // Background listening must never trigger a permission prompt of its
      // own — it waits for the room to open the microphone.
      if (opts.allowOwnMic === false) return false;
      micStream = await this.openOwnMic();
      if (!micStream) return false;
      this.ownsStream = true;
    }

    try {
      const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      let ctx: AudioContext;
      try {
        ctx = new AC({ sampleRate: TARGET_SAMPLE_RATE });
      } catch {
        // Some browsers reject an explicit rate — the WAV header carries
        // whatever rate we actually get, so any of them transcribes fine.
        ctx = new AC();
      }
      this.ctx = ctx;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      this.stream = micStream;
      this.source = ctx.createMediaStreamSource(micStream);
      this.processor = ctx.createScriptProcessor(FRAME_SIZE, 1, 1);
      // Chrome only pumps a ScriptProcessor that is connected downstream; a
      // zero-gain sink keeps the graph alive without making any sound.
      this.sink = ctx.createGain();
      this.sink.gain.value = 0;
      this.processor.onaudioprocess = (event) => this.onFrame(event.inputBuffer.getChannelData(0));
      this.source.connect(this.processor);
      this.processor.connect(this.sink);
      this.sink.connect(ctx.destination);

      this.recomputeFrameBudgets();
      this.resetSegment();
      this.consecutiveFailures = 0;
      this.disabled = false;
      this.running = true;
      return true;
    } catch (err: any) {
      this.stop();
      this.callbacks.onUnavailable?.(err?.message || "audio graph failed");
      return false;
    }
  }

  stop() {
    this.running = false;
    try { this.processor?.disconnect(); } catch {}
    try { this.source?.disconnect(); } catch {}
    try { this.sink?.disconnect(); } catch {}
    if (this.processor) this.processor.onaudioprocess = null;
    this.processor = null;
    this.source = null;
    this.sink = null;
    try { this.ctx?.close(); } catch {}
    this.ctx = null;
    if (this.ownsStream) {
      this.stream?.getTracks().forEach((t) => t.stop());
    }
    this.ownsStream = false;
    this.stream = null;
    this.resetSegment();
  }

  private async openOwnMic(): Promise<MediaStream | null> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.callbacks.onUnavailable?.("microphone unavailable");
      return null;
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err: any) {
      this.callbacks.onUnavailable?.(
        err?.name === "NotAllowedError" ? "microphone permission denied" : "microphone unavailable",
      );
      return null;
    }
  }

  private recomputeFrameBudgets() {
    const rate = this.ctx?.sampleRate || TARGET_SAMPLE_RATE;
    const framesPerMs = rate / FRAME_SIZE / 1000;
    this.prerollFrames = Math.max(1, Math.round(PREROLL_MS * framesPerMs));
    this.hangoverFrames = Math.max(1, Math.round(HANGOVER_MS * framesPerMs));
    this.minSegmentFrames = Math.max(1, Math.round(this.options.minSpeechMs * framesPerMs));
    this.maxSegmentFrames = Math.max(2, Math.round(this.options.maxSpeechMs * framesPerMs));
  }

  private resetSegment() {
    this.segment = [];
    this.preroll = [];
    this.inSpeech = false;
    this.loudFrames = 0;
    this.quietFrames = 0;
    this.droppingRest = false;
  }

  private onFrame(input: Float32Array) {
    if (!this.running) return;

    // Copy: the callback reuses its buffer on the next frame.
    const frame = new Float32Array(input);
    let sumSquares = 0;
    for (let i = 0; i < frame.length; i++) sumSquares += frame[i] * frame[i];
    const rms = Math.sqrt(sumSquares / frame.length);

    // Adaptive threshold: the noise floor tracks the quiet parts of the room,
    // so a noisy café needs a louder voice rather than triggering constantly.
    const threshold = Math.max(this.noiseFloor * 3.2, 0.012);
    const loud = rms > threshold;

    if (!this.inSpeech) {
      this.noiseFloor = this.noiseFloor * 0.97 + Math.min(rms, 0.05) * 0.03;
      this.preroll.push(frame);
      if (this.preroll.length > this.prerollFrames) this.preroll.shift();

      this.loudFrames = loud ? this.loudFrames + 1 : 0;
      if (this.loudFrames >= ONSET_FRAMES) {
        this.inSpeech = true;
        this.quietFrames = 0;
        this.segment = [...this.preroll];
        this.preroll = [];
        this.callbacks.onSpeechStart?.();
      }
      return;
    }

    if (!this.droppingRest) this.segment.push(frame);
    this.quietFrames = loud ? 0 : this.quietFrames + 1;

    if (this.quietFrames >= this.hangoverFrames) {
      const frames = this.segment;
      const dropped = this.droppingRest;
      this.resetSegment();
      // The trailing silence is not speech — do not count it as length.
      if (!dropped && frames.length - this.hangoverFrames >= this.minSegmentFrames) {
        this.upload(frames);
      }
      return;
    }

    if (!this.droppingRest && this.segment.length >= this.maxSegmentFrames) {
      const frames = this.segment;
      this.segment = [];
      this.quietFrames = 0;
      this.droppingRest = this.options.overflow === "firstOnly";
      this.upload(frames);
    }
  }

  private budgetAllows(): boolean {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter((t) => now - t < 60_000);
    if (this.requestTimes.length >= this.options.maxRequestsPerMinute) return false;
    this.requestTimes.push(now);
    return true;
  }

  private async upload(frames: Float32Array[]) {
    if (this.disabled) return;
    if (this.inFlight >= MAX_IN_FLIGHT) {
      this.callbacks.onNotice?.("Skipped a phrase — still transcribing the previous one.");
      return;
    }
    if (!this.budgetAllows()) {
      this.callbacks.onNotice?.("Speech rate limit reached — waiting a moment.");
      return;
    }

    const rate = this.ctx?.sampleRate || TARGET_SAMPLE_RATE;
    const totalSamples = frames.reduce((sum, f) => sum + f.length, 0);
    const durationMs = Math.round((totalSamples / rate) * 1000);
    const wav = encodeWav(frames, rate);

    const params = new URLSearchParams();
    if (this.language) params.set("lang", this.language);
    if (this.options.roomId) params.set("roomId", this.options.roomId);
    const query = params.toString();

    this.inFlight++;
    try {
      const res = await fetch(`/api/ai-tutor/transcribe${query ? `?${query}` : ""}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "audio/wav" },
        body: wav,
      });

      if (res.status === 501) {
        this.giveUp("no transcription key configured");
        return;
      }
      if (!res.ok) {
        this.consecutiveFailures++;
        this.callbacks.onNotice?.(`Transcription failed (${res.status}).`);
        if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          this.giveUp(`transcription failing (${res.status})`);
        }
        return;
      }

      this.consecutiveFailures = 0;
      const data = (await res.json()) as { text?: string };
      const text = (data?.text || "").trim();
      if (text) this.callbacks.onTranscript(text, { durationMs });
    } catch (err: any) {
      this.consecutiveFailures++;
      this.callbacks.onNotice?.(`Transcription request failed: ${err?.message || "network"}`);
      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.giveUp("transcription unreachable");
      }
    } finally {
      this.inFlight--;
    }
  }

  /** Report once, then stay quiet until the caller starts the engine again. */
  private giveUp(reason: string) {
    if (this.disabled) return;
    this.disabled = true;
    this.callbacks.onUnavailable?.(reason);
  }
}

/** Asks the server whether a transcription key is configured. */
export async function fetchCloudSttAvailability(): Promise<boolean> {
  try {
    const res = await fetch("/api/ai-tutor/stt-config", { credentials: "include" });
    if (!res.ok) return false;
    const data = (await res.json()) as { available?: boolean };
    return !!data?.available;
  } catch {
    return false;
  }
}
