import type { ChatSummary, NormalizedMessage } from "../core/types.js";
import type { ParsedEntry } from "./parse.js";

export interface MessagePage {
  entries: ParsedEntry[];
  nextPath: string | null;
}

export interface TeamsReader {
  canDetect(): boolean;
  canSend(): boolean;
  selfId(): string | null;
  listChats(): Promise<ChatSummary[]>;
  fetchPage(chatId: string, path: string | null): Promise<MessagePage>;
  readContext(chatId: string): Promise<NormalizedMessage[]>;
  verifyDestination(chatId: string): Promise<{ ok: true; label: string } | { ok: false; reason: string }>;
}

export const PAGE_SIZE = 50;
