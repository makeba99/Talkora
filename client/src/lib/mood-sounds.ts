let sharedCtx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sharedCtx) {
      const Ctor: typeof AudioContext | undefined =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      sharedCtx = new Ctor();
    }
    if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
    return sharedCtx;
  } catch {
    return null;
  }
}

type ToneOpts = {
  freq: number;
  type?: OscillatorType;
  dur: number;
  gain?: number;
  attack?: number;
  release?: number;
  slideTo?: number;
  delay?: number;
  vibrato?: { rate: number; depth: number };
};
function tone(o: ToneOpts) {
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime + (o.delay || 0);
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = o.type || "sine";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, o.slideTo), t0 + o.dur);
  const peak = (o.gain ?? 0.18);
  const atk = o.attack ?? 0.005;
  const rel = o.release ?? Math.max(0.04, o.dur - atk);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + atk + rel);
  osc.connect(g).connect(ac.destination);
  if (o.vibrato) {
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    lfo.frequency.value = o.vibrato.rate;
    lfoGain.gain.value = o.vibrato.depth;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + atk + rel + 0.02);
  }
  osc.start(t0);
  osc.stop(t0 + atk + rel + 0.02);
}

function noiseBurst(opts: { dur: number; gain?: number; filterFreq?: number; delay?: number; filterType?: BiquadFilterType }) {
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime + (opts.delay || 0);
  const len = Math.floor(ac.sampleRate * opts.dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filt = ac.createBiquadFilter();
  filt.type = opts.filterType || "bandpass";
  filt.frequency.value = opts.filterFreq || 1200;
  const g = ac.createGain();
  g.gain.value = opts.gain ?? 0.18;
  src.connect(filt).connect(g).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + opts.dur + 0.02);
}

// Quick chord helper — fires several tones simultaneously to make richer sounds.
function chord(freqs: number[], opts: Omit<ToneOpts, "freq">) {
  freqs.forEach((f) => tone({ ...opts, freq: f }));
}

// Plays an ascending or descending arpeggio.
function arp(freqs: number[], stepDur: number, opts: Omit<ToneOpts, "freq" | "dur" | "delay"> = {}) {
  freqs.forEach((f, i) => tone({ ...opts, freq: f, dur: stepDur * 1.4, delay: i * stepDur }));
}

