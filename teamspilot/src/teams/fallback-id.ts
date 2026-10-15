import { sha256 } from "../core/hash.js";

/**
 * Graph chat messages normally include a stable id.
 * When an item has no id, TeamsPilot derives one from the chat, sender,
 * timestamp, and normalized text. The same inputs always produce the same id,
 * so a replay does not create a second draft. Two different messages that
 * share all four fields would collide; that is the documented fallback, not
 * a claim that every message has a provider id.
 */
export function fallbackMessageId(input: { chatId: string; senderId: string; createdAt: string; text: string }): string {
  const normalized = input.text.replace(/\s+/g, " ").trim();
  return `fallback:${sha256([input.chatId, input.senderId, input.createdAt, normalized].join("\n"))}`;
}
