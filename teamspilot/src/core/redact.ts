import { randomUUID } from "node:crypto";
import type { ActivityEntry } from "./types.js";

const ALLOWED = ["draftId", "chatId", "detail", "status", "outcome", "httpStatus", "count"] as const;

export interface LogFields {
  draftId?: string;
  chatId?: string;
  detail?: string;
  status?: string;
  outcome?: string;
  httpStatus?: number;
  count?: number;
}

export function sanitizeFields(fields: LogFields | undefined, snippets: string[], allowContent: boolean): LogFields {
  const out: Record<string, string | number> = {};
  if (!fields) return {};
  for (const key of ALLOWED) {
    const value = fields[key];
    if (value === undefined) continue;
    if (typeof value === "string") {
      const redacted = value
        .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted-key]")
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
      const hit = snippets.some((snippet) => snippet.length >= 12 && redacted.includes(snippet));
      out[key] = hit && !(allowContent && key === "detail") ? "[redacted]" : redacted;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function createActivity(level: ActivityEntry["level"], event: string, fields: LogFields | undefined, snippets: string[], allowContent: boolean): ActivityEntry {
  return {
    id: randomUUID(),
    at: new Date().toISOString(),
    level,
    event,
    ...sanitizeFields(fields, snippets, allowContent),
  };
}
