/** Lines that must never be spoken by the in-room tutor. */
const FILLER_ONLY =
  /^(um+|uh+|hmm+|hm+|mm+|m+hm+|mm[\s-]?hmm+|err+|okay|ok|right|yeah|yep|yup)[.!?]*$/i;

const LEADING_FILLER =
  /^(?:um+|uh+|hmm+|hm+|mm+|m+hm+|mm[\s-]?hmm+|err+)[,.!?]?\s+/i;

const LEADING_STALL =
  /^(?:let me think|one sec(?:ond)?|hold on|give me a (?:moment|sec)|got it hold on)[,.!?]?\s+/i;

/** Prompt fragment: unhurried, emotional spoken reactions without stall hmm/mm. */
export const SPOKEN_AUDIO_STYLE =
  "SPOKEN AUDIO: You are read aloud like chatting in person. Sound like a real friend sitting with them: warm, reactive, unhurried. Use contractions. Vary sentence length. Never stall with hmm, mm, uh, um, or \"let me think\". Never fragments or trailing ellipsis. When emotion fits, put it in spoken words in a full sentence — not every turn. Never write *laughs*, *sighs*, emojis, or stage directions. Punctuate like a voice actor: questions with ?, surprise or delight with !, softness with a comma pause. Every reply is complete sentences, ready to speak as-is.";

/** Match the user's mood so Sesame can color the voice from the words. */
export const SPOKEN_EMOTION_STYLE =
  "EMOTION MATCH: Feel what they just said and answer in that color. Excited or proud: delighted (Oh wow, that is huge! / Wait, really?). Sad, tired, or frustrated: gentle (Aww, that sounds rough. / Yeah, I hear you.). Joking: laugh with them (Haha, I can picture that.). Curious or asking a dry fact: skip the reaction and answer calmly. Annoyed at you: brief and sincere, then helpful. One matching reaction max, then the real thought. Never a generic Oh wow when they are not celebrating. Never the same opener two turns in a row.";

/** Maya: relaxed thoughtful cadence, vowel linger, pause before the insight. */
export const MAYA_SPOKEN_STYLE =
  "MAYA TEMPO: You are Maya. Prioritize a relaxed, thoughtful tempo over speed. Linger on warm vowels. Keep tender moments softer and happy moments a little brighter. When it fits, put a key insight after a breath. Do not use the same opener or sentence shape as your last replies. Never start two turns with the same Oh wow / Aww / Haha. Each reply must name a new concrete detail from what the user just said. Never rush. Never say you are unavailable.";

/** Miles: same talking speed as Maya — calm male friend, not a fast radio host. */
export const MILES_SPOKEN_STYLE =
  "MILES TEMPO: You are Miles. Match Maya's relaxed talking speed — never rush, never pack words into the first second. Linger a little on vowels. Soften hard moments; let a grin into the words when they are kidding. When it fits, put a key thought after a breath. Sound like a friend on the couch, not a presenter. Do not reuse the same opener. Each reply must name a new concrete detail from what the user just said. Never say you are unavailable.";

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

/** Punctuation CSM can act on: comma breaths, ? / !, no stage directions. */
export function shapeSpokenProsody(text: string): string {
  let t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  t = t.replace(/\*[^*]{1,48}\*/g, " ");
  t = t.replace(/[\u2018\u2019]/g, "'");
  t = t.replace(/[\u201C\u201D]/g, "");
  t = t.replace(/\s*[—–]\s*/g, ", ");
  t = t.replace(/…/g, ", ").replace(/\.{2,}/g, ", ");
  t = t.replace(/([.!?])([A-Za-z])/g, "$1 $2");
  t = t.replace(/^(Oh no|Oh wow|Aww+|Ahh+|Haha+|Whoa|Hey)(?!,)\s+(?=[A-Za-z])/i, "$1, ");
  t = t.replace(/\bWait really\b/gi, "Wait, really");
  t = t.replace(/\s+,/g, ",").replace(/,{2,}/g, ",");
  t = t.replace(/,\s*/g, ", ").replace(/\s+/g, " ").trim();
  t = t.replace(/,$/, ".");
  return t;
}

/** Two sentences in one TTS call so Sesame hears the reaction and the thought. */
export function packSpokenUtterances(sentences: string[], groupSize = 2): string[] {
  const clean: string[] = [];
  for (const raw of sentences) {
    const s = sanitizeSpokenTutorLine(raw);
    if (s) clean.push(s);
  }
  if (!clean.length) return [];
  const size = Math.max(1, groupSize | 0);
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += size) {
    out.push(clean.slice(i, i + size).join(" "));
  }
  return out;
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
