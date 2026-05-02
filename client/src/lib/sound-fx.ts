const STORAGE_KEY = "vextorn:soundFx";
const EVENT = "vextorn:sound-fx-toggle";

let enabled = true;
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let unlocked = false;

if (typeof window !== "undefined") {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "0") enabled = false;
  } catch {
    /* ignore */
  }
}

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor: typeof AudioContext | undefined =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/**
 * Browsers require a user gesture before audio can play. Bind once-only
 * listeners that resume the AudioContext on the very first interaction.
 */
function attachUnlock() {
  if (typeof window === "undefined" || unlocked) return;
  const unlock = () => {
    unlocked = true;
    const c = ensureCtx();
    if (c && c.state === "suspended") c.resume().catch(() => {});
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
}
attachUnlock();

export function setSoundEnabled(value: boolean) {
  if (enabled === value) return;
  enabled = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { enabled: value } }));
}

export function isSoundEnabled() {
  return enabled;
}

export function onSoundEnabledChange(handler: (v: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent).detail?.enabled === true);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

type ToneOpts = {
  freq: number;
  /** seconds */
  duration?: number;
  /** target gain (0..1) before duration shapes it */
  gain?: number;
  type?: OscillatorType;
  /** optional pitch slide */
  endFreq?: number;
  /** seconds delay from "now" */
  startAt?: number;
  /** optional Q for the lowpass filter */
  filterQ?: number;
  filterFreq?: number;
};

