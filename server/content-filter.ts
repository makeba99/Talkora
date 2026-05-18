// ─── Vextorn Content Filter ────────────────────────────────────────────────────
// Seven-layer evasion-resistant detection pipeline:
//
//  Layer 1  Strip zero-width / invisible Unicode characters
//  Layer 2  Convert Unicode lookalike letters (Cyrillic а → a, etc.)
//  Layer 3  Leet-speak character substitutions (@ → a, 3 → e, etc.)
//  Layer 4  Collapse spaced-out letters  ("f u c k" → "fuck")
//  Layer 5  Collapse repeated characters ("fuuuuck" → "fuck")
//  Layer 6  Strip ALL non-alpha to catch fully punctuated obfuscation
//           ("f.u.c.k!!!" → "fuck")
//  Layer 7  Semantic intent analysis — detects harassment from the COMBINATION
//           and CONTEXT of words ("sucking dick", "show me ur boobs", "boobies")
//           even when no single term would be caught by word-boundary matching.
//
// Then each variant is checked against PHRASE_TERMS (substring) and
// WORD_TERMS (word-boundary regex).
//
// Usage:
//   import { checkContent } from "./content-filter";
//   const result = checkContent(userText, "chat");
//   if (result.flagged) { /* block and surface result.message */ }

import { WORD_TERMS, PHRASE_TERMS, CATEGORY_MESSAGES, FilterCategory } from "./moderation-words";
import { checkSemantic } from "./semantic-filter";

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

