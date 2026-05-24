// ─── Vextorn Semantic Intent Analyzer ─────────────────────────────────────────
// Detects harassment based on the COMBINATION and CONTEXT of words, not just
// individual banned terms.  This catches phrases like:
//   "sucking dick"  "lick my boobs"  "show me ur pussy"  "boobies"
// even when no single word would be caught by word-boundary matching.
//
// Three detection layers:
//   A  Obvious euphemisms — standalone terms that are always sexual
//   B  Proximity check   — body-part token within N words of a sexual action
//   C  Solicitation      — predatory opener + any body-part in the same message

// ── A: High-confidence standalone euphemisms ──────────────────────────────────
// These are unambiguously sexual in any chat context. Block on sight.
const OBVIOUS_EUPHEMISMS = new Set([
  "boobies", "bewbies", "bewbs",
  "titties", "tittys", "titty",
  "coochie", "cooch", "coochy",
  "vajayjay", "vajaj", "vjayjay",
  "boner", "stiffy", "stiffie", "woody",
  "schlong", "dong", "dongs",
  "weiner", "wiener", "wienier", "wienie", "weeny",
  "peenis", "peenie", "pee pee", "peepee",
  "hooha", "hoohaa", "hoha",
  "minge", "snatch",
  "ballsack", "ball sack", "nutsack", "nut sack",
  "taint", "gooch",
]);

// ── B: Body-part tokens (sexual context) ─────────────────────────────────────
// Checked for proximity to a sexual action verb.
const BODY_PARTS = new Set([
  // Penis
  "dick", "cock", "penis", "shaft", "member", "phallus",
  "balls", "testicle", "testicles", "scrotum",
  // Vagina
  "pussy", "vagina", "vulva", "clit", "clitoris", "vag",
  // Breasts
  "boob", "boobs", "tit", "tits", "breast", "breasts", "nipple", "nipples",
  // Buttocks / anus
  "ass", "butt", "butthole", "anus", "rectum", "booty", "buttocks",
  // Generic
  "genitals", "privates", "crotch", "groin",
]);

// ── B: Sexual action verb stems (prefix match) ────────────────────────────────
// A token is considered a "sexual action" if it STARTS WITH any of these stems.
// This covers conjugations: suck/sucking/sucked, lick/licking, finger/fingering, …
const SEXUAL_ACTION_STEMS = [
  "suck",       // suck, sucking, sucked, sucker
  "blow",       // blow, blowing, blowjob
  "lick",       // lick, licking, licked
  "stroke",     // stroke, stroking, stroked
  "grab",       // grab, grabbing, grabbed
  "grope",      // grope, groping, groped
  "fondle",     // fondle, fondling
  "fist",       // fist, fisting
  "finger",     // finger, fingering
  "rub",        // rub, rubbing, rubbed
  "hump",       // hump, humping
  "ride",       // ride, riding — only flagged when near body part
  "thrust",     // thrust, thrusting
  "penetrat",   // penetrate, penetrating, penetration
  "stimulat",   // stimulate, stimulating
  "masturbat",  // masturbate, masturbating, masturbation
  "jerk",       // jerk — only flagged when near body part
  "squeeze",    // squeeze, squeezing
  "spank",      // spank, spanking
  "slap",       // slap, slapping — near body part only
];

// ── C: Solicitation openers ───────────────────────────────────────────────────
// When these patterns appear AND the message also contains a body-part token,
// the message is flagged as predatory solicitation.
const SOLICITATION_PATTERNS: RegExp[] = [
  /show\s+(me|us)\s+(your|ur|my)/,
  /show\s+ur/,
  /send\s+(me\s+)?(your|ur|a\s+pic)/,
  /let\s+me\s+see\s+(your|ur)/,
  /can\s+i\s+see\s+(your|ur)/,
  /i\s+want\s+to\s+see\s+(your|ur)/,
  /wanna\s+see\s+(your|ur)/,
  /i\s+wanna\s+see/,
  /want\s+to\s+touch\s+(your|ur)/,
  /wanna\s+touch\s+(your|ur)/,
  /want\s+to\s+feel\s+(your|ur)/,
  /let\s+me\s+touch/,
  /can\s+i\s+touch\s+(your|ur)/,
  /let\s+me\s+grab/,
  /i\s+want\s+to\s+grab/,
];

// ── Proximity window (tokens) ──────────────────────────────────────────────────
// A body part within this many word-positions of a sexual action triggers a flag.
const PROXIMITY_WINDOW = 7;

// ── User-facing message ────────────────────────────────────────────────────────
const MSG =
  "Your message appears to contain sexually harassing or explicit content based on its overall meaning, which violates our community guidelines and wasn't sent.";

export interface SemanticResult {
  flagged: boolean;
  reason?: "euphemism" | "body_part_action" | "solicitation";
  matchedTerm?: string;
  message?: string;
}

// ── Main entry point ──────────────────────────────────────────────────────────
// `text` should be the leet-normalised, homoglyph-normalised, lowercased variant
// produced by the content-filter pipeline — not raw user input.
export function checkSemantic(text: string): SemanticResult {
  const lower = text.toLowerCase();

  // Tokenize: split on whitespace + most punctuation, drop empties
  const tokens = lower.split(/[\s.,!?;:'"()\[\]{}<>\/\\|@#%^&*+=~`_-]+/).filter(Boolean);

  // ── A: Obvious euphemisms ─────────────────────────────────────────────────
  for (const tok of tokens) {
    if (OBVIOUS_EUPHEMISMS.has(tok)) {
      return { flagged: true, reason: "euphemism", matchedTerm: tok, message: MSG };
    }
  }

  // Also check for space-containing euphemisms against the full string
  for (const euph of OBVIOUS_EUPHEMISMS) {
    if (euph.includes(" ") && lower.includes(euph)) {
      return { flagged: true, reason: "euphemism", matchedTerm: euph, message: MSG };
    }
  }

  // ── B: Body-part × sexual-action proximity ────────────────────────────────
  const bodyPositions: number[] = [];
  const actionPositions: number[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (BODY_PARTS.has(tok)) {
      bodyPositions.push(i);
    }
    if (SEXUAL_ACTION_STEMS.some((stem) => tok.startsWith(stem))) {
      actionPositions.push(i);
    }
  }

  for (const bp of bodyPositions) {
    for (const ap of actionPositions) {
      if (Math.abs(bp - ap) <= PROXIMITY_WINDOW) {
        return {
          flagged: true,
          reason: "body_part_action",
          matchedTerm: `${tokens[ap]}+${tokens[bp]}`,
          message: MSG,
        };
      }
    }
  }

  // ── C: Solicitation opener + body part in same message ───────────────────
  if (bodyPositions.length > 0) {
    for (const pat of SOLICITATION_PATTERNS) {
      if (pat.test(lower)) {
        return {
          flagged: true,
          reason: "solicitation",
          matchedTerm: `solicitation+${tokens[bodyPositions[0]]}`,
          message: MSG,
        };
      }
    }
  }

  return { flagged: false };
}