function tone({
  freq,
  duration = 0.18,
  gain = 0.6,
  type = "sine",
  endFreq,
  startAt = 0,
  filterQ,
  filterFreq,
}: ToneOpts) {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime + startAt;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (endFreq != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  let last: AudioNode = osc;
  if (filterFreq != null) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    if (filterQ != null) f.Q.value = filterQ;
    last.connect(f);
    last = f;
  }
  last.connect(g);
  g.connect(masterGain);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function noiseBurst({
  duration = 0.06,
  gain = 0.18,
  startAt = 0,
  filterFreq = 1800,
  filterQ = 0.7,
}: { duration?: number; gain?: number; startAt?: number; filterFreq?: number; filterQ?: number } = {}) {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime + startAt;
  const length = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, length, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = filterFreq;
  f.Q.value = filterQ;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  src.connect(f);
  f.connect(g);
  g.connect(masterGain);
  src.start(now);
  src.stop(now + duration + 0.02);
}

/* ─────────────────────────────────────────────────────────────────
   PUBLIC SOUND PALETTE — small synth voices for UI feedback. Each
   one is composed from tone() + noise() so we don't ship audio files.
   ─────────────────────────────────────────────────────────────── */

function safe(fn: () => void) {
  if (!enabled) return;
  try {
    fn();
  } catch {
    /* ignore */
  }
}

/** Subtle micro-tap for buttons / toggles. */
export function sfxClick() {
  safe(() => {
    tone({ freq: 880, endFreq: 540, duration: 0.07, gain: 0.32, type: "sine", filterFreq: 4000 });
  });
}

/** Door knock — two warm wooden taps. */
export function sfxKnock() {
  safe(() => {
    noiseBurst({ duration: 0.07, gain: 0.30, filterFreq: 320, filterQ: 4 });
    tone({ freq: 220, endFreq: 110, duration: 0.10, gain: 0.30, type: "sine" });
    noiseBurst({ duration: 0.06, gain: 0.26, filterFreq: 320, filterQ: 4, startAt: 0.16 });
    tone({ freq: 200, endFreq: 100, duration: 0.10, gain: 0.26, type: "sine", startAt: 0.16 });
  });
}

/** Whoosh-up arpeggio — used when you successfully enter a room. */
export function sfxEnterRoom() {
  safe(() => {
    tone({ freq: 392, duration: 0.16, gain: 0.34, type: "triangle" });
    tone({ freq: 523, duration: 0.18, gain: 0.36, type: "triangle", startAt: 0.07 });
    tone({ freq: 784, duration: 0.22, gain: 0.40, type: "triangle", startAt: 0.16 });
    noiseBurst({ duration: 0.18, gain: 0.06, filterFreq: 5000, filterQ: 1.2 });
  });
}

/** Whoosh-down — leaving / closing a room. */
export function sfxLeaveRoom() {
  safe(() => {
    tone({ freq: 660, endFreq: 330, duration: 0.22, gain: 0.30, type: "triangle" });
    tone({ freq: 440, endFreq: 220, duration: 0.22, gain: 0.26, type: "triangle", startAt: 0.05 });
  });
}

/** Soft tick — fired when scrolling near the top/bottom edges. */
export function sfxScrollEdge() {
  safe(() => {
    tone({ freq: 1200, duration: 0.04, gain: 0.18, type: "sine", filterFreq: 4000 });
  });
}

/** Toggle on/off chirp — small pitch up for ON, pitch down for OFF. */
export function sfxToggle(on: boolean) {
  safe(() => {
    tone({
      freq: on ? 660 : 520,
      endFreq: on ? 990 : 330,
      duration: 0.10,
      gain: 0.30,
      type: "sine",
      filterFreq: 4500,
    });
  });
}

/** Incoming chat / DM ping — gentle two-note. */
export function sfxMessage() {
  safe(() => {
    tone({ freq: 880, duration: 0.10, gain: 0.28, type: "sine" });
    tone({ freq: 1318, duration: 0.12, gain: 0.30, type: "sine", startAt: 0.06 });
  });
}

/** Used when a knock is approved on the requester's side. */
export function sfxKnockAllowed() {
  safe(() => {
    tone({ freq: 523, duration: 0.10, gain: 0.30, type: "triangle" });
    tone({ freq: 784, duration: 0.14, gain: 0.34, type: "triangle", startAt: 0.06 });
    tone({ freq: 1046, duration: 0.18, gain: 0.36, type: "triangle", startAt: 0.14 });
  });
}

/** Used when a knock is denied on the requester's side. */
export function sfxKnockDenied() {
  safe(() => {
    tone({ freq: 330, endFreq: 220, duration: 0.22, gain: 0.30, type: "sawtooth", filterFreq: 1800 });
  });
}

/** Crisp three-note major arpeggio — successful save / create / publish. */
export function sfxSuccess() {
  safe(() => {
    tone({ freq: 587, duration: 0.10, gain: 0.30, type: "sine", filterFreq: 5000 });
    tone({ freq: 740, duration: 0.12, gain: 0.32, type: "sine", filterFreq: 5000, startAt: 0.06 });
    tone({ freq: 988, duration: 0.16, gain: 0.34, type: "triangle", filterFreq: 5500, startAt: 0.13 });
  });
}

/** Soft buzz — failed action / validation error. */
export function sfxError() {
  safe(() => {
    tone({ freq: 280, endFreq: 180, duration: 0.18, gain: 0.30, type: "square", filterFreq: 900, filterQ: 1.4 });
    tone({ freq: 240, endFreq: 150, duration: 0.18, gain: 0.22, type: "sawtooth", filterFreq: 900, startAt: 0.04 });
  });
}

/** Whoosh-up — a panel/dialog opens. */
export function sfxOpen() {
  safe(() => {
    tone({ freq: 330, endFreq: 660, duration: 0.16, gain: 0.22, type: "sine", filterFreq: 3500 });
    noiseBurst({ duration: 0.10, gain: 0.04, filterFreq: 4200 });
  });
}

/** Whoosh-down — a panel/dialog closes. */
export function sfxClose() {
  safe(() => {
    tone({ freq: 660, endFreq: 330, duration: 0.14, gain: 0.20, type: "sine", filterFreq: 3500 });
  });
}

/** Pluck — outgoing message sent. */
export function sfxSend() {
  safe(() => {
    tone({ freq: 740, endFreq: 1480, duration: 0.10, gain: 0.28, type: "triangle", filterFreq: 5000 });
    noiseBurst({ duration: 0.04, gain: 0.04, filterFreq: 5500 });
  });
}

/** Two-up sparkle — followed someone / favorited. */
export function sfxFollow() {
  safe(() => {
    tone({ freq: 660, duration: 0.09, gain: 0.28, type: "triangle" });
    tone({ freq: 990, duration: 0.12, gain: 0.32, type: "triangle", startAt: 0.05 });
  });
}

/** Two-down — unfollowed / removed. */
export function sfxUnfollow() {
  safe(() => {
    tone({ freq: 660, duration: 0.09, gain: 0.24, type: "sine" });
    tone({ freq: 440, duration: 0.10, gain: 0.22, type: "sine", startAt: 0.05 });
  });
}

/** Quick affirm tap — like / heart / reaction. */
export function sfxLike() {
  safe(() => {
    tone({ freq: 1200, endFreq: 1600, duration: 0.06, gain: 0.20, type: "sine", filterFreq: 6000 });
  });
}

/** Soft pop — uploaded / attached. */
export function sfxUpload() {
  safe(() => {
    noiseBurst({ duration: 0.05, gain: 0.10, filterFreq: 1200 });
    tone({ freq: 540, endFreq: 880, duration: 0.10, gain: 0.26, type: "triangle", startAt: 0.02 });
  });
}

/** Soft chime — generic info / arrived notification. */
export function sfxNotify() {
  safe(() => {
    tone({ freq: 1046, duration: 0.12, gain: 0.26, type: "sine" });
    tone({ freq: 1318, duration: 0.16, gain: 0.28, type: "sine", startAt: 0.07 });
  });
}

/** Trash whoosh — destructive delete confirmed. */
export function sfxDelete() {
  safe(() => {
    noiseBurst({ duration: 0.18, gain: 0.10, filterFreq: 900, filterQ: 0.9 });
    tone({ freq: 220, endFreq: 110, duration: 0.18, gain: 0.20, type: "sawtooth", filterFreq: 1200 });
  });
}
