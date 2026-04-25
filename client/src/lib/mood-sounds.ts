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

type ToneOpts = { freq: number; type?: OscillatorType; dur: number; gain?: number; attack?: number; release?: number; slideTo?: number; delay?: number };
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
  osc.start(t0);
  osc.stop(t0 + atk + rel + 0.02);
}

function noiseBurst(opts: { dur: number; gain?: number; filterFreq?: number; delay?: number }) {
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
  filt.type = "bandpass";
  filt.frequency.value = opts.filterFreq || 1200;
  const g = ac.createGain();
  g.gain.value = opts.gain ?? 0.18;
  src.connect(filt).connect(g).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + opts.dur + 0.02);
}

export function playMoodSound(emoji: string) {
  switch (emoji) {
    case "❤️":
      tone({ freq: 880, type: "sine", dur: 0.18, gain: 0.16 });
      tone({ freq: 1320, type: "sine", dur: 0.22, gain: 0.13, delay: 0.07 });
      break;
    case "👍":
      tone({ freq: 660, type: "triangle", dur: 0.10, gain: 0.18 });
      tone({ freq: 990, type: "triangle", dur: 0.10, gain: 0.14, delay: 0.06 });
      break;
    case "👏":
      noiseBurst({ dur: 0.06, gain: 0.32, filterFreq: 2400 });
      noiseBurst({ dur: 0.06, gain: 0.30, filterFreq: 2200, delay: 0.10 });
      noiseBurst({ dur: 0.06, gain: 0.28, filterFreq: 2600, delay: 0.20 });
      break;
    case "😴":
      tone({ freq: 220, type: "sawtooth", dur: 0.55, gain: 0.16, slideTo: 90, attack: 0.18, release: 0.32 });
      tone({ freq: 180, type: "sine", dur: 0.45, gain: 0.10, slideTo: 80, attack: 0.18, release: 0.22, delay: 0.55 });
      break;
    case "😂":
      tone({ freq: 700, type: "square", dur: 0.07, gain: 0.10 });
      tone({ freq: 850, type: "square", dur: 0.07, gain: 0.10, delay: 0.10 });
      tone({ freq: 700, type: "square", dur: 0.07, gain: 0.10, delay: 0.20 });
      tone({ freq: 850, type: "square", dur: 0.07, gain: 0.10, delay: 0.30 });
      break;
    case "😡":
      tone({ freq: 110, type: "sawtooth", dur: 0.30, gain: 0.20, slideTo: 60 });
      noiseBurst({ dur: 0.20, gain: 0.10, filterFreq: 200 });
      break;
    case "🤔":
      tone({ freq: 320, type: "sine", dur: 0.35, gain: 0.14, slideTo: 240, attack: 0.05, release: 0.28 });
      break;
    case "🎉":
      noiseBurst({ dur: 0.10, gain: 0.34, filterFreq: 3200 });
      tone({ freq: 660, type: "triangle", dur: 0.08, gain: 0.14, delay: 0.02 });
      tone({ freq: 990, type: "triangle", dur: 0.08, gain: 0.14, delay: 0.06 });
      tone({ freq: 1320, type: "triangle", dur: 0.10, gain: 0.13, delay: 0.10 });
      break;
    case "🤯":
      tone({ freq: 260, type: "sawtooth", dur: 0.18, gain: 0.22, slideTo: 60 });
      noiseBurst({ dur: 0.30, gain: 0.20, filterFreq: 800 });
      break;
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
