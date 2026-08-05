import { useEffect, useRef, useState } from "react";

const LS_PREFIX = "vextorn:room-tab:";
const SS_TAB_ID_KEY = "vextorn:tab-id";
const HEARTBEAT_INTERVAL_MS = 8_000;
const STALE_THRESHOLD_MS = HEARTBEAT_INTERVAL_MS + 5_000; // 13s — tab is gone if silent this long

interface TabLock {
  tabId: string;
  ts: number;
  userId: string;
}

function getLockKey(roomId: string, userId: string) {
  return `${LS_PREFIX}${roomId}:${userId}`;
}

function getOrCreateTabId(): string {
  let id = sessionStorage.getItem(SS_TAB_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SS_TAB_ID_KEY, id);
  }
  return id;
}

function readLock(key: string): TabLock | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as TabLock;
  } catch {
    return null;
  }
}

function writeLock(key: string, tabId: string, userId: string) {
  try {
    const entry: TabLock = { tabId, ts: Date.now(), userId };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage full or blocked — fail open (let the user in)
  }
}

function clearLock(key: string, tabId: string) {
  try {
    const existing = readLock(key);
    // Only clear if we own the lock — don't evict the new owner
    if (existing?.tabId === tabId) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

function isStale(lock: TabLock): boolean {
  return Date.now() - lock.ts > STALE_THRESHOLD_MS;
}

export type TabGuardStatus = "checking" | "owner" | "duplicate";

/**
 * Manages a per-room, per-user localStorage lock so only one browser tab can
 * actively own a room session at a time.
 *
 * Returns:
 *  - "checking"  — initial render, result not yet known
 *  - "owner"     — this tab owns the lock; safe to render VoiceRoom
 *  - "duplicate" — another tab already holds the lock; block this tab
 */
export function useRoomTabGuard(
  roomId: string | undefined,
  userId: string | undefined,
): TabGuardStatus {
  const [status, setStatus] = useState<TabGuardStatus>("checking");
  const tabIdRef = useRef<string>("");
  const lockKeyRef = useRef<string>("");
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!roomId || !userId) return;

    const tabId = getOrCreateTabId();
    const lockKey = getLockKey(roomId, userId);
    tabIdRef.current = tabId;
    lockKeyRef.current = lockKey;

    const existing = readLock(lockKey);

    if (existing && existing.tabId !== tabId && !isStale(existing)) {
      // Another live tab owns this room — block this one
      setStatus("duplicate");
      return;
    }

    // Claim (or reclaim after stale orphan) the lock
    writeLock(lockKey, tabId, userId);
    setStatus("owner");

    // Heartbeat — keeps our lock fresh so other tabs know we're alive
    heartbeatRef.current = setInterval(() => {
      // Re-check: another tab could have stolen the lock (shouldn't happen in
      // normal flow, but guard against rapid successive opens)
      const current = readLock(lockKey);
      if (current && current.tabId !== tabId) {
        // We lost the lock — become duplicate
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        setStatus("duplicate");
        return;
      }
      writeLock(lockKey, tabId, userId);
    }, HEARTBEAT_INTERVAL_MS);

    // Cross-tab storage event — fires in every tab EXCEPT the writer.
    // If our lock key changes, another tab is trying to join the same room.
    // We are the owner so we don't need to do anything, but we can log it.
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== lockKey) return;
      if (!e.newValue) return; // our own beforeunload cleared it

      try {
        const incoming = JSON.parse(e.newValue) as TabLock;
        if (incoming.tabId === tabId) return; // our own write (shouldn't fire, but guard)

        // Another tab just wrote to our lock key — it will see the heartbeat
        // we refresh next cycle, or our current value, and detect the duplicate.
        // Nothing to do here from the owner's side.
      } catch {
        // ignore parse errors
      }
    };

    window.addEventListener("storage", handleStorage);

    const handleBeforeUnload = () => {
      clearLock(lockKey, tabId);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearLock(lockKey, tabId);
    };
  }, [roomId, userId]);

  return status;
}
