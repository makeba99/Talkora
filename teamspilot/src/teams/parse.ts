import type { NormalizedMessage } from "../core/types.js";
import { fallbackMessageId } from "./fallback-id.js";
import { htmlToText } from "./html.js";

export interface ParsedEntry {
  id: string;
  createdAt: string;
  message: NormalizedMessage | null;
}

export function graphPathFromNextLink(link: string): string | null {
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" || url.hostname !== "graph.microsoft.com") return null;
    const path = url.pathname.replace(/^\/v1\.0/, "");
    return `${path}${url.search}`;
  } catch {
    return null;
  }
}

export function parseMessagePage(body: unknown, chatId: string, selfId: string): { entries: ParsedEntry[]; nextPath: string | null } {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const value = Array.isArray(record.value) ? record.value : [];
  const entries: ParsedEntry[] = [];
  for (const item of value) {
    const parsed = parseMessage(item, chatId, selfId);
    if (parsed) entries.push(parsed);
  }
  const next = typeof record["@odata.nextLink"] === "string" ? graphPathFromNextLink(record["@odata.nextLink"]) : null;
  return { entries, nextPath: next };
}

function parseMessage(raw: unknown, chatId: string, selfId: string): ParsedEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const message = raw as Record<string, unknown>;
  const messageType = typeof message.messageType === "string" ? message.messageType : "message";
  const createdAt = typeof message.createdDateTime === "string" ? message.createdDateTime : "";
  const rawId = typeof message.id === "string" ? message.id.trim() : "";
  if (messageType !== "message") {
    return rawId ? { id: rawId, createdAt, message: null } : null;
  }
  const from = message.from && typeof message.from === "object" ? (message.from as Record<string, unknown>) : {};
  const user = from.user && typeof from.user === "object" ? (from.user as Record<string, unknown>) : null;
  if (!user || typeof user.id !== "string" || !user.id) {
    return rawId ? { id: rawId, createdAt, message: null } : null;
  }
  const body = message.body && typeof message.body === "object" ? (message.body as Record<string, unknown>) : {};
  const text = htmlToText(typeof body.content === "string" ? body.content : "", typeof body.contentType === "string" ? body.contentType : "text");
  if (!text.trim()) return rawId ? { id: rawId, createdAt, message: null } : null;
  const senderId = user.id;
  const id = rawId || fallbackMessageId({ chatId, senderId, createdAt, text });
  return {
    id,
    createdAt,
    message: {
      id,
      idSource: rawId ? "graph" : "fallback",
      chatId,
      senderId,
      senderLabel: typeof user.displayName === "string" && user.displayName.trim() ? user.displayName.trim() : "Unknown sender",
      text,
      createdAt,
      mine: Boolean(selfId) && senderId === selfId,
    },
  };
}

export function chatLabelFromGraph(chat: unknown, selfId: string): { id: string; label: string; chatType: string } | null {
  if (!chat || typeof chat !== "object") return null;
  const record = chat as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id) return null;
  const topic = typeof record.topic === "string" ? record.topic.trim() : "";
  const members = Array.isArray(record.members) ? record.members : [];
  const names = members
    .filter((member) => {
      if (!member || typeof member !== "object") return false;
      const userId = (member as { userId?: unknown }).userId;
      return userId !== selfId;
    })
    .map((member) => {
      const name = (member as { displayName?: unknown }).displayName;
      return typeof name === "string" ? name.trim() : "";
    })
    .filter(Boolean);
  return {
    id: record.id,
    label: topic || names.join(", ") || "Untitled chat",
    chatType: typeof record.chatType === "string" ? record.chatType : "unknown",
  };
}
