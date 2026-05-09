// ── Voice Processor ──────────────────────────────────────────────────────────
//
// Routes a raw microphone MediaStream through a configurable Web Audio API
// BiquadFilter chain before handing it to WebRTC's replaceTrack().
//
// Key design decisions:
//   • process() is async — it AWAITS AudioContext.resume() before wiring the
//     graph. Without this await, nodes are created while the context is still
//     suspended, producing silent audio (the most common failure mode on Chrome
//     and Safari which start every AudioContext in the "suspended" state until
//     a user-gesture callback explicitly resumes it).
//   • A single MediaStreamAudioDestinationNode is reused across preset changes
//     so the WebRTC sender's track reference stays stable — only the filter
//     chain in between is rewired.
//   • previewVoicePreset() plays a short formant-rich tone through a preset's
//     filter chain to the speakers so users can audition effects without
//     speaking a word.

export type VoicePresetId =
  | "natural"
  | "deep"
  | "bright"
  | "warm"
  | "radio"
  | "bass"
  | "cold"
  | "serious"
  | "soft"
  | "stage"
  | "robotic";

export type VoicePresetCategory = "natural" | "tone" | "style" | "effect";

interface FilterConfig {
  type: BiquadFilterType;
  frequency: number;
  gain: number;
  Q?: number;
}

export interface VoicePreset {
  id: VoicePresetId;
  label: string;
  description: string;
  emoji: string;
  category: VoicePresetCategory;
  filters: FilterConfig[];
}

export const VOICE_PRESETS: VoicePreset[] = [
  // ── Natural ────────────────────────────────────────────────────────────────
  {
    id: "natural",
    label: "Natural",
    description: "Your real voice",
    emoji: "🎙️",
    category: "natural",
    filters: [],
  },

  // ── Tone presets ───────────────────────────────────────────────────────────
  {
    id: "deep",
    label: "Deep",
    description: "Fuller, resonant",
    emoji: "🔊",
    category: "tone",
    filters: [
      { type: "lowshelf", frequency: 200, gain: 7 },
      { type: "peaking", frequency: 380, gain: 4, Q: 1.2 },
      { type: "highshelf", frequency: 4000, gain: -5 },
    ],
  },
  {
    id: "bright",
    label: "Bright",
    description: "Crisp and present",
    emoji: "✨",
    category: "tone",
    filters: [
      { type: "highpass", frequency: 120, gain: 0, Q: 0.7 },
      { type: "peaking", frequency: 2500, gain: 4, Q: 2 },
      { type: "highshelf", frequency: 5000, gain: 6 },
    ],
  },
  {
    id: "warm",
    label: "Warm",
    description: "Smooth and mellow",
    emoji: "🌅",
    category: "tone",
    filters: [
      { type: "lowshelf", frequency: 200, gain: 3 },
      { type: "peaking", frequency: 600, gain: 2, Q: 1 },
      { type: "lowpass", frequency: 5500, gain: 0, Q: 0.8 },
    ],
  },
  {
    id: "bass",
    label: "Bass",
    description: "Bold and powerful",
    emoji: "🎸",
    category: "tone",
    filters: [
      { type: "lowshelf", frequency: 150, gain: 9 },
      { type: "peaking", frequency: 300, gain: 5, Q: 1 },
      { type: "highshelf", frequency: 3000, gain: -3 },
    ],
  },

  // ── Style presets ──────────────────────────────────────────────────────────
  {
    id: "serious",
    label: "Serious",
    description: "Authoritative, focused",
    emoji: "🎩",
    category: "style",
    filters: [
      // Cut low rumble for clarity, add presence around speech fundamentals
      { type: "highpass", frequency: 150, gain: 0, Q: 0.9 },
      { type: "peaking", frequency: 1800, gain: 5, Q: 3 },
      { type: "peaking", frequency: 5000, gain: -2, Q: 1.5 },
    ],
  },
  {
    id: "soft",
    label: "Soft",
    description: "Gentle and intimate",
    emoji: "🌙",
    category: "style",
    filters: [
      // Remove harshness, add warmth and body
      { type: "lowshelf", frequency: 300, gain: 3 },
      { type: "peaking", frequency: 800, gain: 2, Q: 1.5 },
      { type: "lowpass", frequency: 4000, gain: 0, Q: 0.7 },
    ],
  },
  {
    id: "stage",
    label: "Stage",
    description: "Theatrical presence",
    emoji: "🎭",
    category: "style",
    filters: [
      // Big presence peak + air, reduce muddiness
      { type: "peaking", frequency: 400, gain: -3, Q: 1 },
      { type: "peaking", frequency: 2800, gain: 8, Q: 1.2 },
      { type: "highshelf", frequency: 8000, gain: 6 },
    ],
  },

  // ── Effect presets ─────────────────────────────────────────────────────────
  {
    id: "radio",
    label: "Radio",
    description: "Classic broadcast",
    emoji: "📻",
    category: "effect",
    filters: [
      { type: "highpass", frequency: 300, gain: 0, Q: 0.9 },
      { type: "peaking", frequency: 1200, gain: 8, Q: 1.2 },
      { type: "lowpass", frequency: 3400, gain: 0, Q: 0.9 },
    ],
  },
  {
    id: "cold",
    label: "Cold",
    description: "Icy, hollow and raw",
    emoji: "❄️",
    category: "effect",
    filters: [
      { type: "lowshelf", frequency: 100, gain: 10 },
      { type: "peaking", frequency: 250, gain: 6, Q: 0.8 },
      { type: "peaking", frequency: 900, gain: -6, Q: 1.4 },
      { type: "highshelf", frequency: 5000, gain: -7 },
    ],
  },
  {
    id: "robotic",
    label: "Robotic",
    description: "Metallic and synthetic",
    emoji: "🤖",
    category: "effect",
    filters: [
      // Hollow out the fundamental, create metallic resonance peaks
      { type: "lowshelf", frequency: 200, gain: -6 },
      { type: "peaking", frequency: 500, gain: 10, Q: 10 },
      { type: "peaking", frequency: 1000, gain: 10, Q: 10 },
      { type: "highshelf", frequency: 4000, gain: -10 },
    ],
  },
];

