const BG_PAUSE_EVENT = "vextorn:bg-pause";
const YT_ACTIVE_EVENT = "vextorn:yt-active";

let bgPaused = false;
let ytActive = false;

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
  setBackgroundPaused(active);
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