// ── Block Log (in-memory ring buffer, last 500 events) ───────────────────────
export interface BlockLogEntry {
  id: number;
  category: FilterCategory;
  surface: string;
  matchedTerm: string;
  timestamp: string;
  userId?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface UserContext {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}

let _logSeq = 0;
const RING_SIZE = 500;
const _blockLog: BlockLogEntry[] = [];

export function getBlockLog(): BlockLogEntry[] {
  return [..._blockLog].reverse();
}

export function clearBlockLog(): void {
  _blockLog.length = 0;
}

function pushBlockLog(category: FilterCategory, surface: string, matchedTerm: string, userCtx?: UserContext): void {
  const entry: BlockLogEntry = {
    id: ++_logSeq,
    category,
    surface,
    matchedTerm,
    timestamp: new Date().toISOString(),
    userId: userCtx?.userId,
    displayName: userCtx?.displayName,
    avatarUrl: userCtx?.avatarUrl,
  };
  _blockLog.push(entry);
  if (_blockLog.length > RING_SIZE) _blockLog.shift();
}

// ── Escape a string for use inside a RegExp ───────────────────────────────────
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Layer 1: strip zero-width / invisible Unicode ─────────────────────────────
const ZW_RE = /[\u00AD\u200B-\u200F\u2028\u2029\u202A-\u202F\u2060-\u2064\uFEFF\uFFF9-\uFFFC]/g;
function stripInvisible(text: string): string {
  return text.replace(ZW_RE, "");
}

// ── Layer 2: Unicode / Homoglyph normalisation ────────────────────────────────
const HOMOGLYPHS: [RegExp, string][] = [
  [/[аА]/g, "a"], [/[еЕ]/g, "e"], [/[іІ]/g, "i"], [/[оО]/g, "o"],
  [/[рР]/g, "p"], [/[сС]/g, "c"], [/[уУ]/g, "u"], [/[хХ]/g, "x"],
  [/[ВЬ]/g, "b"], [/[кК]/g, "k"], [/[мМ]/g, "m"], [/[нН]/g, "h"],
  [/[αΑ]/g, "a"], [/[εΕ]/g, "e"], [/[ιΙ]/g, "i"], [/[οΟ]/g, "o"],
  [/[υΥ]/g, "u"], [/[νΝ]/g, "n"], [/[ρΡ]/g, "p"], [/[τΤ]/g, "t"],
  [/[𝐚-𝐳𝗮-𝘇𝘢-𝘻𝙖-𝙯𝚊-𝚣]/gu, (m) => String.fromCharCode(m.codePointAt(0)! - 0x1D400 + 97 & 0xFF)],
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
function normalizeLeet(text: string): string {
  return text
    .toLowerCase()
    .replace(/ph/g, "f")
    .replace(/[@4\^]/g, "a")
    .replace(/3/g, "e")
    .replace(/[!1|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7+]/g, "t")
    .replace(/\*/g, "u")
    .replace(/[(<]/g, "c")
    .replace(/[)>]/g, "o")
    .replace(/#/g, "h")
    .replace(/\\/g, "v")
    .replace(/\+/g, "t");
}

// ── Layer 4: Collapse spaced-out / separated letters ────────────────────────
function collapseSpaced(text: string): string {
  return text.replace(
    /\b([a-z])([\s._*\-,!@#%^&+=|\\/<>]+[a-z]){2,}\b/gi,
    (match) => match.replace(/[^a-zA-Z0-9]/g, ""),
  );
}

// ── Layer 5: Collapse repeated characters ─────────────────────────────────────
function collapseRepeatedToTwo(text: string): string {
  return text.replace(/(.)\1{2,}/g, "$1$1");
}
function collapseRepeated(text: string): string {
  return text.replace(/(.)\1+/g, "$1");
}

// ── Layer 6: Strip ALL non-alpha ──────────────────────────────────────────────
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

  const lcToTwo       = collapseRepeatedToTwo(lc);
  const lcToOne       = collapseRepeated(lc);
  const leetToTwo     = collapseRepeatedToTwo(leet);
  const leetToOne     = collapseRepeated(leet);
  const spacedToTwo   = collapseRepeatedToTwo(spaced);
  const leetSpcToTwo  = collapseRepeatedToTwo(leetSpaced);

  const stripped        = stripNonAlpha(leet);
  const strippedToTwo   = collapseRepeatedToTwo(stripped);
  const strippedToOne   = collapseRepeated(stripped);

  return [...new Set([
    lc, leet, spaced, leetSpaced,
    lcToTwo, lcToOne, leetToTwo, leetToOne,
    spacedToTwo, leetSpcToTwo,
    stripped, strippedToTwo, strippedToOne,
  ])];
}

// ── Logging helper ────────────────────────────────────────────────────────────
function logFlagged(category: FilterCategory, matchedTerm: string, variant: string, surface: string, userCtx?: UserContext): void {
  const ts = new Date().toISOString();
  const preview = variant.length > 60 ? variant.slice(0, 60) + "…" : variant;
  console.warn(`[content-filter] BLOCKED category=${category} term="${matchedTerm}" variant="${preview}" surface=${surface} at=${ts}`);
  pushBlockLog(category, surface, matchedTerm, userCtx);
}

// ── Core check ────────────────────────────────────────────────────────────────
export function checkContent(text: string, surface = "unknown", userCtx?: UserContext): FilterResult {
  if (!text || typeof text !== "string") return CLEAN;

  const trimmed = text.trim();
  if (!trimmed) return CLEAN;

  const variants = buildVariants(trimmed);

  // 1. Phrase matching (substring, no word boundaries — catches multi-word evasion)
  for (const { term, category } of PHRASE_TERMS) {
    for (const v of variants) {
      if (v.includes(term)) {
        logFlagged(category, term, v, surface, userCtx);
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
        logFlagged(category, term, v, surface, userCtx);
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
  const stripped = stripNonAlpha(normalizeLeet(stripInvisible(normalizeHomoglyphs(trimmed))));
  const strippedCollapsed = collapseRepeated(stripped);
  for (const { term, category } of PHRASE_TERMS) {
    const termStripped = stripNonAlpha(term.replace(/\s+/g, ""));
    if (strippedCollapsed.includes(termStripped)) {
      logFlagged(category, term, strippedCollapsed, surface, userCtx);
      return {
        flagged: true,
        category,
        message: CATEGORY_MESSAGES[category],
        matchedTerm: term,
        matchedVariant: strippedCollapsed,
      };
    }
  }

  // 4. Compound-word catch
  for (const { term, category } of WORD_TERMS) {
    if (term.length < 5) continue;
    if (strippedCollapsed.includes(term)) {
      logFlagged(category, term, strippedCollapsed, surface, userCtx);
      return {
        flagged: true,
        category,
        message: CATEGORY_MESSAGES[category],
        matchedTerm: term,
        matchedVariant: strippedCollapsed,
      };
    }
  }

  // 5. Semantic intent analysis
  const semanticText = normalizeLeet(normalizeHomoglyphs(stripInvisible(trimmed)));
  const semantic = checkSemantic(semanticText);
  if (semantic.flagged) {
    const semTerm = semantic.matchedTerm ?? "semantic";
    logFlagged("sexual_content", semTerm, semanticText, surface, userCtx);
    return {
      flagged: true,
      category: "sexual_content",
      message: semantic.message ?? CATEGORY_MESSAGES["sexual_content"],
      matchedTerm: semTerm,
      matchedVariant: semanticText,
    };
  }

  return CLEAN;
}

export function checkFields(fields: Record<string, string | undefined | null>, surface = "unknown", userCtx?: UserContext): FilterResult & { field?: string } {
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const result = checkContent(value, surface, userCtx);
    if (result.flagged) return { ...result, field };
  }
  return { ...CLEAN };
}

