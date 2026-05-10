// ── Vextorn Audio Engine ──────────────────────────────────────────────────────
//
// Production-grade real-time audio pipeline for WebRTC microphone processing.
//
// Full chain (all stages optional, applied in order):
//   Mic Source
//     → [NoiseGate worklet]          ← enabled by noiseCancellationEnabled
//     → [80Hz high-pass filter]      ← enabled by enhancementEnabled
//     → [DynamicsCompressor]         ← enabled by enhancementEnabled
//     → [makeup gain]                ← enabled by enhancementEnabled
//     → [brick-wall limiter]         ← enabled by enhancementEnabled
//     → [PitchShift worklet]         ← enabled when preset has pitch != 1
//     → [RingMod gain + oscillator]  ← enabled when preset has ringmod
//     → [WaveShaper distortion]      ← enabled when preset has distortion
//     → [BiquadFilter chain]         ← enabled when preset has filters
//     → [LevelMeter worklet]         ← always active, pass-through
//   Destination (stable WebRTC track)
//
// All three AudioWorkletProcessors live in one inline blob module so no
// extra file is needed and cross-origin loading is never an issue.

// ── Combined AudioWorklet module (one blob, three processors) ─────────────────

const WORKLET_MODULE_SRC = `
// ─── Noise Gate ───────────────────────────────────────────────────────────────
// RMS-envelope follower with independent attack and release times.
// Silences audio when the signal stays below threshold.
class VextornNoiseGate extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: 0.018, minValue: 0.0, maxValue: 0.5, automationRate: 'k-rate' },
      { name: 'attack',    defaultValue: 0.004, minValue: 0.001, maxValue: 0.5, automationRate: 'k-rate' },
      { name: 'release',   defaultValue: 0.14,  minValue: 0.01,  maxValue: 2.0, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.gain = 0.0;
  }
  process(inputs, outputs, params) {
    const inp = inputs[0]?.[0];
    const out = outputs[0]?.[0];
    if (!inp || !out) return true;
    const thresh     = params.threshold[0];
    const sr         = sampleRate; // AudioWorklet global
    const attackCoef = 1 - Math.exp(-1 / (params.attack[0]  * sr));
    const relCoef    = 1 - Math.exp(-1 / (params.release[0] * sr));
    for (let i = 0; i < inp.length; i++) {
      const target = Math.abs(inp[i]) > thresh ? 1.0 : 0.0;
      const coef   = target > this.gain ? attackCoef : relCoef;
      this.gain   += coef * (target - this.gain);
      out[i]       = inp[i] * this.gain;
    }
    return true;
  }
}
registerProcessor('vextorn-noise-gate', VextornNoiseGate);

// ─── Level Meter (non-destructive pass-through) ───────────────────────────────
// Computes RMS + peak, posts { rms, peak } to the main thread every ~18 ms.
class VextornLevelMeter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.peak   = 0.0;
    this.decay  = 0.9996;
    this.ticker = 0;
  }
  process(inputs, outputs) {
    const inp = inputs[0]?.[0];
    const out = outputs[0]?.[0];
    if (!inp) return true;
    if (out) out.set(inp);
    let sumSq = 0, blkPk = 0;
    for (let i = 0; i < inp.length; i++) {
      sumSq += inp[i] * inp[i];
      const a = Math.abs(inp[i]);
      if (a > blkPk) blkPk = a;
    }
    const rms = Math.sqrt(sumSq / inp.length);
    this.peak  = blkPk > this.peak ? blkPk : this.peak * this.decay;
    if (++this.ticker >= 14) {
      this.ticker = 0;
      this.port.postMessage({ rms, peak: this.peak });
    }
    return true;
  }
}
registerProcessor('vextorn-level-meter', VextornLevelMeter);

// ─── Pitch Shifter ────────────────────────────────────────────────────────────
// Circular-buffer resampling: advancing read faster than write raises pitch;
// slower lowers it.  Lag control keeps latency bounded (~quarter-buffer).
class VextornPitchShift extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'pitch', defaultValue: 1.0, minValue: 0.1, maxValue: 4.0, automationRate: 'k-rate' }];
  }
  constructor() {
    super();
    this.BUF      = 65536;
    this.MASK     = this.BUF - 1;
    this.buf      = new Float32Array(this.BUF);
    this.writeIdx = this.BUF >> 1;
    this.readPos  = 0.0;
  }
  process(inputs, outputs, parameters) {
    const inp   = inputs[0]?.[0];
    const out   = outputs[0]?.[0];
    if (!inp || !out) return true;
    const pitch = parameters.pitch[0] ?? 1.0;
    for (let i = 0; i < inp.length; i++) {
      this.buf[this.writeIdx & this.MASK] = inp[i];
      this.writeIdx++;
      const r0 = (this.readPos | 0);
      const f  = this.readPos - r0;
      const s0 = this.buf[ r0      & this.MASK];
      const s1 = this.buf[(r0 + 1) & this.MASK];
      out[i] = s0 + f * (s1 - s0);
      this.readPos += pitch;
      const lag = this.writeIdx - this.readPos;
      if (lag > this.BUF * 0.75) this.readPos = this.writeIdx - (this.BUF >> 2);
      if (lag < this.BUF * 0.08) this.readPos = this.writeIdx - (this.BUF >> 2);
    }
    return true;
  }
}
registerProcessor('vextorn-pitch', VextornPitchShift);
`;

