// ─── Vextorn Content Filter ────────────────────────────────────────────────────
// Multi-layer detection: keyword matching, leet-speak normalisation, spaced-out
// letter detection, and phrase substring matching.
//
// Usage:
//   import { checkContent } from "./content-filter";
//   const result = checkContent(userText);
//   if (result.flagged) { /* block and warn */ }

import { WORD_TERMS, PHRASE_TERMS, CATEGORY_MESSAGES, FilterCategory } from "./moderation-words";

export interface FilterResult {
  flagged: boolean;
  category?: FilterCategory;
  /** Ready-to-send user-facing warning message */
  message: string;
}

const CLEAN: FilterResult = { flagged: false, message: "" };

// ── Escape a string for use inside a RegExp ────────────────────────────────────
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Leet-speak normalisation ───────────────────────────────────────────────────
// Converts common character substitutions back to their letter equivalents.
function normalizeLeet(text: string): string {
  return text
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/3/g, "e")
    .replace(/[!1]/g, "i")
    .replace(/0/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t")
    .replace(/\*/g, "u")   // f**k → fuk  (close enough for word-boundary match)
    .replace(/\(/g, "c")   // (ock
    .replace(/\)/g, "o");
}

// ── Collapse spaced-out letters ────────────────────────────────────────────────
// "f u c k"  or  "f.u.c.k"  →  "fuck"
// Only collapses runs of single characters separated by non-alpha separators.
function collapseSpaced(text: string): string {
  // Match sequences of (single-char)(separator)(single-char)... with ≥3 chars total
  return text.replace(
    /\b([a-z])([\s._*\-,]+[a-z]){2,}\b/gi,
    (match) => match.replace(/[^a-zA-Z0-9]/g, ""),
  );
}

// ── Build a set of text variants to check ─────────────────────────────────────
function buildVariants(raw: string): string[] {
  const lc       = raw.toLowerCase();
  const leet     = normalizeLeet(raw);
  const spaced   = collapseSpaced(lc);
  const leetSpaced = collapseSpaced(leet);
  // Deduplicate — avoids redundant regex runs on identical strings
  return [...new Set([lc, leet, spaced, leetSpaced])];
}

// ── Core check ────────────────────────────────────────────────────────────────
export function checkContent(text: string): FilterResult {
  if (!text || typeof text !== "string") return CLEAN;

  const trimmed = text.trim();
  if (!trimmed) return CLEAN;

  const variants = buildVariants(trimmed);

  // 1. Phrase matching (substring, no word boundaries needed)
  for (const { term, category } of PHRASE_TERMS) {
    for (const v of variants) {
      if (v.includes(term)) {
        return { flagged: true, category, message: CATEGORY_MESSAGES[category] };
      }
    }
  }

  // 2. Word-boundary matching (won't fire inside legitimate words)
  for (const { term, category } of WORD_TERMS) {
    const re = new RegExp(`\\b${escapeRe(term)}\\b`);
    for (const v of variants) {
      if (re.test(v)) {
        return { flagged: true, category, message: CATEGORY_MESSAGES[category] };
      }
    }
  }

  return CLEAN;
}

// ── Convenience: check multiple fields, return first violation found ───────────
export function checkFields(fields: Record<string, string | undefined | null>): FilterResult & { field?: string } {
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const result = checkContent(value);
    if (result.flagged) return { ...result, field };
  }
  return CLEAN;
}
