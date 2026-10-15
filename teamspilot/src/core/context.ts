import type { NormalizedMessage } from "./types.js";

const MAX_TURN = 2000;
const MAX_TURNS = 12;

export function isolateContext(messages: NormalizedMessage[], chatId: string, sourceMessageId: string): NormalizedMessage[] {
  return messages
    .filter((message) => message.chatId === chatId && message.id !== sourceMessageId && message.text.trim().length > 0)
    .slice(-MAX_TURNS)
    .map((message) => ({ ...message, text: cap(message.text, MAX_TURN) }));
}

export function cap(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