// ── Worklet registration ──────────────────────────────────────────────────────

const _workletCtxs = new WeakSet<AudioContext>();
let _workletBlobUrl: string | null = null;

async function ensureWorklets(ctx: AudioContext): Promise<void> {
  if (_workletCtxs.has(ctx)) return;
  if (!_workletBlobUrl) {
    const blob = new Blob([WORKLET_MODULE_SRC], { type: "application/javascript" });
    _workletBlobUrl = URL.createObjectURL(blob);
  }
  await ctx.audioWorklet.addModule(_workletBlobUrl);
  _workletCtxs.add(ctx);
}

// ── DSP curve helpers ─────────────────────────────────────────────────────────

/** Soft knee limiter curve: linear up to 0.75, then smoothly clamps to 1.0. */
function makeLimiterCurve(): Float32Array {
  const n = 512;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    const a = Math.abs(x);
    const s = x < 0 ? -1 : 1;
    if (a < 0.75) {
      curve[i] = x;
    } else {
      const excess = a - 0.75;
      curve[i] = s * (0.75 + 0.25 * (1 - Math.exp(-excess / 0.18)));
    }
  }
  return curve;
}

/** Hard-clip + tanh distortion curve for voice FX. */
function makeDistortionCurve(drive: number): Float32Array {
  const n = 512;
  const curve = new Float32Array(n);
  const k = Math.max(1, drive);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type VoicePresetId =
  | "natural"
  | "chipmunk"
  | "baby"
  | "elf"
  | "fairy"
  | "witch"
  | "giant"
  | "ogre"
  | "troll"
  | "demon"
  | "devil"
  | "monster"
  | "robot"
  | "cyborg"
  | "android"
  | "alien"
  | "ghost"
  | "phantom"
  | "wizard"
  | "villain"
  | "pirate"
  | "squirrel"
  | "vampire";

export type VoicePresetCategory = "natural" | "character";

interface FilterConfig {
  type: BiquadFilterType;
  frequency: number;
  gain: number;
  Q?: number;
}

interface DistortionConfig {
  drive: number;
  lowpass?: number;
}

export interface VoicePreset {
  id: VoicePresetId;
  label: string;
  emoji: string;
  category: VoicePresetCategory;
  pitch?: number;
  ringmod?: number;
  distortion?: DistortionConfig;
  filters?: FilterConfig[];
}

// ── Presets ───────────────────────────────────────────────────────────────────

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: "natural",
    label: "Natural",
    emoji: "🎙️",
    category: "natural",
  },
  {
    id: "chipmunk",
    label: "Chipmunk",
    emoji: "🐿️",
    category: "character",
    pitch: 1.8,
  },
  {
    id: "squirrel",
    label: "Squirrel",
    emoji: "🦔",
    category: "character",
    pitch: 2.1,
  },
  {
    id: "baby",
    label: "Baby",
    emoji: "👶",
    category: "character",
    pitch: 2.0,
    filters: [
      { type: "highshelf", frequency: 3500, gain: 5 },
    ],
  },
  {
    id: "elf",
    label: "Elf",
    emoji: "🧝",
    category: "character",
    pitch: 1.55,
    filters: [
      { type: "highshelf", frequency: 4000, gain: 5 },
    ],
  },
  {
    id: "fairy",
    label: "Fairy",
    emoji: "🧚",
    category: "character",
    pitch: 1.7,
    filters: [
      { type: "highshelf", frequency: 5000, gain: 6 },
    ],
  },
  {
    id: "witch",
    label: "Witch",
    emoji: "🧙‍♀️",
    category: "character",
    pitch: 1.25,
    ringmod: 40,
  },
  {
    id: "giant",
    label: "Giant",
    emoji: "🗿",
    category: "character",
    pitch: 0.58,
  },
  {
    id: "ogre",
    label: "Ogre",
    emoji: "👾",
    category: "character",
    pitch: 0.52,
    filters: [
      { type: "lowshelf", frequency: 200, gain: 8 },
    ],
  },
  {
    id: "troll",
    label: "Troll",
    emoji: "🧟",
    category: "character",
    pitch: 0.65,
    distortion: { drive: 15, lowpass: 3000 },
  },
  {
    id: "demon",
    label: "Demon",
    emoji: "👹",
    category: "character",
    pitch: 0.68,
    distortion: { drive: 28, lowpass: 2200 },
  },
  {
    id: "devil",
    label: "Devil",
    emoji: "😈",
    category: "character",
    pitch: 0.72,
    ringmod: 45,
  },
  {
    id: "vampire",
    label: "Vampire",
    emoji: "🧛",
    category: "character",
    pitch: 0.78,
    filters: [
      { type: "peaking", frequency: 700, gain: 5, Q: 1.2 },
      { type: "lowshelf", frequency: 180, gain: 4 },
    ],
  },
  {
    id: "monster",
    label: "Monster",
    emoji: "👻",
    category: "character",
    pitch: 0.45,
    distortion: { drive: 40, lowpass: 1800 },
  },
  {
    id: "robot",
    label: "Robot",
    emoji: "🤖",
    category: "character",
    ringmod: 65,
  },
  {
    id: "cyborg",
    label: "Cyborg",
    emoji: "🦾",
    category: "character",
    pitch: 1.1,
    ringmod: 80,
  },
  {
    id: "android",
    label: "Android",
    emoji: "🔩",
    category: "character",
    pitch: 0.95,
    filters: [
      { type: "bandpass", frequency: 2000, gain: 0, Q: 0.7 },
    ],
  },
  {
    id: "alien",
    label: "Alien",
    emoji: "👽",
    category: "character",
    pitch: 1.35,
    ringmod: 130,
  },
  {
    id: "ghost",
    label: "Ghost",
    emoji: "👁️",
    category: "character",
    pitch: 0.88,
    filters: [
      { type: "lowpass", frequency: 900, gain: 0, Q: 1.2 },
    ],
  },
  {
    id: "phantom",
    label: "Phantom",
    emoji: "🌫️",
    category: "character",
    pitch: 0.78,
    filters: [
      { type: "lowpass", frequency: 600, gain: 0, Q: 1.6 },
    ],
  },
  {
    id: "wizard",
    label: "Wizard",
    emoji: "🧙",
    category: "character",
    pitch: 0.78,
    filters: [
      { type: "peaking", frequency: 800, gain: 5, Q: 1.3 },
    ],
  },
  {
    id: "villain",
    label: "Villain",
    emoji: "🦹",
    category: "character",
    pitch: 0.75,
    distortion: { drive: 18, lowpass: 3500 },
  },
  {
    id: "pirate",
    label: "Pirate",
    emoji: "🏴‍☠️",
    category: "character",
    pitch: 0.82,
    filters: [
      { type: "bandpass", frequency: 1500, gain: 0, Q: 0.8 },
      { type: "highshelf", frequency: 4000, gain: 3 },
    ],
  },
];

