/**
 * Runtime helpers for feature entitlements (usage counters, etc.).
 * Pure entitlement rules live in @shared/entitlements — keep them in sync.
 */

import { talkingAiDailyLimit, type EntitlementUser } from "@shared/entitlements";
import { storage } from "./storage";

function usageDayKey(): string {
  return new Date().toISOString().slice(0, 10); // UTC day
}

export async function getTalkingAiUsage(userId: string): Promise<number> {
  const key = `ai_usage:${userId}:${usageDayKey()}`;
  const raw = await storage.getSetting(key);
  const n = parseInt(raw || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function incrementTalkingAiUsage(userId: string): Promise<number> {
  const key = `ai_usage:${userId}:${usageDayKey()}`;
  const used = await getTalkingAiUsage(userId);
  const next = used + 1;
  await storage.setSetting(key, String(next));
  return next;
}

/** Returns null when allowed; otherwise a payload for 429 responses. */
export async function checkTalkingAiQuota(
  user: EntitlementUser & { id: string },
): Promise<null | { error: string; message: string; used: number; limit: number }> {
  const limit = talkingAiDailyLimit(user);
  if (limit == null) return null;
  const used = await getTalkingAiUsage(user.id);
  if (used >= limit) {
    return {
      error: "usage_limit_reached",
      message: `Free Talking AI limit reached (${limit}/day). Become VIP for unlimited access.`,
      used,
      limit,
    };
  }
  return null;
}

/** Normalize conversation history for OpenAI chat/completions. */
export function normalizeAiHistory(
  history: any[],
  maxTurns = 12,
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(history)) return [];
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of history) {
    const text = typeof m?.text === "string" ? m.text.trim() : typeof m?.content === "string" ? m.content.trim() : "";
    if (!text) continue;
    const roleRaw = String(m?.role || "").toLowerCase();
    const role: "user" | "assistant" =
      roleRaw === "ai" || roleRaw === "assistant" || roleRaw === "system" ? "assistant" : "user";
    // Skip accidental system rows in history; system prompt is separate
    if (roleRaw === "system") continue;
    out.push({ role, content: text.slice(0, 2000) });
  }
  return out.slice(-maxTurns);
}