// ── Category metadata ─────────────────────────────────────────────────────────

export const PRESET_CATEGORIES: { id: VoicePresetCategory; label: string }[] = [
  { id: "natural", label: "Original" },
  { id: "tone",    label: "Tone" },
  { id: "style",   label: "Style" },
  { id: "effect",  label: "Effect" },
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
  try {
    localStorage.setItem(LS_KEY, id);
  } catch {}
}

// ── VoiceProcessor class ──────────────────────────────────────────────────────

export class VoiceProcessor {
  private ctx: AudioContext;
  private destination: MediaStreamAudioDestinationNode;
  private source: MediaStreamAudioSourceNode | null = null;
  private filters: BiquadFilterNode[] = [];

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;
    this.destination = this.ctx.createMediaStreamDestination();
  }

  /**
   * Wire rawStream through the preset's filter chain.
   * Returns the same stable destination stream every call — safe to hand to
   * WebRTC's replaceTrack() once and then rewire on subsequent preset changes.
   *
   * CRITICAL: This method is async and AWAITS AudioContext.resume().
   * Do NOT remove the await — without it, nodes wired on a "suspended" context
   * are silently created but produce zero audio output.
   */
  async process(rawStream: MediaStream, presetId: VoicePresetId): Promise<MediaStream> {
    const preset = VOICE_PRESETS.find((p) => p.id === presetId) ?? VOICE_PRESETS[0];
    await this._reconnect(rawStream, preset.filters);
    return this.destination.stream;
  }

  private async _reconnect(rawStream: MediaStream, filterConfigs: FilterConfig[]) {
    // Tear down existing graph completely before rewiring.
    // node.disconnect() with no args removes ALL outgoing connections.
    try { this.source?.disconnect(); } catch {}
    this.filters.forEach((f) => { try { f.disconnect(); } catch {} });
    this.filters = [];

    // ── CRITICAL: Await resume before building the graph ──────────────────
    // AudioContext starts in "suspended" state on every browser until a
    // user-gesture handler explicitly resumes it.  If we wire nodes while
    // suspended, they're created without error but produce silent output.
    // This is by far the most common failure mode of the voice effects system.
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch (e) {
        console.error("[VoiceProcessor] AudioContext.resume() failed:", e);
      }
    }

    this.source = this.ctx.createMediaStreamSource(rawStream);

    if (filterConfigs.length === 0) {
      this.source.connect(this.destination);
      return;
    }

    const nodes = filterConfigs.map((cfg) => {
      const f = this.ctx.createBiquadFilter();
      f.type = cfg.type;
      f.frequency.value = cfg.frequency;
      f.gain.value = cfg.gain ?? 0;
      if (cfg.Q != null) f.Q.value = cfg.Q;
      return f;
    });

    this.filters = nodes;
    this.source.connect(nodes[0]);
    for (let i = 0; i < nodes.length - 1; i++) {
      nodes[i].connect(nodes[i + 1]);
    }
    nodes[nodes.length - 1].connect(this.destination);
  }

  destroy() {
    try { this.source?.disconnect(); } catch {}
    this.filters.forEach((f) => { try { f.disconnect(); } catch {} });
    this.source = null;
    this.filters = [];
  }
}