// ── Persistence ───────────────────────────────────────────────────────────────

const LS_KEY = "vextorn:voice-preset";

export function getSavedVoicePresetId(): VoicePresetId {
  try {
    const saved = localStorage.getItem(LS_KEY) as VoicePresetId | null;
    if (saved && VOICE_PRESETS.some((p) => p.id === saved)) return saved;
  } catch {}
  return "natural";
}

export function saveVoicePresetId(id: VoicePresetId): void {
  try { localStorage.setItem(LS_KEY, id); } catch {}
}

// ── Effect chain builder ──────────────────────────────────────────────────────

async function buildEffectChain(
  ctx: AudioContext,
  preset: VoicePreset,
  inputNode: AudioNode,
): Promise<{ tail: AudioNode; extras: AudioNode[] }> {
  let current: AudioNode = inputNode;
  const extras: AudioNode[] = [];

  if (preset.pitch != null && preset.pitch !== 1.0) {
    try {
      await ensureWorklets(ctx);
      const pn = new AudioWorkletNode(ctx, "vextorn-pitch", {
        parameterData: { pitch: preset.pitch },
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      current.connect(pn);
      current = pn;
      extras.push(pn);
    } catch (e) {
      console.warn("[AudioEngine] pitch worklet unavailable:", e);
    }
  }

  if (preset.ringmod != null) {
    const rg  = ctx.createGain();
    rg.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.frequency.value = preset.ringmod;
    osc.start();
    osc.connect(rg.gain);
    current.connect(rg);
    current = rg;
    extras.push(rg, osc);
  }

  if (preset.distortion != null) {
    const ws = ctx.createWaveShaper();
    ws.curve = makeDistortionCurve(preset.distortion.drive);
    ws.oversample = "4x";
    current.connect(ws);
    current = ws;
    extras.push(ws);
    if (preset.distortion.lowpass != null) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = preset.distortion.lowpass;
      current.connect(lp);
      current = lp;
      extras.push(lp);
    }
  }

  if (preset.filters && preset.filters.length > 0) {
    for (const cfg of preset.filters) {
      const f = ctx.createBiquadFilter();
      f.type = cfg.type;
      f.frequency.value = cfg.frequency;
      f.gain.value = cfg.gain ?? 0;
      if (cfg.Q != null) f.Q.value = cfg.Q;
      current.connect(f);
      current = f;
      extras.push(f);
    }
  }

  return { tail: current, extras };
}

// ── AudioEngine ───────────────────────────────────────────────────────────────

export class AudioEngine {
  private ctx: AudioContext;
  // NOTE: destination is intentionally re-created on every process() call.
  // A fresh MediaStreamAudioDestinationNode produces a fresh MediaStreamTrack.
  // This guarantees that RTCRtpSender.replaceTrack() is always a genuine swap
  // (not a no-op), so the WebRTC encoder immediately transmits audio from the
  // new effect graph.  Keeping a single stable destination caused replaceTrack()
  // to receive the same track object it was already sending, which the browser
  // silently ignored — leaving the old voice effect in place for remote peers.
  private destination!: MediaStreamAudioDestinationNode;
  private source: MediaStreamAudioSourceNode | null = null;
  private extraNodes: AudioNode[] = [];
  private meterNode: AudioWorkletNode | null = null;

  /** Called on each metering tick (~18 ms) with normalised 0–1 rms and peak. */
  onLevelMeter: ((rms: number, peak: number) => void) | null = null;

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;
  }

  /**
   * Build / rebuild the full audio pipeline with a fresh destination node.
   * Returns a NEW MediaStream on every call — always pass it to replaceTrack().
   *
   * CRITICAL: async — awaits AudioContext.resume() before wiring nodes.
   */
  async process(
    rawStream: MediaStream,
    presetId: VoicePresetId,
    enhancementEnabled = true,
    noiseCancellationEnabled = true,
  ): Promise<MediaStream> {
    // ── Tear down existing graph ─────────────────────────────────────────────
    try { this.source?.disconnect(); } catch {}
    if (this.meterNode) {
      this.meterNode.port.onmessage = null;
      try { this.meterNode.disconnect(); } catch {}
      this.meterNode = null;
    }
    for (const n of this.extraNodes) { try { n.disconnect(); } catch {} }
    this.extraNodes = [];

    // ── Resume suspended context ─────────────────────────────────────────────
    if (this.ctx.state === "suspended") {
      try { await this.ctx.resume(); } catch (e) {
        console.error("[AudioEngine] resume() failed:", e);
      }
    }

    // ── Ensure worklets registered ───────────────────────────────────────────
    try { await ensureWorklets(this.ctx); } catch (e) {
      console.warn("[AudioEngine] worklet registration failed:", e);
    }

    // ── Fresh destination = fresh MediaStreamTrack ───────────────────────────
    // Creating a new node here is the critical fix: every call produces a
    // distinct track, so RTCRtpSender.replaceTrack() is never a no-op.
    this.destination = this.ctx.createMediaStreamDestination();

    this.source = this.ctx.createMediaStreamSource(rawStream);
    let current: AudioNode = this.source;

    // ── 1. Noise Gate ────────────────────────────────────────────────────────
    if (noiseCancellationEnabled && enhancementEnabled) {
      try {
        const gate = new AudioWorkletNode(this.ctx, "vextorn-noise-gate");
        current.connect(gate);
        current = gate;
        this.extraNodes.push(gate);
      } catch {}
    }

    // ── 2. Enhancement chain (EQ + compressor + limiter) ─────────────────────
    if (enhancementEnabled) {
      // High-pass: remove low-frequency rumble, HVAC, desk thumps
      const hp = this.ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 80;
      hp.Q.value = 0.7;
      current.connect(hp);
      current = hp;
      this.extraNodes.push(hp);

      // Presence boost: push clarity in the 2–4 kHz speech range
      const presence = this.ctx.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = 2800;
      presence.gain.value = 3;
      presence.Q.value = 1.4;
      current.connect(presence);
      current = presence;
      this.extraNodes.push(presence);

      // Broadcast compressor: evens out dynamics without pumping
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -26;  // dBFS — starts compressing at -26
      comp.knee.value       = 8;   // soft knee: gradual onset
      comp.ratio.value      = 4;   // 4:1 — natural, not squashed
      comp.attack.value     = 0.003; // 3 ms — catches transients cleanly
      comp.release.value    = 0.28;  // 280 ms — smooth tail
      current.connect(comp);
      current = comp;
      this.extraNodes.push(comp);

      // Makeup gain: restore perceived loudness after compression
      const makeup = this.ctx.createGain();
      makeup.gain.value = 1.6;
      current.connect(makeup);
      current = makeup;
      this.extraNodes.push(makeup);

      // Brick-wall limiter: prevents clipping at WebRTC output
      const limiter = this.ctx.createWaveShaper();
      limiter.curve = makeLimiterCurve();
      limiter.oversample = "4x";
      current.connect(limiter);
      current = limiter;
      this.extraNodes.push(limiter);
    }

    // ── 3. Voice effect chain ────────────────────────────────────────────────
    const preset = VOICE_PRESETS.find((p) => p.id === presetId) ?? VOICE_PRESETS[0];
    const hasEffects =
      preset.pitch != null ||
      preset.ringmod != null ||
      preset.distortion != null ||
      (preset.filters?.length ?? 0) > 0;

    if (hasEffects) {
      const { tail, extras } = await buildEffectChain(this.ctx, preset, current);
      this.extraNodes.push(...extras);
      current = tail;
    }

    // ── 4. Level meter (always, pass-through) ────────────────────────────────
    try {
      const meter = new AudioWorkletNode(this.ctx, "vextorn-level-meter", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      meter.port.onmessage = (e: MessageEvent<{ rms: number; peak: number }>) => {
        this.onLevelMeter?.(e.data.rms, e.data.peak);
      };
      current.connect(meter);
      current = meter;
      this.meterNode = meter;
    } catch {}

    current.connect(this.destination);
    return this.destination.stream;
  }

  destroy() {
    if (this.meterNode) {
      this.meterNode.port.onmessage = null;
      try { this.meterNode.disconnect(); } catch {}
      this.meterNode = null;
    }
    try { this.source?.disconnect(); } catch {}
    for (const n of this.extraNodes) { try { n.disconnect(); } catch {} }
    this.source = null;
    this.extraNodes = [];
  }
}

// Backward-compatible alias (voice-room.tsx imports VoiceProcessor)
export { AudioEngine as VoiceProcessor };

// ── Voice preview ─────────────────────────────────────────────────────────────

export async function previewVoicePreset(
  ctx: AudioContext,
  presetId: VoicePresetId,
): Promise<void> {
  if (ctx.state === "suspended") { try { await ctx.resume(); } catch {} }
  const preset = VOICE_PRESETS.find((p) => p.id === presetId) ?? VOICE_PRESETS[0];
  const now = ctx.currentTime;
  const dur = 0.6;

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = (preset.pitch ?? 1) > 1.2 ? 220 : 130;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.2, now + 0.04);
  env.gain.setValueAtTime(0.2, now + dur - 0.08);
  env.gain.linearRampToValueAtTime(0, now + dur);

  const hasProcessing =
    preset.pitch != null ||
    preset.ringmod != null ||
    preset.distortion != null ||
    (preset.filters?.length ?? 0) > 0;

  if (!hasProcessing) {
    osc.connect(env);
  } else {
    let curr: AudioNode = osc;
    if (preset.ringmod != null) {
      const rg  = ctx.createGain(); rg.gain.value = 0;
      const ro  = ctx.createOscillator();
      ro.frequency.value = preset.ringmod;
      ro.start(); ro.stop(now + dur + 0.1);
      ro.connect(rg.gain);
      curr.connect(rg); curr = rg;
    }
    if (preset.distortion != null) {
      const ws = ctx.createWaveShaper();
      ws.curve = makeDistortionCurve(preset.distortion.drive);
      ws.oversample = "4x";
      curr.connect(ws); curr = ws;
    }
    if (preset.filters?.length) {
      for (const cfg of preset.filters) {
        const f = ctx.createBiquadFilter();
        f.type = cfg.type; f.frequency.value = cfg.frequency;
        f.gain.value = cfg.gain ?? 0; if (cfg.Q != null) f.Q.value = cfg.Q;
        curr.connect(f); curr = f;
      }
    }
    curr.connect(env);
  }
  env.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur);
}

