/** Phrases that close an in-room Maya/Miles session. */
const AGENT =
  "(?:the\\s+)?(?:ai|a\\.i\\.?|tutor|maya|maia|mya|mia|may|miles|myles|niles)";
/** STT often hears "AI" as "I" / "aye" / "eye" / "a". */
const AGENT_OR_STT_AI = `${AGENT}|i|aye|eye|a`;
const FAREWELL_TAIL =
  "(?:have a (?:wonderful|great|good|nice|lovely) (?:day|one|evening|night)|see you(?: later)?|take care|thanks|thank you|talk soon)";
/** "alright bye", "ok bye", "yeah bye Maya" */
const SOFT_PREFIX = "(?:ok(?:ay)?|alright|all\\s+right|yeah|yep|yes|thanks|thank you)\\s+";

export function matchStopTutorPhrase(raw: string): boolean {
  const t = String(raw || "")
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return false;
  if (new RegExp(`^(?:${SOFT_PREFIX})?(?:close|stop)(?:\\s+${AGENT})?$`).test(t)) return true;
  if (/^(turn off|stop listening|that'?s enough|that'?s all)$/.test(t)) return true;
  // "bye" / "alright bye" / "bye AI" / STT "bye I" / "bye Maya have a great day"
  if (
    new RegExp(
      `^(?:${SOFT_PREFIX})?(?:bye|goodbye|bye bye)(?:\\s+(?:${AGENT_OR_STT_AI}))?(?:\\s+${FAREWELL_TAIL})?$`,
    ).test(t)
  ) {
    return true;
  }
  // "by AI" (STT miss for bye AI) — require the agent so "by the way" never matches.
  if (new RegExp(`^(?:by|buy)\\s+(?:${AGENT})$`).test(t)) return true;
  return false;
}

function turnWords(value: string): string[] {
  return String(value || "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter(Boolean);
}

/** True only when two transcripts are basically the same utterance, not a follow-up. */
export function isNearDuplicateTurn(a: string, b: string): boolean {
  const aw = turnWords(a);
  const bw = turnWords(b);
  if (!aw.length || !bw.length) return false;
  if (aw.join(" ") === bw.join(" ")) return true;
  const aSet = new Set(aw);
  const bSet = new Set(bw);
  const overlap = aw.filter((w) => bSet.has(w)).length;
  const jaccard = overlap / new Set([...aSet, ...bSet]).size;
  const lenRatio = Math.min(aw.length, bw.length) / Math.max(aw.length, bw.length);
  return jaccard >= 0.88 && lenRatio >= 0.75;
}
