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

function chord(freqs: number[], opts: Omit<ToneOpts, "freq">) {
  freqs.forEach((f) => tone({ ...opts, freq: f }));
}

function arp(freqs: number[], stepDur: number, opts: Omit<ToneOpts, "freq" | "dur" | "delay"> = {}) {
  freqs.forEach((f, i) => tone({ ...opts, freq: f, dur: stepDur * 1.4, delay: i * stepDur }));
}

/* ─── Realistic laugh helper ────────────────────────────────────────────────
   Synthesises "ha-ha-ha" by alternating a short voiced pulse (sawtooth at
   speech fundamental ~180 Hz) with a breath-noise gap. Each "ha" has a tiny
   upward pitch slide so it sounds human rather than mechanical.
   ─────────────────────────────────────────────────────────────────────────── */
function laugh(syllables: number, rate: number, baseFreq = 180, gainPeak = 0.22) {
  const ac = ctx();
  if (!ac) return;
  for (let i = 0; i < syllables; i++) {
    const t0 = ac.currentTime + i * rate;
    const pitch = baseFreq + (Math.random() * 30 - 10);
    // Voiced "ha" — sawtooth with formant-like bandpass
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(pitch, t0);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.06, t0 + 0.08);
    const filt = ac.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 1100;
    filt.Q.value = 1.4;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.10);
    osc.connect(filt).connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.12);
    // Breathy aspiration noise after each syllable
    const len = Math.floor(ac.sampleRate * 0.05);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / len);
    const ns = ac.createBufferSource();
    ns.buffer = buf;
    const nf = ac.createBiquadFilter();
    nf.type = "highpass";
    nf.frequency.value = 2800;
    const ng = ac.createGain();
    ng.gain.value = 0.07;
    ns.connect(nf).connect(ng).connect(ac.destination);
    ns.start(t0 + 0.06);
    ns.stop(t0 + 0.11);
  }
}

/* ─── Realistic snore helper ─────────────────────────────────────────────────
   Models one snore cycle: an in-breath rattle then a quieter out-breath.
   ─────────────────────────────────────────────────────────────────────────── */
function snore(cycles: number, cycleLen = 0.9, startDelay = 0) {
  const ac = ctx();
  if (!ac) return;
  for (let i = 0; i < cycles; i++) {
    const t0 = ac.currentTime + startDelay + i * cycleLen;
    // In-breath: rising sawtooth rattle (noisy nasal vibration)
    const inOsc = ac.createOscillator();
    inOsc.type = "sawtooth";
    inOsc.frequency.setValueAtTime(80, t0);
    inOsc.frequency.exponentialRampToValueAtTime(140, t0 + 0.28);
    const inFilt = ac.createBiquadFilter();
    inFilt.type = "bandpass";
    inFilt.frequency.value = 700;
    inFilt.Q.value = 2.2;
    const inG = ac.createGain();
    inG.gain.setValueAtTime(0.0001, t0);
    inG.gain.exponentialRampToValueAtTime(0.28, t0 + 0.06);
    inG.gain.exponentialRampToValueAtTime(0.26, t0 + 0.22);
    inG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    inOsc.connect(inFilt).connect(inG).connect(ac.destination);
    inOsc.start(t0);
    inOsc.stop(t0 + 0.34);
    // Noise texture on in-breath
    const len1 = Math.floor(ac.sampleRate * 0.30);
    const nb1 = ac.createBuffer(1, len1, ac.sampleRate);
    const d1 = nb1.getChannelData(0);
    for (let j = 0; j < len1; j++) d1[j] = (Math.random() * 2 - 1) * Math.sin(Math.PI * j / len1);
    const ns1 = ac.createBufferSource();
    ns1.buffer = nb1;
    const nf1 = ac.createBiquadFilter();
    nf1.type = "bandpass";
    nf1.frequency.value = 600;
    nf1.Q.value = 1.8;
    const ng1 = ac.createGain();
    ng1.gain.value = 0.14;
    ns1.connect(nf1).connect(ng1).connect(ac.destination);
    ns1.start(t0 + 0.02);
    ns1.stop(t0 + 0.32);
    // Out-breath: quieter, lower, trailing off
    const outOsc = ac.createOscillator();
    outOsc.type = "sawtooth";
    outOsc.frequency.setValueAtTime(110, t0 + 0.40);
    outOsc.frequency.exponentialRampToValueAtTime(70, t0 + 0.72);
    const outFilt = ac.createBiquadFilter();
    outFilt.type = "bandpass";
    outFilt.frequency.value = 500;
    outFilt.Q.value = 1.6;
    const outG = ac.createGain();
    outG.gain.setValueAtTime(0.0001, t0 + 0.40);
    outG.gain.exponentialRampToValueAtTime(0.16, t0 + 0.46);
    outG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75);
    outOsc.connect(outFilt).connect(outG).connect(ac.destination);
    outOsc.start(t0 + 0.40);
    outOsc.stop(t0 + 0.77);
  }
}