export function playMoodSound(emoji: string) {
  switch (emoji) {
    // ── Hearts & affection ──
    case "❤️":
      tone({ freq: 880, type: "sine", dur: 0.18, gain: 0.16 });
      tone({ freq: 1320, type: "sine", dur: 0.22, gain: 0.13, delay: 0.07 });
      break;
    case "🙏":
      // soft bell-like chime
      chord([523, 659, 784], { type: "sine", dur: 0.6, gain: 0.10, attack: 0.02, release: 0.55 });
      break;

    // ── Approval ──
    case "👍":
      tone({ freq: 660, type: "triangle", dur: 0.10, gain: 0.18 });
      tone({ freq: 990, type: "triangle", dur: 0.10, gain: 0.14, delay: 0.06 });
      break;
    case "👎":
      tone({ freq: 330, type: "sawtooth", dur: 0.18, gain: 0.18, slideTo: 110 });
      break;
    case "💯":
      arp([523, 659, 784, 1047], 0.07, { type: "square", gain: 0.13, attack: 0.005, release: 0.10 });
      break;

    // ── Applause / celebration ──
    case "👏":
      noiseBurst({ dur: 0.06, gain: 0.32, filterFreq: 2400 });
      noiseBurst({ dur: 0.06, gain: 0.30, filterFreq: 2200, delay: 0.10 });
      noiseBurst({ dur: 0.06, gain: 0.28, filterFreq: 2600, delay: 0.20 });
      noiseBurst({ dur: 0.06, gain: 0.26, filterFreq: 2300, delay: 0.30 });
      break;
    case "🎉":
      noiseBurst({ dur: 0.10, gain: 0.34, filterFreq: 3200 });
      arp([660, 990, 1320, 1760], 0.05, { type: "triangle", gain: 0.13, attack: 0.005, release: 0.08 });
      break;
    case "🥳":
      // little party-horn slide + sparkle
      tone({ freq: 440, type: "sawtooth", dur: 0.25, gain: 0.16, slideTo: 880, attack: 0.02, release: 0.20 });
      noiseBurst({ dur: 0.08, gain: 0.18, filterFreq: 4000, delay: 0.18 });
      arp([784, 988, 1175], 0.06, { type: "triangle", gain: 0.12, release: 0.08 });
      break;
    case "🔥":
      // crackling fire
      noiseBurst({ dur: 0.18, gain: 0.18, filterFreq: 1800, filterType: "highpass" });
      noiseBurst({ dur: 0.10, gain: 0.14, filterFreq: 2400, delay: 0.12 });
      noiseBurst({ dur: 0.08, gain: 0.10, filterFreq: 3000, delay: 0.22 });
      break;
    case "🚀":
      // launch whoosh going up
      tone({ freq: 120, type: "sawtooth", dur: 0.55, gain: 0.20, slideTo: 1200, attack: 0.02, release: 0.50 });
      noiseBurst({ dur: 0.55, gain: 0.10, filterFreq: 600, filterType: "lowpass" });
      break;

    // ── Laughter (funny) ──
    case "😂":
      tone({ freq: 700, type: "square", dur: 0.07, gain: 0.10 });
      tone({ freq: 850, type: "square", dur: 0.07, gain: 0.10, delay: 0.10 });
      tone({ freq: 700, type: "square", dur: 0.07, gain: 0.10, delay: 0.20 });
      tone({ freq: 850, type: "square", dur: 0.07, gain: 0.10, delay: 0.30 });
      break;
    case "🤣":
      // longer rolling laugh
      [0, 0.09, 0.18, 0.27, 0.36, 0.45, 0.54].forEach((d, i) => {
        tone({ freq: i % 2 ? 920 : 720, type: "square", dur: 0.07, gain: 0.10, delay: d });
      });
      break;
    case "😆":
      // quick giggles
      [0, 0.08, 0.16].forEach((d, i) => {
        tone({ freq: 880 + i * 80, type: "triangle", dur: 0.06, gain: 0.12, delay: d });
      });
      break;

    // ── Surprise ──
    case "😮":
      tone({ freq: 440, type: "sine", dur: 0.30, gain: 0.16, slideTo: 880, attack: 0.05, release: 0.22 });
      break;
    case "😱":
      // scream-ish slide up
      tone({ freq: 660, type: "sawtooth", dur: 0.50, gain: 0.18, slideTo: 1760, attack: 0.02, release: 0.45, vibrato: { rate: 18, depth: 40 } });
      break;
    case "🤯":
      tone({ freq: 260, type: "sawtooth", dur: 0.18, gain: 0.22, slideTo: 60 });
      noiseBurst({ dur: 0.30, gain: 0.20, filterFreq: 800 });
      break;

    // ── Thoughtful / annoyed ──
    case "🤔":
      tone({ freq: 320, type: "sine", dur: 0.35, gain: 0.14, slideTo: 240, attack: 0.05, release: 0.28 });
      break;
    case "🙄":
      // slow descending sigh
      tone({ freq: 480, type: "triangle", dur: 0.45, gain: 0.13, slideTo: 220, attack: 0.06, release: 0.40 });
      break;

    // ── Sleepy ──
    case "😴":
      tone({ freq: 220, type: "sawtooth", dur: 0.55, gain: 0.16, slideTo: 90, attack: 0.18, release: 0.32 });
      tone({ freq: 180, type: "sine", dur: 0.45, gain: 0.10, slideTo: 80, attack: 0.18, release: 0.22, delay: 0.55 });
      break;
    case "🥱":
      // big yawn slide
      tone({ freq: 180, type: "sawtooth", dur: 0.80, gain: 0.16, slideTo: 320, attack: 0.20, release: 0.55, vibrato: { rate: 4, depth: 6 } });
      break;

    // ── Anger ──
    case "😡":
      tone({ freq: 110, type: "sawtooth", dur: 0.30, gain: 0.20, slideTo: 60 });
      noiseBurst({ dur: 0.20, gain: 0.10, filterFreq: 200 });
      break;
    case "🤬":
      // censored beep
      tone({ freq: 1000, type: "square", dur: 0.30, gain: 0.20 });
      break;

    // ── Funny / silly ──
    case "🤡":
      // honk honk
      tone({ freq: 320, type: "square", dur: 0.18, gain: 0.20, slideTo: 220, attack: 0.01, release: 0.15 });
      tone({ freq: 320, type: "square", dur: 0.18, gain: 0.20, slideTo: 220, attack: 0.01, release: 0.15, delay: 0.22 });
      break;
    case "💩":
      // squelchy plop
      tone({ freq: 440, type: "sine", dur: 0.18, gain: 0.18, slideTo: 80, attack: 0.005, release: 0.16 });
      noiseBurst({ dur: 0.10, gain: 0.10, filterFreq: 300, filterType: "lowpass", delay: 0.12 });
      break;
    case "👻":
      // spooky woo
      tone({ freq: 220, type: "sine", dur: 0.55, gain: 0.16, slideTo: 440, attack: 0.10, release: 0.45, vibrato: { rate: 7, depth: 18 } });
      break;
    case "🤖":
      // robot bleep-bloop
      tone({ freq: 440, type: "square", dur: 0.08, gain: 0.16 });
      tone({ freq: 660, type: "square", dur: 0.08, gain: 0.16, delay: 0.10 });
      tone({ freq: 220, type: "square", dur: 0.10, gain: 0.16, delay: 0.20 });
      break;
    case "🐸":
      // ribbit
      tone({ freq: 180, type: "sawtooth", dur: 0.10, gain: 0.20, slideTo: 90 });
      tone({ freq: 200, type: "sawtooth", dur: 0.12, gain: 0.20, slideTo: 100, delay: 0.18 });
      break;
    case "🦄":
      // sparkly magical chord
      arp([784, 988, 1175, 1568, 1976], 0.05, { type: "triangle", gain: 0.10, release: 0.18 });
      break;

    // ── Greeting / hand ──
    case "✋":
      tone({ freq: 1480, type: "sine", dur: 0.16, gain: 0.16 });
      break;
    case "👋":
      tone({ freq: 540, type: "triangle", dur: 0.22, gain: 0.14, slideTo: 880, attack: 0.02, release: 0.18 });
      break;

    default:
      tone({ freq: 660, type: "sine", dur: 0.12, gain: 0.14 });
  }
}
