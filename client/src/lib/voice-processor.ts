export type VoicePresetId =
  | "natural"
  | "deep"
  | "bright"
  | "warm"
  | "radio"
  | "bass"
  | "cold";

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
  filters: FilterConfig[];
}

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: "natural",
    label: "Natural",
    description: "Your real voice, unmodified",
    emoji: "🎙️",
    filters: [],
  },
  {
    id: "deep",
    label: "Deep",
    description: "Fuller, more resonant tone",
    emoji: "🔊",
    filters: [
      { type: "lowshelf", frequency: 200, gain: 7 },
      { type: "peaking", frequency: 380, gain: 4, Q: 1.2 },
      { type: "highshelf", frequency: 4000, gain: -5 },
    ],
  },
  {
    id: "bright",
    label: "Bright",
    description: "Crisp, clear and present",
    emoji: "✨",
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
    filters: [
      { type: "lowshelf", frequency: 200, gain: 3 },
      { type: "peaking", frequency: 600, gain: 2, Q: 1 },
      { type: "lowpass", frequency: 5500, gain: 0, Q: 0.8 },
    ],
  },
  {
    id: "radio",
    label: "Radio",
    description: "Classic broadcast sound",
    emoji: "📻",
    filters: [
      { type: "highpass", frequency: 300, gain: 0, Q: 0.9 },
      { type: "peaking", frequency: 1200, gain: 8, Q: 1.2 },
      { type: "lowpass", frequency: 3400, gain: 0, Q: 0.9 },
    ],
  },
  {
    id: "bass",
    label: "Bass",
    description: "Bold and powerful",
    emoji: "🎸",
    filters: [
      { type: "lowshelf", frequency: 150, gain: 9 },
      { type: "peaking", frequency: 300, gain: 5, Q: 1 },
      { type: "highshelf", frequency: 3000, gain: -3 },
    ],
  },
  {
    id: "cold",
    label: "Cold",
    description: "Icy deep, hollow & raw",
    emoji: "❄️",
    filters: [
      { type: "lowshelf", frequency: 100, gain: 10 },
      { type: "peaking", frequency: 250, gain: 6, Q: 0.8 },
      { type: "peaking", frequency: 900, gain: -6, Q: 1.4 },
      { type: "highshelf", frequency: 5000, gain: -7 },
    ],
  },
];

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

/**
 * Routes a raw microphone MediaStream through a chain of BiquadFilterNodes
 * and outputs a processed MediaStream suitable for WebRTC's replaceTrack().
 *
 * Lifecycle: create once per AudioContext, call process() to rewire on preset
 * change, call destroy() on unmount.
 */
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
   * Returns the same destination stream every time (stable reference for WebRTC).
   */
  process(rawStream: MediaStream, presetId: VoicePresetId): MediaStream {
    const preset = VOICE_PRESETS.find((p) => p.id === presetId) ?? VOICE_PRESETS[0];
    this.reconnect(rawStream, preset.filters);
    return this.destination.stream;
  }

  private reconnect(rawStream: MediaStream, filterConfigs: FilterConfig[]) {
    try { this.source?.disconnect(); } catch {}
    this.filters.forEach((f) => { try { f.disconnect(); } catch {} });
    this.filters = [];

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
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
  }
}
