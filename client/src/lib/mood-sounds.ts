/* ─────────────────────────────────────────────────────────────────────────────
   mood-sounds.ts — Human-voice mood reactions using the Web Speech API
   All "voice-like" reactions (laugh, snore, anger, surprise, etc.) now speak
   real words through the browser's built-in speech synthesiser so they sound
   like actual people. Non-voice sounds (claps, rockets, fire) stay as
   synthesised WebAudio so they feel physical and immediate.
   ───────────────────────────────────────────────────────────────────────────── */

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

function arp(freqs: number[], stepDur: number, opts: Omit<ToneOpts, "freq" | "dur" | "delay"> = {}) {
  freqs.forEach((f, i) => tone({ ...opts, freq: f, dur: stepDur * 1.4, delay: i * stepDur }));
}

/* ─── Web Speech API — real human-like voice ────────────────────────────────
   Speaks text through the browser's native speech synthesiser. Falls back
   silently if the API isn't available (e.g. in some SSR / headless envs).
   ─────────────────────────────────────────────────────────────────────────── */
function speak(text: string, opts?: { rate?: number; pitch?: number; volume?: number; delay?: number }) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const run = () => {
    try {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate   = opts?.rate   ?? 1.0;
      utt.pitch  = opts?.pitch  ?? 1.0;
      utt.volume = opts?.volume ?? 0.9;
      window.speechSynthesis.speak(utt);
    } catch {}
  };
  if (opts?.delay) {
    setTimeout(run, opts.delay * 1000);
  } else {
    run();
  }
}

