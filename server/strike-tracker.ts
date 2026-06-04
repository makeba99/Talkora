// ─── Vextorn Strike Tracker ────────────────────────────────────────────────────
// Three-strikes system: tracks filter violations per user and issues escalating
// penalties (warn → warn → auto-mute).  Purely in-memory; resets on restart
// (intentional — cleared slates after downtime).  Zero PII stored beyond userId
// and the matched term that was already logged by the content filter.
//
// Strike window  : 30 minutes  — strikes outside this window don't count
// Strikes 1-2    : Warning messages only (no block beyond the filter)
// Strike 3+      : Temporary mute (15 min → 1 hr → 24 hr, escalating)

const STRIKE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

// Escalating mute durations (index = muteCount before this one)
const MUTE_DURATIONS_MS = [
  15 * 60 * 1000,      // first mute  : 15 minutes
  60 * 60 * 1000,      // second mute : 1 hour
  24 * 60 * 60 * 1000, // third+ mute : 24 hours
];

export type StrikeAction = "warn1" | "warn2" | "mute";

export interface StrikeResult {
  action: StrikeAction;
  strikeCount: number;
  mutedUntil?: Date;
  message: string;
}

interface StrikeEntry {
  ts: number;
  term: string;
  surface: string;
}

interface UserRecord {
  userId: string;
  displayName: string;
  strikes: StrikeEntry[];
  muteCount: number;    // lifetime mute count (drives escalation)
  mutedUntil?: number;  // epoch ms; undefined = not muted
}

// ── In-memory store ────────────────────────────────────────────────────────────
const _store = new Map<string, UserRecord>();

function _getOrCreate(userId: string, displayName: string): UserRecord {
  let rec = _store.get(userId);
  if (!rec) {
    rec = { userId, displayName, strikes: [], muteCount: 0 };
    _store.set(userId, rec);
  } else {
    rec.displayName = displayName; // keep fresh
  }
  return rec;
}

function _recentStrikes(rec: UserRecord): StrikeEntry[] {
  const cutoff = Date.now() - STRIKE_WINDOW_MS;
  return rec.strikes.filter((s) => s.ts > cutoff);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Returns whether a user is currently muted and how long remains. */
export function isStrikeMuted(userId: string): {
  muted: boolean;
  until?: Date;
  minutesLeft?: number;
  message?: string;
} {
  const rec = _store.get(userId);
  if (!rec?.mutedUntil) return { muted: false };
  if (Date.now() >= rec.mutedUntil) {
    rec.mutedUntil = undefined;
    return { muted: false };
  }
  const msLeft = rec.mutedUntil - Date.now();
  const minutesLeft = Math.ceil(msLeft / 60_000);
  const until = new Date(rec.mutedUntil);
  const humanLeft =
    minutesLeft >= 60
      ? `${Math.ceil(minutesLeft / 60)} hour${Math.ceil(minutesLeft / 60) > 1 ? "s" : ""}`
      : `${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}`;
  return {
    muted: true,
    until,
    minutesLeft,
    message: `You are temporarily muted for ${humanLeft} due to repeated community guideline violations. You can send messages again at ${until.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
  };
}

/** Records a new violation and returns the resulting action + message. */
export function recordStrike(
  userId: string,
  displayName: string,
  matchedTerm: string,
  surface: string,
): StrikeResult {
  const rec = _getOrCreate(userId, displayName);
  rec.strikes.push({ ts: Date.now(), term: matchedTerm, surface });

  const recent = _recentStrikes(rec);
  const count = recent.length;

  if (count <= 1) {
    return {
      action: "warn1",
      strikeCount: count,
      message: `⚠️ Strike 1 of 3: This message was blocked for violating community guidelines. Two more violations within 30 minutes will result in a temporary mute.`,
    };
  }

  if (count === 2) {
    return {
      action: "warn2",
      strikeCount: count,
      message: `⚠️ Strike 2 of 3: Final warning. One more violation in the next 30 minutes will temporarily mute you from sending messages.`,
    };
  }

  // 3+ strikes → mute
  const idx = Math.min(rec.muteCount, MUTE_DURATIONS_MS.length - 1);
  const muteMs = MUTE_DURATIONS_MS[idx];
  rec.muteCount += 1;
  rec.mutedUntil = Date.now() + muteMs;

  const until = new Date(rec.mutedUntil);
  const mins = Math.round(muteMs / 60_000);
  const humanDur =
    mins >= 60
      ? `${mins / 60} hour${mins / 60 > 1 ? "s" : ""}`
      : `${mins} minute${mins !== 1 ? "s" : ""}`;

  console.warn(
    `[strike-tracker] AUTO-MUTE userId=${userId} displayName="${displayName}" ` +
    `muteCount=${rec.muteCount} duration=${humanDur} until=${until.toISOString()}`,
  );

  return {
    action: "mute",
    strikeCount: count,
    mutedUntil: until,
    message: `🔇 You have been muted for ${humanDur} after repeatedly violating community guidelines. You can resume sending messages at ${until.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
  };
}

/** Clears all strikes (and mute) for a user — called by admin. */
export function clearUserStrikes(userId: string): void {
  const rec = _store.get(userId);
  if (rec) {
    rec.strikes = [];
    rec.mutedUntil = undefined;
  }
}

/** Removes only the active mute, leaving strike history intact. */
export function unmuteUser(userId: string): void {
  const rec = _store.get(userId);
  if (rec) rec.mutedUntil = undefined;
}

// ── Admin read ─────────────────────────────────────────────────────────────────
export interface StrikeRecord {
  userId: string;
  displayName: string;
  recentStrikes: number;   // within the 30-min window
  totalStrikes: number;    // all time (this session)
  totalMutes: number;
  mutedUntil?: string;     // ISO or undefined
  minutesLeft?: number;
  latestTerm: string;
  latestSurface: string;
  latestAt: string;        // ISO
}

export function getStrikeRecords(): StrikeRecord[] {
  const out: StrikeRecord[] = [];
  for (const rec of _store.values()) {
    if (rec.strikes.length === 0) continue;
    const recent = _recentStrikes(rec);
    const last = rec.strikes[rec.strikes.length - 1];
    const mutedUntil = rec.mutedUntil && rec.mutedUntil > Date.now()
      ? new Date(rec.mutedUntil).toISOString()
      : undefined;
    const minutesLeft = mutedUntil
      ? Math.ceil((rec.mutedUntil! - Date.now()) / 60_000)
      : undefined;
    out.push({
      userId: rec.userId,
      displayName: rec.displayName,
      recentStrikes: recent.length,
      totalStrikes: rec.strikes.length,
      totalMutes: rec.muteCount,
      mutedUntil,
      minutesLeft,
      latestTerm: last.term,
      latestSurface: last.surface,
      latestAt: new Date(last.ts).toISOString(),
    });
  }
  return out.sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
  );
}