/* ─── Realistic angry growl ──────────────────────────────────────────────────
   A vocal fry / chest growl: sub-harmonic buzz layered with a harsh
   sawtooth and shaped noise to simulate a tense, tightened throat.
   ─────────────────────────────────────────────────────────────────────────── */
function angryGrowl(intensity: number = 1) {
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime;
  // Sub-bass fundamental (vocal fry / chest resonance)
  const sub = ac.createOscillator();
  sub.type = "sawtooth";
  sub.frequency.setValueAtTime(60 * intensity, t0);
  sub.frequency.setValueAtTime(55 * intensity, t0 + 0.08);
  sub.frequency.setValueAtTime(65 * intensity, t0 + 0.18);
  sub.frequency.setValueAtTime(50 * intensity, t0 + 0.32);
  const subFilt = ac.createBiquadFilter();
  subFilt.type = "lowpass";
  subFilt.frequency.value = 600;
  const subG = ac.createGain();
  subG.gain.setValueAtTime(0.0001, t0);
  subG.gain.exponentialRampToValueAtTime(0.26 * intensity, t0 + 0.04);
  subG.gain.exponentialRampToValueAtTime(0.22 * intensity, t0 + 0.30);
  subG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.40);
  sub.connect(subFilt).connect(subG).connect(ac.destination);
  sub.start(t0);
  sub.stop(t0 + 0.42);
  // Harsh mid harmonic (vocal tract resonance)
  const mid = ac.createOscillator();
  mid.type = "sawtooth";
  mid.frequency.setValueAtTime(180, t0);
  mid.frequency.setValueAtTime(160, t0 + 0.20);
  const midFilt = ac.createBiquadFilter();
  midFilt.type = "bandpass";
  midFilt.frequency.value = 900;
  midFilt.Q.value = 2.8;
  const midG = ac.createGain();
  midG.gain.setValueAtTime(0.0001, t0);
  midG.gain.exponentialRampToValueAtTime(0.18 * intensity, t0 + 0.05);
  midG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
  mid.connect(midFilt).connect(midG).connect(ac.destination);
  mid.start(t0);
  mid.stop(t0 + 0.40);
  // Rough noise burst (the "grrr" texture)
  const len = Math.floor(ac.sampleRate * 0.36);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len) * 0.5;
  }
  const ns = ac.createBufferSource();
  ns.buffer = buf;
  const nf = ac.createBiquadFilter();
  nf.type = "bandpass";
  nf.frequency.value = 400;
  nf.Q.value = 1.2;
  const ng = ac.createGain();
  ng.gain.value = 0.10 * intensity;
  ns.connect(nf).connect(ng).connect(ac.destination);
  ns.start(t0 + 0.02);
  ns.stop(t0 + 0.38);
}

/* ─── Warm goodbye chime ──────────────────────────────────────────────────── */
export function playSayByeSound() {
  const ac = ctx();
  if (!ac) return;
  // Wave-shape: descending gentle arpeggio with a warm tail
  const freqs = [880, 698, 523, 392];
  freqs.forEach((f, i) => {
    tone({ freq: f, type: "triangle", dur: 0.5, gain: 0.20, attack: 0.01, release: 0.46, delay: i * 0.10 });
  });
  // Soft shimmer at the end
  tone({ freq: 1046, type: "sine", dur: 0.6, gain: 0.10, attack: 0.05, release: 0.52, delay: 0.42 });
}

/* ─── Departure sound (someone else left) ───────────────────────────────────
   Subtle, gentle "door closing" — not jarring so it doesn't interrupt speech.
   ─────────────────────────────────────────────────────────────────────────── */
export function playDepartureSound() {
  tone({ freq: 440, type: "sine", dur: 0.20, gain: 0.12, attack: 0.01, release: 0.17, slideTo: 280 });
  tone({ freq: 330, type: "sine", dur: 0.18, gain: 0.09, attack: 0.01, release: 0.15, slideTo: 220, delay: 0.06 });
}

