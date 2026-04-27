const BG_PAUSE_EVENT = "vextorn:bg-pause";
const YT_ACTIVE_EVENT = "vextorn:yt-active";
const BOOST_EVENT = "vextorn:boost-mode";
const BOOST_KEY = "vextorn:boostMode";

let bgPaused = false;
let ytActive = false;
let boostMode = false;

if (typeof window !== "undefined") {
  try {
    boostMode = window.localStorage.getItem(BOOST_KEY) === "1";
  } catch {
    boostMode = false;
  }
  if (boostMode) {
    bgPaused = true;
    document.documentElement.classList.add("boost-mode");
  }
}

export function setBackgroundPaused(paused: boolean) {
  if (bgPaused === paused) return;
  bgPaused = paused;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BG_PAUSE_EVENT, { detail: { paused } }));
  }
}

export function isBackgroundPaused() {
  return bgPaused;
}

export function onBackgroundPauseChange(handler: (paused: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent).detail?.paused === true);
  window.addEventListener(BG_PAUSE_EVENT, listener);
  return () => window.removeEventListener(BG_PAUSE_EVENT, listener);
}

export function setYoutubeActive(active: boolean) {
  if (ytActive === active) return;
  ytActive = active;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(YT_ACTIVE_EVENT, { detail: { active } }));
  }
  setBackgroundPaused(active || boostMode);
}

export function isYoutubeActive() {
  return ytActive;
}

export function onYoutubeActiveChange(handler: (active: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent).detail?.active === true);
  window.addEventListener(YT_ACTIVE_EVENT, listener);
  return () => window.removeEventListener(YT_ACTIVE_EVENT, listener);
}

/* ──────────────────────────────────────────────────────────────
   Boost Mode — explicit user-triggered low-power mode (mostly
   useful on phones / older devices). When enabled:
   • the animated background is fully paused
   • a `boost-mode` class is added to <html>, which CSS uses to
     disable hologram videos, blurs, parallax, and other heavy
     visual effects throughout the app.
   ────────────────────────────────────────────────────────────── */
export function setBoostMode(enabled: boolean) {
  if (boostMode === enabled) return;
  boostMode = enabled;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(BOOST_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle("boost-mode", enabled);
    window.dispatchEvent(new CustomEvent(BOOST_EVENT, { detail: { enabled } }));
  }
  // When boost is on, pause the bg. When off, only unpause if YT isn't active.
  setBackgroundPaused(enabled || ytActive);
}

export function isBoostMode() {
  return boostMode;
}

export function onBoostModeChange(handler: (enabled: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent).detail?.enabled === true);
  window.addEventListener(BOOST_EVENT, listener);
  return () => window.removeEventListener(BOOST_EVENT, listener);
}
