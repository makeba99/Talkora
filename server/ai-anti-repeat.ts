export function normalizeReply(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/gi, "").replace(/\s+/g, " ").trim();
}

export function replySimilarity(a: string, b: string): number {
  const aWords = new Set(normalizeReply(a).split(" ").filter(Boolean));
  const bWords = new Set(normalizeReply(b).split(" ").filter(Boolean));
  if (!aWords.size || !bWords.size) return 0;
  const overlap = Array.from(aWords).filter((word) => bWords.has(word)).length;
  return overlap / Math.max(aWords.size, bWords.size);
}

export function isDuplicateReply(candidate: string, previous: string, threshold = 0.9): boolean {
  const a = normalizeReply(candidate);
  const b = normalizeReply(previous);
  if (!a || !b) return false;
  return a === b || replySimilarity(candidate, previous) >= threshold;
}

export function detectRepetitiveHistory(recentAiReplies: string[], similarThreshold = 0.78): boolean {
  return (
    recentAiReplies.length >= 2 &&
    recentAiReplies.some((reply, index) =>
      recentAiReplies.slice(index + 1).some((other) => reply === other || replySimilarity(reply, other) >= similarThreshold),
    )
  );
}

export function lastAssistantText(history: Array<{ role: string; content: string }>): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "assistant" && history[i].content) return history[i].content;
  }
  return "";
}

export { isTutorSystemErrorLine } from "@shared/spoken-tutor-line";

export function matchesAnyPriorReply(candidate: string, prior: string[], threshold = 0.72): boolean {
  return prior.some((p) => isDuplicateReply(candidate, p, threshold));
}