export function playMoodSound(emoji: string) {
  switch (emoji) {
    // ── Hearts & affection ──
    case "❤️":
      tone({ freq: 880, type: "sine", dur: 0.18, gain: 0.16 });
      tone({ freq: 1320, type: "sine", dur: 0.22, gain: 0.13, delay: 0.07 });
      break;
    case "🙏":
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
      tone({ freq: 440, type: "sawtooth", dur: 0.25, gain: 0.16, slideTo: 880, attack: 0.02, release: 0.20 });
      noiseBurst({ dur: 0.08, gain: 0.18, filterFreq: 4000, delay: 0.18 });
      arp([784, 988, 1175], 0.06, { type: "triangle", gain: 0.12, release: 0.08 });
      break;
    case "🔥":
      noiseBurst({ dur: 0.18, gain: 0.18, filterFreq: 1800, filterType: "highpass" });
      noiseBurst({ dur: 0.10, gain: 0.14, filterFreq: 2400, delay: 0.12 });
      noiseBurst({ dur: 0.08, gain: 0.10, filterFreq: 3000, delay: 0.22 });
      break;
    case "🚀":
      tone({ freq: 120, type: "sawtooth", dur: 0.55, gain: 0.20, slideTo: 1200, attack: 0.02, release: 0.50 });
      noiseBurst({ dur: 0.55, gain: 0.10, filterFreq: 600, filterType: "lowpass" });
      break;

    // ── Laughter (funny) — now realistic "ha ha ha" ──
    case "😂":
      laugh(4, 0.13, 180, 0.22);
      break;
    case "🤣":
      // Rolling ROFL — starts restrained, builds, then dies off laughing
      laugh(3, 0.12, 160, 0.18);
      laugh(4, 0.10, 200, 0.24);
      laugh(3, 0.13, 175, 0.15);
      break;
    case "😆":
      // Higher-pitched giggles
      laugh(3, 0.10, 220, 0.18);
      break;

    // ── Surprise ──
    case "😮":
      tone({ freq: 440, type: "sine", dur: 0.30, gain: 0.16, slideTo: 880, attack: 0.05, release: 0.22 });
      break;
    case "😱":
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
      tone({ freq: 480, type: "triangle", dur: 0.45, gain: 0.13, slideTo: 220, attack: 0.06, release: 0.40 });
      break;

    // ── Sleepy — now realistic snoring ──
    case "😴":
      snore(2, 0.95, 0);
      break;
    case "🥱":
      // Big yawn: slow inhale sweep, then exhale
      tone({ freq: 160, type: "sawtooth", dur: 0.90, gain: 0.18, slideTo: 340, attack: 0.22, release: 0.62, vibrato: { rate: 4, depth: 8 } });
      noiseBurst({ dur: 0.40, gain: 0.08, filterFreq: 2200, filterType: "highpass", delay: 0.50 });
      tone({ freq: 260, type: "sine", dur: 0.45, gain: 0.10, slideTo: 160, attack: 0.05, release: 0.38, delay: 0.92 });
      break;

    // ── Anger — now realistic growl voice ──
    case "😡":
      angryGrowl(1.0);
      break;
    case "🤬":
      // Furious: louder multi-layered growl + a harsh censored-beep-like shriek
      angryGrowl(1.4);
      tone({ freq: 220, type: "sawtooth", dur: 0.22, gain: 0.20, slideTo: 180, delay: 0.08 });
      noiseBurst({ dur: 0.18, gain: 0.14, filterFreq: 300, filterType: "lowpass", delay: 0.05 });
      break;

    // ── Funny / silly ──
    case "🤡":
      tone({ freq: 320, type: "square", dur: 0.18, gain: 0.20, slideTo: 220, attack: 0.01, release: 0.15 });
      tone({ freq: 320, type: "square", dur: 0.18, gain: 0.20, slideTo: 220, attack: 0.01, release: 0.15, delay: 0.22 });
      break;
    case "💩":
      tone({ freq: 440, type: "sine", dur: 0.18, gain: 0.18, slideTo: 80, attack: 0.005, release: 0.16 });
      noiseBurst({ dur: 0.10, gain: 0.10, filterFreq: 300, filterType: "lowpass", delay: 0.12 });
      break;
    case "👻":
      tone({ freq: 220, type: "sine", dur: 0.55, gain: 0.16, slideTo: 440, attack: 0.10, release: 0.45, vibrato: { rate: 7, depth: 18 } });
      break;
    case "🤖":
      tone({ freq: 440, type: "square", dur: 0.08, gain: 0.16 });
      tone({ freq: 660, type: "square", dur: 0.08, gain: 0.16, delay: 0.10 });
      tone({ freq: 220, type: "square", dur: 0.10, gain: 0.16, delay: 0.20 });
      break;
    case "🐸":
      tone({ freq: 180, type: "sawtooth", dur: 0.10, gain: 0.20, slideTo: 90 });
      tone({ freq: 200, type: "sawtooth", dur: 0.12, gain: 0.20, slideTo: 100, delay: 0.18 });
      break;
    case "🦄":
      arp([784, 988, 1175, 1568, 1976], 0.05, { type: "triangle", gain: 0.10, release: 0.18 });
      break;

    // ── Greeting / hand ──
    case "✋":
      tone({ freq: 1480, type: "sine", dur: 0.16, gain: 0.16 });
      break;
    case "👋":
      // Warm wave sound
      tone({ freq: 540, type: "triangle", dur: 0.28, gain: 0.16, slideTo: 880, attack: 0.02, release: 0.24 });
      tone({ freq: 660, type: "sine", dur: 0.20, gain: 0.12, slideTo: 990, attack: 0.02, release: 0.16, delay: 0.12 });
      break;

    default:
      tone({ freq: 660, type: "sine", dur: 0.12, gain: 0.14 });
  }
}
