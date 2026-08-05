const STORAGE_KEY = "vextorn:hints:v1";

export type HintPayload = {
  id: string;
  title: string;
  body: string;
  anchor?: HTMLElement | null;
  durationMs?: number;
};

const EVENT_NAME = "vextorn:hint";

function readShownSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeShownSet(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

export function hasSeenHint(id: string): boolean {
  return readShownSet().has(id);
}

export function markHintSeen(id: string): void {
  const set = readShownSet();
  set.add(id);
  writeShownSet(set);
}

/**
 * Show a contextual hint the first time only. If the hint has been seen,
 * this is a no-op. Hints are dispatched via a CustomEvent that the
 * <ContextualHints /> host listens for.
 */
export function showHintOnce(payload: HintPayload): void {
  if (typeof window === "undefined") return;
  if (hasSeenHint(payload.id)) return;
  markHintSeen(payload.id);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
}

export function subscribeToHints(handler: (payload: HintPayload) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const ce = e as CustomEvent<HintPayload>;
    if (ce.detail) handler(ce.detail);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

export function resetAllHints(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