/* ─── Warm goodbye chime + real farewell voice ──────────────────────────── */
export function playSayByeSound() {
  const ac = ctx();
  if (ac) {
    const freqs = [880, 698, 523, 392];
    freqs.forEach((f, i) => {
      tone({ freq: f, type: "triangle", dur: 0.5, gain: 0.18, attack: 0.01, release: 0.46, delay: i * 0.10 });
    });
    tone({ freq: 1046, type: "sine", dur: 0.6, gain: 0.09, attack: 0.05, release: 0.52, delay: 0.42 });
  }
  speak("Bye bye!", { rate: 0.92, pitch: 1.15, volume: 0.85, delay: 0.2 });
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
      speak("Aww!", { rate: 0.9, pitch: 1.3, volume: 0.85 });
      tone({ freq: 880, type: "sine", dur: 0.18, gain: 0.12, delay: 0.2 });
      break;
    case "🙏":
      tone({ freq: 660, type: "sine", dur: 0.14, gain: 0.08 });
      tone({ freq: 990, type: "sine", dur: 0.16, gain: 0.07, delay: 0.09 });
      break;

    // ── Approval ──
    case "👍":
      tone({ freq: 740, type: "triangle", dur: 0.1, gain: 0.08 });
      tone({ freq: 988, type: "triangle", dur: 0.12, gain: 0.06, delay: 0.07 });
      break;
    case "👎":
      tone({ freq: 240, type: "sine", dur: 0.18, gain: 0.07 });
      break;
    case "💯":
      arp([660, 880, 990], 0.06, { type: "triangle", gain: 0.08, release: 0.08 });
      break;

    // ── Applause / celebration ──
    case "👏":
      noiseBurst({ dur: 0.06, gain: 0.32, filterFreq: 2400 });
      noiseBurst({ dur: 0.06, gain: 0.30, filterFreq: 2200, delay: 0.10 });
      noiseBurst({ dur: 0.06, gain: 0.28, filterFreq: 2600, delay: 0.20 });
      noiseBurst({ dur: 0.06, gain: 0.26, filterFreq: 2300, delay: 0.30 });
      tone({ freq: 880, type: "triangle", dur: 0.08, gain: 0.08, delay: 0.25 });
      break;
    case "🎉":
      noiseBurst({ dur: 0.10, gain: 0.28, filterFreq: 3200, delay: 0.3 });
      arp([660, 990, 1320, 1760], 0.05, { type: "triangle", gain: 0.11, attack: 0.005, release: 0.08 });
      break;
    case "🥳":
      arp([523, 659, 784, 1046], 0.05, { type: "triangle", gain: 0.09, release: 0.08 });
      noiseBurst({ dur: 0.08, gain: 0.18, filterFreq: 4000, delay: 0.4 });
      break;
    case "🔥":
      noiseBurst({ dur: 0.18, gain: 0.18, filterFreq: 1800, filterType: "highpass" });
      noiseBurst({ dur: 0.10, gain: 0.12, filterFreq: 2400, delay: 0.12 });
      break;
    case "🚀":
      tone({ freq: 120, type: "sawtooth", dur: 0.55, gain: 0.18, slideTo: 1200, attack: 0.02, release: 0.50 });
      noiseBurst({ dur: 0.55, gain: 0.08, filterFreq: 600, filterType: "lowpass" });
      break;

    // ── Laughter — real human ha-ha-ha ──
    case "😂":
      noiseBurst({ dur: 0.04, gain: 0.12, filterFreq: 1600 });
      tone({ freq: 880, type: "triangle", dur: 0.08, gain: 0.06, delay: 0.08 });
      tone({ freq: 1046, type: "triangle", dur: 0.08, gain: 0.06, delay: 0.16 });
      break;
    case "🤣":
      noiseBurst({ dur: 0.05, gain: 0.14, filterFreq: 1700 });
      arp([660, 880, 1100], 0.05, { type: "square", gain: 0.05, release: 0.06 });
      break;
    case "😆":
      tone({ freq: 930, type: "triangle", dur: 0.06, gain: 0.06 });
      tone({ freq: 1175, type: "triangle", dur: 0.06, gain: 0.05, delay: 0.08 });
      break;
    case "😁":
      tone({ freq: 784, type: "sine", dur: 0.08, gain: 0.07 });
      tone({ freq: 988, type: "sine", dur: 0.08, gain: 0.06, delay: 0.08 });
      break;
    case "😹":
      tone({ freq: 523, type: "triangle", dur: 0.08, gain: 0.06 });
      tone({ freq: 784, type: "triangle", dur: 0.08, gain: 0.05, delay: 0.08 });
      break;
    case "🙂":
      tone({ freq: 660, type: "sine", dur: 0.09, gain: 0.05 });
      break;
    case "😬":
      tone({ freq: 220, type: "sine", dur: 0.14, gain: 0.06 });
      break;

    // ── Surprise ──
    case "😮":
      tone({ freq: 784, type: "triangle", dur: 0.08, gain: 0.08 });
      tone({ freq: 1175, type: "triangle", dur: 0.10, gain: 0.06, delay: 0.12 });
      break;
    case "😱":
      tone({ freq: 988, type: "square", dur: 0.08, gain: 0.07 });
      noiseBurst({ dur: 0.14, gain: 0.10, filterFreq: 1400, delay: 0.06 });
      break;
    case "🤯":
      noiseBurst({ dur: 0.20, gain: 0.14, filterFreq: 800, delay: 0.5 });
      tone({ freq: 1320, type: "triangle", dur: 0.10, gain: 0.06, delay: 0.08 });
      break;

    // ── Thoughtful / annoyed ──
    case "🤔":
      tone({ freq: 440, type: "sine", dur: 0.12, gain: 0.05 });
      tone({ freq: 523, type: "sine", dur: 0.12, gain: 0.04, delay: 0.12 });
      break;
    case "🙄":
      tone({ freq: 180, type: "sine", dur: 0.12, gain: 0.05 });
      break;

    // ── Sleepy — real snore / yawn ──
    case "😴":
      tone({ freq: 140, type: "sine", dur: 0.16, gain: 0.04 });
      break;
    case "🥱":
      tone({ freq: 260, type: "sine", dur: 0.12, gain: 0.05 });
      tone({ freq: 220, type: "sine", dur: 0.14, gain: 0.04, delay: 0.1 });
      break;
    case "💤":
      tone({ freq: 120, type: "sine", dur: 0.18, gain: 0.04 });
      break;

    // ── Anger — real human growl voice ──
    case "😡":
      tone({ freq: 160, type: "sawtooth", dur: 0.14, gain: 0.06 });
      break;
    case "🤬":
      noiseBurst({ dur: 0.18, gain: 0.12, filterFreq: 300, filterType: "lowpass", delay: 0.5 });
      tone({ freq: 110, type: "sawtooth", dur: 0.16, gain: 0.06 });
      break;

    // ── Funny / silly ──
    case "🤡":
      arp([523, 784, 1046], 0.05, { type: "triangle", gain: 0.06, release: 0.05 });
      break;
    case "💩":
      tone({ freq: 180, type: "square", dur: 0.12, gain: 0.05 });
      break;
    case "👻":
      tone({ freq: 660, type: "sine", dur: 0.12, gain: 0.05 });
      tone({ freq: 880, type: "sine", dur: 0.14, gain: 0.04, delay: 0.1 });
      break;
    case "🤖":
      tone({ freq: 300, type: "square", dur: 0.08, gain: 0.05 });
      tone({ freq: 600, type: "square", dur: 0.08, gain: 0.05, delay: 0.08 });
      tone({ freq: 900, type: "square", dur: 0.08, gain: 0.04, delay: 0.16 });
      break;
    case "🐸":
      tone({ freq: 392, type: "square", dur: 0.08, gain: 0.05 });
      tone({ freq: 523, type: "square", dur: 0.08, gain: 0.04, delay: 0.1 });
      break;
    case "🦄":
      arp([784, 988, 1175, 1568, 1976], 0.05, { type: "triangle", gain: 0.09, release: 0.18 });
      break;

    // ── Greeting / hand ──
    case "✋":
      tone({ freq: 220, type: "sine", dur: 0.1, gain: 0.05 });
      break;
    case "👋":
      tone({ freq: 660, type: "triangle", dur: 0.08, gain: 0.05 });
      tone({ freq: 880, type: "triangle", dur: 0.08, gain: 0.04, delay: 0.08 });
      break;

    default:
      tone({ freq: 660, type: "sine", dur: 0.12, gain: 0.05 });
  }
}