// ── Voice test ────────────────────────────────────────────────────────────────

export function testVoiceThroughPreset(
  rawStream: MediaStream,
  presetId: VoicePresetId,
  ctx: AudioContext,
  onState: (s: "recording" | "playing" | "done" | "error") => void,
): () => void {
  let cancelled = false;
  let recorder: MediaRecorder | null = null;
  let src: AudioBufferSourceNode | null = null;
  const cleanup = () => {
    cancelled = true;
    try { recorder?.stop(); } catch {}
    try { src?.stop(); } catch {}
  };
  (async () => {
    try {
      if (ctx.state === "suspended") { try { await ctx.resume(); } catch {} }
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";
      recorder = new MediaRecorder(rawStream, { mimeType: mime });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      onState("recording");
      recorder.start();
      await new Promise<void>((r) => setTimeout(r, 2000));
      if (cancelled) return;
      recorder.stop();
      await new Promise<void>((r) => { recorder!.onstop = () => r(); });
      if (cancelled) return;
      const buf = await ctx.decodeAudioData(await new Blob(chunks, { type: mime }).arrayBuffer());
      if (cancelled) return;
      const preset = VOICE_PRESETS.find((p) => p.id === presetId) ?? VOICE_PRESETS[0];
      src = ctx.createBufferSource();
      src.buffer = buf;
      if (preset.pitch != null) src.playbackRate.value = preset.pitch;
      const { tail } = await buildEffectChain(ctx, preset, src);
      tail.connect(ctx.destination);
      onState("playing");
      src.start();
      src.onended = () => { if (!cancelled) onState("done"); };
    } catch (e) {
      console.error("[AudioEngine] testVoice:", e);
      if (!cancelled) onState("error");
    }
  })();
  return cleanup;
}
