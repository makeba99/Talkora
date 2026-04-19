/**
 * Lipsync Module — Viseme-based realistic mouth animation.
 *
 * Maps speech phonemes to 7 mouth shape groups (visemes).
 * Designed to be driven by SpeechSynthesisUtterance.onboundary events
 * for frame-accurate word-level lip sync.
 *
 * Viseme groups follow standard lipsync phoneme categories:
 *   REST  — mouth gently closed (silence / pauses)
 *   MBP   — bilabial: lips pressed together (m, b, p)
 *   FV    — labiodental: lower lip up (f, v)
 *   AH    — open jaw: wide open (a, ah)
 *   OH    — rounded open: oval (o, oh, aw)
 *   EE    — spread: wide smile (e, ee, i, y)
 *   OPEN  — neutral open: general consonants
 */

export type Viseme = 'rest' | 'mbp' | 'fv' | 'ah' | 'oh' | 'ee' | 'open';

/** Mouth shape geometry for SVG rendering. All coordinates fit within viewBox="0 0 60 28" */
export interface MouthShape {
  upperLip: string;
  lowerLip: string;
  innerRx: number;
  innerRy: number;
  innerCy: number;
  innerFill: string;
  upperFill: string;
  lowerFill: string;
}

export const MOUTH_SHAPES: Record<Viseme, MouthShape> = {
  rest: {
    upperLip: "M 10 14 C 17 10 23 12 30 12.5 C 37 12 43 10 50 14",
    lowerLip: "M 10 14 C 18 17.5 42 17.5 50 14",
    innerRx: 12, innerRy: 0.8, innerCy: 14.5,
    innerFill: "rgba(20,5,5,0.80)",
    upperFill: "rgba(210,120,120,0.88)",
    lowerFill: "rgba(200,110,110,0.80)",
  },
  mbp: {
    upperLip: "M 10 13.5 C 17 10 23 12 30 12.5 C 37 12 43 10 50 13.5",
    lowerLip: "M 10 13.5 C 18 15 42 15 50 13.5",
    innerRx: 10, innerRy: 0, innerCy: 13.5,
    innerFill: "rgba(20,5,5,0.0)",
    upperFill: "rgba(215,125,125,0.92)",
    lowerFill: "rgba(205,115,115,0.88)",
  },
  fv: {
    upperLip: "M 9 12 C 15 8 22 11 30 12 C 38 11 45 8 51 12",
    lowerLip: "M 9 12 C 16 16 44 16 51 12",
    innerRx: 14, innerRy: 2, innerCy: 13,
    innerFill: "rgba(20,5,5,0.72)",
    upperFill: "rgba(200,110,110,0.85)",
    lowerFill: "rgba(190,100,100,0.78)",
  },
  open: {
    upperLip: "M 8 13 C 15 8 22 11 30 12 C 38 11 45 8 52 13",
    lowerLip: "M 8 13 C 18 22 42 22 52 13",
    innerRx: 16, innerRy: 5.5, innerCy: 16,
    innerFill: "rgba(18,4,4,0.92)",
    upperFill: "rgba(215,125,125,0.88)",
    lowerFill: "rgba(205,115,115,0.82)",
  },
  ah: {
    upperLip: "M 7 12 C 14 7 22 10 30 11 C 38 10 46 7 53 12",
    lowerLip: "M 7 12 C 17 27 43 27 53 12",
    innerRx: 18, innerRy: 9, innerCy: 17.5,
    innerFill: "rgba(14,3,3,0.96)",
    upperFill: "rgba(220,130,130,0.90)",
    lowerFill: "rgba(210,120,120,0.85)",
  },
  oh: {
    upperLip: "M 13 13 C 18 9 24 11 30 12 C 36 11 42 9 47 13",
    lowerLip: "M 13 13 C 19 23 41 23 47 13",
    innerRx: 12, innerRy: 7, innerCy: 16.5,
    innerFill: "rgba(18,4,4,0.93)",
    upperFill: "rgba(215,125,125,0.88)",
    lowerFill: "rgba(205,115,115,0.82)",
  },
  ee: {
    upperLip: "M 6 13 C 12 8 20 12 30 12.5 C 40 12 48 8 54 13",
    lowerLip: "M 6 13 C 14 19 46 19 54 13",
    innerRx: 20, innerRy: 3.5, innerCy: 15,
    innerFill: "rgba(18,4,4,0.88)",
    upperFill: "rgba(215,125,125,0.88)",
    lowerFill: "rgba(205,115,115,0.82)",
  },
};

/** Map a single character to its viseme group */
const CHAR_VISEME: Record<string, Viseme> = {
  // Bilabials (lips closed)
  'm': 'mbp', 'b': 'mbp', 'p': 'mbp',
  // Labiodentals (lower lip to teeth)
  'f': 'fv', 'v': 'fv',
  // Open vowels (jaw drop)
  'a': 'ah',
  // Rounded vowels (puckered)
  'o': 'oh', 'u': 'oh', 'w': 'oh',
  // Spread / high front vowels (smile)
  'i': 'ee', 'e': 'ee', 'y': 'ee',
  // General consonants / neutrals
  'd': 'open', 'n': 'open', 't': 'open', 'l': 'open', 'r': 'open',
  's': 'open', 'z': 'open', 'k': 'open', 'g': 'open', 'h': 'open',
  'c': 'open', 'j': 'open', 'q': 'open', 'x': 'open',
};

/**
 * Returns the dominant viseme for a word by scanning the first 4 characters
 * for the first phonetically significant sound.
 */
export function getWordViseme(word: string): Viseme {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return 'rest';
  for (const ch of clean.slice(0, 4)) {
    const v = CHAR_VISEME[ch];
    if (v) return v;
  }
  return 'open';
}

/**
 * Convenience: returns a random "animated" viseme (not rest/mbp)
 * for use when no boundary events are available but speech is active.
 */
const ACTIVE_VISEMES: Viseme[] = ['open', 'ah', 'oh', 'ee', 'open', 'ah'];
let _activeIdx = 0;
export function getNextActiveViseme(): Viseme {
  const v = ACTIVE_VISEMES[_activeIdx % ACTIVE_VISEMES.length];
  _activeIdx++;
  return v;
}
