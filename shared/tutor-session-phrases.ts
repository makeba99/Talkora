/** Phrases that close an in-room Maya/Miles session. */
export function matchStopTutorPhrase(raw: string): boolean {
  const t = String(raw || "")
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return false;
  const agent = "(?:the\\s+)?(?:ai|tutor|maya|maia|mya|mia|may|miles|myles|niles)";
  if (new RegExp(`^(?:ok(?:ay)?\\s+)?(?:close|stop)(?:\\s+${agent})?$`).test(t)) return true;
  if (new RegExp(`^(?:ok(?:ay)?\\s+)?(?:bye|goodbye)(?:\\s+${agent})?$`).test(t)) return true;
  if (/^(turn off|stop listening|that'?s enough|that'?s all)$/.test(t)) return true;
  return false;
}