// ── Voice preview (tone auditioning) ─────────────────────────────────────────
//
// Plays a short sawtooth-wave burst (voice-like harmonic series) through a
// preset's filter chain so the user can hear the tonal character before
// committing.  Uses the AudioContext's speaker output, completely separate
// from the VoiceProcessor's mic→WebRTC pipeline.

export async function previewVoicePreset(
  ctx: AudioContext,
  presetId: VoicePresetId,
): Promise<void> {
  if (ctx.state === "suspended") {
    try { await ctx.resume(); } catch {}
  }

  const preset = VOICE_PRESETS.find((p) => p.id === presetId) ?? VOICE_PRESETS[0];
  const now = ctx.currentTime;
  const duration = 0.55;

  // A sawtooth wave at 160 Hz has the same harmonic density as a human voice
  // and demonstrates EQ changes clearly across all presets.
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 160;

  // Fade in / fade out to avoid clicks
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.25, now + 0.03);
  gain.gain.setValueAtTime(0.25, now + duration - 0.08);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  if (preset.filters.length === 0) {
    osc.connect(gain);
  } else {
    const nodes = preset.filters.map((cfg) => {
      const f = ctx.createBiquadFilter();
      f.type = cfg.type;
      f.frequency.value = cfg.frequency;
      f.gain.value = cfg.gain ?? 0;
      if (cfg.Q != null) f.Q.value = cfg.Q;
      return f;
    });
    osc.connect(nodes[0]);
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    nodes[nodes.length - 1].connect(gain);
  }

  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

// ── Voice test (record & play back through filter) ───────────────────────────
//
// Records ~2 s of the user's raw microphone, then decodes and plays the
// recording back through the current preset's filter chain so they hear
// exactly how their own voice will sound inside the room.
//
// Returns a cleanup function that the caller can invoke to abort early.

export function testVoiceThroughPreset(
  rawStream: MediaStream,
  presetId: VoicePresetId,
  ctx: AudioContext,
  onState: (state: "recording" | "playing" | "done" | "error") => void,
): () => void {
  let cancelled = false;
  let recorder: MediaRecorder | null = null;
  let source: AudioBufferSourceNode | null = null;

  const cleanup = () => {
    cancelled = true;
    try { recorder?.stop(); } catch {}
    try { source?.stop(); } catch {}
  };

  (async () => {
    try {
      if (ctx.state === "suspended") {
        try { await ctx.resume(); } catch {}
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      recorder = new MediaRecorder(rawStream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      onState("recording");
      recorder.start();

      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      if (cancelled) return;
      recorder.stop();
      await new Promise<void>((resolve) => { recorder!.onstop = () => resolve(); });
      if (cancelled) return;

      const blob = new Blob(chunks, { type: mimeType });
      const arrayBuffer = await blob.arrayBuffer();
      if (cancelled) return;

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      if (cancelled) return;

      const preset = VOICE_PRESETS.find((p) => p.id === presetId) ?? VOICE_PRESETS[0];
      source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const gain = ctx.createGain();
      gain.gain.value = 1.0;

      if (preset.filters.length === 0) {
        source.connect(gain);
      } else {
        const nodes = preset.filters.map((cfg) => {
          const f = ctx.createBiquadFilter();
          f.type = cfg.type;
          f.frequency.value = cfg.frequency;
          f.gain.value = cfg.gain ?? 0;
          if (cfg.Q != null) f.Q.value = cfg.Q;
          return f;
        });
        source.connect(nodes[0]);
        for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
        nodes[nodes.length - 1].connect(gain);
      }

      gain.connect(ctx.destination);
      onState("playing");
      source.start();
      source.onended = () => { if (!cancelled) onState("done"); };
    } catch (e) {
      console.error("[VoiceProcessor] testVoice error:", e);
      if (!cancelled) onState("error");
    }
  })();

  return cleanup;
}
