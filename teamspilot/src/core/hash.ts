import { createHash } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function contextFingerprint(sourceMessageId: string, messages: { id: string; text: string }[]): string {
  return sha256([sourceMessageId, ...messages.map((message) => `${message.id}:${message.text}`)].join("\n"));
}
