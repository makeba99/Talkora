/** Lines that must never be spoken by the in-room tutor. */
const FILLER_ONLY =
  /^(um+|uh+|hmm+|hm+|mm+|m+hm+|mm[\s-]?hmm+|err+|ah+|okay|ok|right|yeah|yep|yup)[.!?]*$/i;

const LEADING_FILLER =
  /^(?:um+|uh+|hmm+|hm+|mm+|m+hm+|mm[\s-]?hmm+|err+|ah+)[,.!?]?\s+/i;

const LEADING_STALL =
  /^(?:let me think|one sec(?:ond)?|hold on|give me a (?:moment|sec)|got it hold on)[,.!?]?\s+/i;

export function sanitizeSpokenTutorLine(text: string): string | null {
  let t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  for (let i = 0; i < 4; i++) {
    const stripped = t.replace(LEADING_FILLER, "").replace(LEADING_STALL, "").trim();
    if (stripped === t) break;
    t = stripped;
  }
  if (!t || FILLER_ONLY.test(t)) return null;
  if (/\.\.\.$|…$/.test(t) || /[-–—]$/.test(t)) return null;
  const words = t.split(/\s+/).filter(Boolean);
  const complete = /[.!?]$/.test(t);
  if (!complete && words.length < 5) return null;
  if (!complete && /\b(the|a|an|to|and|or|of|for|with|that|this|my|your|i|we|she|he)$/i.test(t)) {
    return null;
  }
  return t;
}

export function extractCompleteSentences(buffer: string): [string[], string] {
  const sentences: string[] = [];
  let remaining = buffer;
  let match: RegExpMatchArray | null;
  while ((match = remaining.match(/^(.*?[.!?])(\s+|$)/))) {
    const s = sanitizeSpokenTutorLine(match[1].trim());
    remaining = remaining.slice(match[0].length);
    if (s) sentences.push(s);
  }
  return [sentences, remaining];
}
