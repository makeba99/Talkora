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
      speak("Thank you!", { rate: 0.85, pitch: 1.1, volume: 0.85 });
      break;

    // ── Approval ──
    case "👍":
      speak("Yeah!", { rate: 1.1, pitch: 1.1, volume: 0.9 });
      break;
    case "👎":
      speak("Nah.", { rate: 0.8, pitch: 0.75, volume: 0.85 });
      break;
    case "💯":
      speak("That's perfect!", { rate: 1.1, pitch: 1.2, volume: 0.9 });
      break;

    // ── Applause / celebration ──
    case "👏":
      noiseBurst({ dur: 0.06, gain: 0.32, filterFreq: 2400 });
      noiseBurst({ dur: 0.06, gain: 0.30, filterFreq: 2200, delay: 0.10 });
      noiseBurst({ dur: 0.06, gain: 0.28, filterFreq: 2600, delay: 0.20 });
      noiseBurst({ dur: 0.06, gain: 0.26, filterFreq: 2300, delay: 0.30 });
      speak("Woo!", { rate: 1.2, pitch: 1.3, volume: 0.6, delay: 0.25 });
      break;
    case "🎉":
      speak("Woohoo!", { rate: 1.3, pitch: 1.35, volume: 0.95 });
      noiseBurst({ dur: 0.10, gain: 0.28, filterFreq: 3200, delay: 0.3 });
      arp([660, 990, 1320, 1760], 0.05, { type: "triangle", gain: 0.11, attack: 0.005, release: 0.08 });
      break;
    case "🥳":
      speak("Let's go!", { rate: 1.2, pitch: 1.25, volume: 0.95 });
      noiseBurst({ dur: 0.08, gain: 0.18, filterFreq: 4000, delay: 0.4 });
      break;
    case "🔥":
      speak("Fire!", { rate: 1.3, pitch: 1.1, volume: 0.9 });
      noiseBurst({ dur: 0.18, gain: 0.18, filterFreq: 1800, filterType: "highpass" });
      noiseBurst({ dur: 0.10, gain: 0.12, filterFreq: 2400, delay: 0.12 });
      break;
    case "🚀":
      speak("Blast off!", { rate: 1.1, pitch: 1.0, volume: 0.9 });
      tone({ freq: 120, type: "sawtooth", dur: 0.55, gain: 0.18, slideTo: 1200, attack: 0.02, release: 0.50 });
      noiseBurst({ dur: 0.55, gain: 0.08, filterFreq: 600, filterType: "lowpass" });
      break;

    // ── Laughter — real human ha-ha-ha ──
    case "😂":
      speak("Ha ha ha ha ha!", { rate: 1.35, pitch: 1.28, volume: 0.88 });
      speak("No way!", { rate: 1.2, pitch: 1.2, volume: 0.72, delay: 0.45 });
      break;
    case "🤣":
      speak("I can't breathe!", { rate: 1.35, pitch: 1.22, volume: 0.88 });
      speak("Hahaha!", { rate: 1.55, pitch: 1.4, volume: 0.78, delay: 0.38 });
      break;
    case "😆":
      speak("Hee hee hee!", { rate: 1.35, pitch: 1.45, volume: 0.82 });
      speak("That's so funny!", { rate: 1.15, pitch: 1.18, volume: 0.72, delay: 0.42 });
      break;
    case "😁":
      speak("Haha, yes!", { rate: 1.2, pitch: 1.25, volume: 0.88 });
      break;
    case "😹":
      speak("Meee-owww!", { rate: 1.05, pitch: 1.35, volume: 0.86 });
      speak("Ha ha!", { rate: 1.35, pitch: 1.3, volume: 0.84, delay: 0.35 });
      break;
    case "🙂":
      speak("Mm-hm.", { rate: 0.9, pitch: 1.0, volume: 0.78 });
      break;
    case "😬":
      speak("Oooof.", { rate: 0.85, pitch: 0.9, volume: 0.72 });
      break;

    // ── Surprise ──
    case "😮":
      speak("Oh!", { rate: 0.85, pitch: 1.4, volume: 0.95 });
      speak("Whoa!", { rate: 1.0, pitch: 1.25, volume: 0.85, delay: 0.28 });
      break;
    case "😱":
      speak("Oh my god!", { rate: 0.9, pitch: 1.5, volume: 0.98 });
      speak("No way!", { rate: 1.0, pitch: 1.35, volume: 0.88, delay: 0.32 });
      break;
    case "🤯":
      speak("What?!", { rate: 1.1, pitch: 1.4, volume: 0.98 });
      noiseBurst({ dur: 0.20, gain: 0.14, filterFreq: 800, delay: 0.5 });
      break;

    // ── Thoughtful / annoyed ──
    case "🤔":
      speak("Hmm...", { rate: 0.75, pitch: 0.9, volume: 0.85 });
      speak("Interesting.", { rate: 0.85, pitch: 1.0, volume: 0.75, delay: 0.3 });
      break;
    case "🙄":
      speak("Ugh...", { rate: 0.7, pitch: 0.8, volume: 0.85 });
      speak("Really?", { rate: 0.85, pitch: 0.95, volume: 0.78, delay: 0.25 });
      break;

    // ── Sleepy — real snore / yawn ──
    case "😴":
      speak("Snore... snore...", { rate: 0.36, pitch: 0.4, volume: 0.72 });
      speak("Zzz...", { rate: 0.32, pitch: 0.35, volume: 0.62, delay: 0.42 });
      break;
    case "🥱":
      speak("Yaaawn...", { rate: 0.34, pitch: 0.72, volume: 0.72 });
      speak("Too sleepy...", { rate: 0.55, pitch: 0.8, volume: 0.62, delay: 0.38 });
      break;
    case "💤":
      speak("Snore...", { rate: 0.33, pitch: 0.38, volume: 0.68 });
      break;

    // ── Anger — real human growl voice ──
    case "😡":
      speak("Grr!", { rate: 0.75, pitch: 0.55, volume: 0.84 });
      speak("Hey!", { rate: 0.9, pitch: 0.7, volume: 0.72, delay: 0.28 });
      break;
    case "🤬":
      speak("Argh!", { rate: 0.8, pitch: 0.50, volume: 0.88 });
      speak("No!", { rate: 0.88, pitch: 0.6, volume: 0.78, delay: 0.25 });
      noiseBurst({ dur: 0.18, gain: 0.12, filterFreq: 300, filterType: "lowpass", delay: 0.5 });
      break;

    // ── Funny / silly ──
    case "🤡":
      speak("Boing!", { rate: 1.2, pitch: 1.6, volume: 0.8 });
      speak("Clown mode!", { rate: 1.1, pitch: 1.45, volume: 0.7, delay: 0.34 });
      break;
    case "💩":
      speak("Oof!", { rate: 1.0, pitch: 0.8, volume: 0.74 });
      speak("Ew!", { rate: 1.1, pitch: 1.0, volume: 0.68, delay: 0.28 });
      break;
    case "👻":
      speak("Booo!", { rate: 0.65, pitch: 0.65, volume: 0.78 });
      speak("Wooo!", { rate: 0.7, pitch: 0.8, volume: 0.68, delay: 0.35 });
      break;
    case "🤖":
      speak("Bee boo boop.", { rate: 0.9, pitch: 0.6, volume: 0.78 });
      speak("Not a robot.", { rate: 0.95, pitch: 0.7, volume: 0.68, delay: 0.3 });
      break;
    case "🐸":
      speak("Ribbit!", { rate: 0.85, pitch: 0.65, volume: 0.76 });
      speak("Funny frog.", { rate: 0.95, pitch: 0.9, volume: 0.68, delay: 0.3 });
      break;
    case "🦄":
      speak("Yay!", { rate: 1.3, pitch: 1.6, volume: 0.8 });
      arp([784, 988, 1175, 1568, 1976], 0.05, { type: "triangle", gain: 0.09, release: 0.18 });
      break;

    // ── Greeting / hand ──
    case "✋":
      speak("Stop!", { rate: 1.0, pitch: 1.1, volume: 0.76 });
      break;
    case "👋":
      speak("Hey!", { rate: 1.0, pitch: 1.2, volume: 0.76 });
      break;

    default:
      tone({ freq: 660, type: "sine", dur: 0.12, gain: 0.08 });
      tone({ freq: 880, type: "sine", dur: 0.14, gain: 0.06, delay: 0.08 });
  }
}
