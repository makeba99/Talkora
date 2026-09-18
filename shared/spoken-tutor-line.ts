/** Lines that must never be spoken by the in-room tutor. */
const FILLER_ONLY =
  /^(um+|uh+|hmm+|hm+|mm+|m+hm+|mm[\s-]?hmm+|err+|okay|ok|right|yeah|yep|yup)[.!?]*$/i;

const LEADING_FILLER =
  /^(?:um+|uh+|hmm+|hm+|mm+|m+hm+|mm[\s-]?hmm+|err+)[,.!?]?\s+/i;

const LEADING_STALL =
  /^(?:let me think|one sec(?:ond)?|hold on|give me a (?:moment|sec)|got it hold on)[,.!?]?\s+/i;

/** Prompt fragment: faster, emotional spoken reactions without stall hmm/mm. */
export const SPOKEN_AUDIO_STYLE =
  "SPOKEN AUDIO: You are read aloud like chatting in person. Sound like a real friend: warm, reactive. Never stall with hmm, mm, uh, um, or \"let me think\". Never fragments or trailing ellipsis. Do make human emotional noise as spoken words in a full sentence — \"Oh wow, that sounds amazing.\", \"Haha, I can picture that.\", \"Aww, I'm happy for you.\", \"Oh no, that's rough.\", \"Wait, really?\" Never write *laughs*, *sighs*, emojis, or stage directions. Every reply is complete sentences, ready to speak as-is.";

/** Maya-only: relaxed thoughtful cadence, vowel linger, pause before the insight. */
export const MAYA_SPOKEN_STYLE =
  "MAYA TEMPO: You are Maya. Prioritize a relaxed, thoughtful tempo over speed. Linger on warm vowels. Keep emotional moments softer. When it fits, put a key insight after a breath. Do not use the same opener or sentence shape as your last replies. Never start two turns with the same Oh wow / Aww / Haha. Each reply must name a new concrete detail from what the user just said. Never rush. Never say you are unavailable.";

/** Status/error lines that must never be stored as tutor history or spoken. */
export function isTutorSystemErrorLine(text: string): boolean {
  return /talking ai is unavailable|brain is offline|free talking ai limit|that's all the free talking|usage limit reached|please try again in a moment|configured ai voice unavailable|ai voice unavailable|voice blip/i.test(
    String(text || ""),
  );
}

export function sanitizeSpokenTutorLine(text: string): string | null {
  let t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (isTutorSystemErrorLine(t)) return null;
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
