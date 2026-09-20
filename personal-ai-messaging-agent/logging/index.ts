import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { redact } from "../security/index.ts";

export type LogLevel = "info" | "warn" | "error";

export function logEvent(
  db: Database,
  entry: {
    level?: LogLevel;
    event: string;
    platform?: string | null;
    conversationId?: string | null;
    detail: unknown;
  },
): void {
  const detail = JSON.stringify(redact(entry.detail));
  db.prepare(
    `INSERT INTO agent_logs (id, level, event, platform, conversation_id, detail, created_at)
     VALUES (@id, @level, @event, @platform, @conversationId, @detail, @createdAt)`,
  ).run({
    id: randomUUID(),
    level: entry.level || "info",
    event: entry.event,
    platform: entry.platform ?? null,
    conversationId: entry.conversationId ?? null,
    detail,
    createdAt: new Date().toISOString(),
  });
}

export function listLogs(db: Database, limit = 200) {
  return db
    .prepare(`SELECT * FROM agent_logs ORDER BY created_at DESC LIMIT ?`)
    .all(limit)
    .map((row: any) => ({
      ...row,
      detail: safeJson(row.detail),
    }));
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
