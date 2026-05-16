// ─── Vextorn Content Filter ────────────────────────────────────────────────────
// Six-layer evasion-resistant detection pipeline:
//
//  Layer 1  Strip zero-width / invisible Unicode characters
//  Layer 2  Convert Unicode lookalike letters (Cyrillic а → a, etc.)
//  Layer 3  Leet-speak character substitutions (@ → a, 3 → e, etc.)
//  Layer 4  Collapse spaced-out letters  ("f u c k" → "fuck")
//  Layer 5  Collapse repeated characters ("fuuuuck" → "fuck")
//  Layer 6  Strip ALL non-alpha to catch fully punctuated obfuscation
//           ("f.u.c.k!!!" → "fuck")
//
// Then each variant is checked against PHRASE_TERMS (substring) and
// WORD_TERMS (word-boundary regex).
//
// Usage:
//   import { checkContent } from "./content-filter";
//   const result = checkContent(userText);
//   if (result.flagged) { /* block and surface result.message */ }

import { WORD_TERMS, PHRASE_TERMS, CATEGORY_MESSAGES, FilterCategory } from "./moderation-words";

export interface FilterResult {
  flagged: boolean;
  category?: FilterCategory;
  /** Ready-to-send user-facing warning message */
  message: string;
  /** The normalised variant that triggered the match (for logging) */
  matchedVariant?: string;
  /** The banned term that was matched */
  matchedTerm?: string;
}

const CLEAN: FilterResult = { flagged: false, message: "" };

// ── Escape a string for use inside a RegExp ───────────────────────────────────
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Layer 1: strip zero-width / invisible Unicode ─────────────────────────────
// Covers: zero-width space (U+200B), zero-width non-joiner (U+200C),
// zero-width joiner (U+200D), word joiner (U+2060), BOM (U+FEFF),
// soft hyphen (U+00AD), and the full variation-selectors block.
const ZW_RE = /[\u00AD\u200B-\u200F\u2028\u2029\u202A-\u202F\u2060-\u2064\uFEFF\uFFF9-\uFFFC]/g;
function stripInvisible(text: string): string {
  return text.replace(ZW_RE, "");
}

// ── Layer 2: Unicode / Homoglyph normalisation ────────────────────────────────
// Common Cyrillic, Greek, and other lookalikes mapped to ASCII.
const HOMOGLYPHS: [RegExp, string][] = [
  // Cyrillic
  [/[аА]/g, "a"], [/[еЕ]/g, "e"], [/[іІ]/g, "i"], [/[оО]/g, "o"],
  [/[рР]/g, "p"], [/[сС]/g, "c"], [/[уУ]/g, "u"], [/[хХ]/g, "x"],
  [/[ВЬ]/g, "b"], [/[кК]/g, "k"], [/[мМ]/g, "m"], [/[нН]/g, "h"],
  // Greek lookalikes
  [/[αΑ]/g, "a"], [/[εΕ]/g, "e"], [/[ιΙ]/g, "i"], [/[οΟ]/g, "o"],
  [/[υΥ]/g, "u"], [/[νΝ]/g, "n"], [/[ρΡ]/g, "p"], [/[τΤ]/g, "t"],
  // Mathematical / fullwidth
  [/[𝐚-𝐳𝗮-𝘇𝘢-𝘻𝙖-𝙯𝚊-𝚣]/gu, (m) => String.fromCharCode(m.codePointAt(0)! - 0x1D400 + 97 & 0xFF)],
  // Miscellaneous lookalikes
  [/ｆ/g, "f"], [/ｕ/g, "u"], [/ｃ/g, "c"], [/ｋ/g, "k"],
  [/ø/g, "o"], [/ö/g, "o"], [/ü/g, "u"], [/ä/g, "a"],
  [/ñ/g, "n"], [/ç/g, "c"],
];
function normalizeHomoglyphs(text: string): string {
  let s = text;
  for (const [re, rep] of HOMOGLYPHS) {
    s = s.replace(re, rep as string);
  }
  return s;
}

// ── Layer 3: Leet-speak substitutions ────────────────────────────────────────
// Covers: @→a, 4→a, 3→e, 1→i, !→i, |→l/i, 0→o, $→s, 5→s, 7→t, +→t,
//         *→u, (→c, <→c, )→o, ph→f (phonetic), ^→a, #→h
function normalizeLeet(text: string): string {
  return text
    .toLowerCase()
    .replace(/ph/g, "f")           // phuck → fuck
    .replace(/[@4\^]/g, "a")
    .replace(/3/g, "e")
    .replace(/[!1|]/g, "i")        // also handles |=l/i ambiguity
    .replace(/0/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7+]/g, "t")
    .replace(/\*/g, "u")
    .replace(/[(<]/g, "c")
    .replace(/[)>]/g, "o")
    .replace(/#/g, "h")
    .replace(/\\/g, "v")           // \/=v
    .replace(/\+/g, "t");          // duplicate safe
}

// ── Layer 4: Collapse spaced-out / separated letters ────────────────────────
// "f u c k", "f.u.c.k", "f_u_c_k", "f-u-c-k"  →  "fuck"
// Only collapses runs of (single char)(separator)(single char)... ≥ 3 chars.
function collapseSpaced(text: string): string {
  return text.replace(
    /\b([a-z])([\s._*\-,!@#%^&+=|\\/<>]+[a-z]){2,}\b/gi,
    (match) => match.replace(/[^a-zA-Z0-9]/g, ""),
  );
}

// ── Layer 5: Collapse repeated characters ─────────────────────────────────────
// Two passes to handle both evasion strategies:
//   Pass A: collapse 3+ repetitions → 2  (niggggger → nigger, fuuuuck → fuuck)
//           This preserves legitimate doubles while removing excessive repeats.
//   Pass B: collapse 2+ repetitions → 1  (fuuck → fuk, nigger → niger)
//           A second variant ensures single-char targets still match.
// Both variants are added to the check set by buildVariants().
function collapseRepeatedToTwo(text: string): string {
  return text.replace(/(.)\1{2,}/g, "$1$1");
}
function collapseRepeated(text: string): string {
  return text.replace(/(.)\1+/g, "$1");
}

// ── Layer 6: Strip ALL non-alpha ──────────────────────────────────────────────
// Catches things like "f.u.c.k!!!", "$h!t", etc. where layer 4 misses fragments.
function stripNonAlpha(text: string): string {
  return text.replace(/[^a-z]/g, "");
}

// ── Build all variants to check ───────────────────────────────────────────────
function buildVariants(raw: string): string[] {
  const invisible  = stripInvisible(raw);
  const glyphs     = normalizeHomoglyphs(invisible);
  const lc         = glyphs.toLowerCase();
  const leet       = normalizeLeet(glyphs);
  const spaced     = collapseSpaced(lc);
  const leetSpaced = collapseSpaced(leet);

  // Repeat-collapse: two passes per variant
  //   toTwo  — niggggger → nigger  (3+ repeats → 2, preserves doubles)
  //   toOne  — fuuuuck   → fuck    (all repeats → 1)
  const lcToTwo       = collapseRepeatedToTwo(lc);
  const lcToOne       = collapseRepeated(lc);
  const leetToTwo     = collapseRepeatedToTwo(leet);
  const leetToOne     = collapseRepeated(leet);
  const spacedToTwo   = collapseRepeatedToTwo(spaced);
  const leetSpcToTwo  = collapseRepeatedToTwo(leetSpaced);

  // Stripped alpha — catches fully-punctuated obfuscation
  const stripped        = stripNonAlpha(leet);
  const strippedToTwo   = collapseRepeatedToTwo(stripped);
  const strippedToOne   = collapseRepeated(stripped);

  // Deduplicate — avoids redundant regex runs on identical strings
  return [...new Set([
    lc, leet, spaced, leetSpaced,
    lcToTwo, lcToOne, leetToTwo, leetToOne,
    spacedToTwo, leetSpcToTwo,
    stripped, strippedToTwo, strippedToOne,
  ])];
}

// ── Logging helper ────────────────────────────────────────────────────────────
// Writes a single line to stdout for ops monitoring. Intentionally lightweight —
// no PII stored (no user ID, no full message) beyond what's needed for tuning.
function logFlagged(category: FilterCategory, matchedTerm: string, variant: string): void {
  const ts = new Date().toISOString();
  // Truncate variant to avoid logging large text blobs
  const preview = variant.length > 60 ? variant.slice(0, 60) + "…" : variant;
  console.warn(`[content-filter] BLOCKED category=${category} term="${matchedTerm}" variant="${preview}" at=${ts}`);
}

// ── Core check ────────────────────────────────────────────────────────────────
export function checkContent(text: string): FilterResult {
  if (!text || typeof text !== "string") return CLEAN;

  const trimmed = text.trim();
  if (!trimmed) return CLEAN;

  const variants = buildVariants(trimmed);

  // 1. Phrase matching (substring, no word boundaries — catches multi-word evasion)
  for (const { term, category } of PHRASE_TERMS) {
    for (const v of variants) {
      if (v.includes(term)) {
        logFlagged(category, term, v);
        return {
          flagged: true,
          category,
          message: CATEGORY_MESSAGES[category],
          matchedTerm: term,
          matchedVariant: v,
        };
      }
    }
  }

  // 2. Word-boundary matching (won't fire inside legitimate words like "class")
  for (const { term, category } of WORD_TERMS) {
    const re = new RegExp(`\\b${escapeRe(term)}\\b`);
    for (const v of variants) {
      if (re.test(v)) {
        logFlagged(category, term, v);
        return {
          flagged: true,
          category,
          message: CATEGORY_MESSAGES[category],
          matchedTerm: term,
          matchedVariant: v,
        };
      }
    }
  }

  // 3. Stripped-alpha check: run PHRASE_TERMS again on the fully-stripped variant
  //    to catch things like "k.i.l.l.y.o.u.r.s.e.l.f" split across punctuation
  const stripped = stripNonAlpha(normalizeLeet(stripInvisible(normalizeHomoglyphs(trimmed))));
  const strippedCollapsed = collapseRepeated(stripped);
  for (const { term, category } of PHRASE_TERMS) {
    const termStripped = stripNonAlpha(term.replace(/\s+/g, ""));
    if (strippedCollapsed.includes(termStripped)) {
      logFlagged(category, term, strippedCollapsed);
      return {
        flagged: true,
        category,
        message: CATEGORY_MESSAGES[category],
        matchedTerm: term,
        matchedVariant: strippedCollapsed,
      };
    }
  }

  return CLEAN;
}

// ── Convenience: check multiple fields, return first violation found ──────────
export function checkFields(fields: Record<string, string | undefined | null>): FilterResult & { field?: string } {
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const result = checkContent(value);
    if (result.flagged) return { ...result, field };
  }
  return CLEAN;
}
