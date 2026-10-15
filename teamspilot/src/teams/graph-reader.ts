import type { ChatSummary, NormalizedMessage } from "../core/types.js";
import { chatLabelFromGraph, graphPathFromNextLink, parseMessagePage } from "./parse.js";
import { PAGE_SIZE, type MessagePage, type TeamsReader } from "./reader.js";
import type { GraphRequest } from "./graph-request.js";

export class GraphTeamsReader implements TeamsReader {
  constructor(
    private readonly graph: GraphRequest,
    private readonly identity: () => { signedIn: boolean; selfId: string | null },
  ) {}

  canDetect(): boolean {
    const identity = this.identity();
    return identity.signedIn && Boolean(identity.selfId);
  }

  canSend(): boolean {
    return this.canDetect();
  }

  selfId(): string | null {
    return this.identity().selfId;
  }

  async listChats(): Promise<ChatSummary[]> {
    const selfId = this.selfId() ?? "";
    const chats: ChatSummary[] = [];
    let path: string | null = `/me/chats?$top=${PAGE_SIZE}&$expand=members`;
    let pages = 0;
    let expand = true;
    while (path && pages < 4) {
      const response = await this.graph.request("GET", path);
      if (!response.status || response.status === 400 || response.status === 403) {
        if (expand) {
          expand = false;
          path = `/me/chats?$top=${PAGE_SIZE}`;
          continue;
        }
      }
      if (response.status !== 200) {
        throw new Error("Microsoft Graph could not list chats.");
      }
      const body = response.body && typeof response.body === "object" ? (response.body as Record<string, unknown>) : {};
      const value = Array.isArray(body.value) ? body.value : [];
      for (const item of value) {
        const chat = chatLabelFromGraph(item, selfId);
        if (chat) chats.push(chat);
      }
      const next = typeof body["@odata.nextLink"] === "string" ? body["@odata.nextLink"] : "";
      path = next ? graphPathFromNextLink(next) : null;
      pages += 1;
    }
    return chats;
  }

  async fetchPage(chatId: string, path: string | null): Promise<MessagePage> {
    const requestPath = path ?? `/chats/${encodeURIComponent(chatId)}/messages?$top=${PAGE_SIZE}&$orderby=createdDateTime desc`;
    const response = await this.graph.request("GET", requestPath);
    if (response.status !== 200) throw new Error("Microsoft Graph could not read this chat.");
    return parseMessagePage(response.body, chatId, this.selfId() ?? "");
  }

  async readContext(chatId: string): Promise<NormalizedMessage[]> {
    const page = await this.fetchPage(chatId, null);
    return page.entries
      .map((entry) => entry.message)
      .filter((message): message is NormalizedMessage => Boolean(message))
      .reverse();
  }

  async verifyDestination(chatId: string): Promise<{ ok: true; label: string } | { ok: false; reason: string }> {
    if (!chatId || !this.canSend()) {
      return { ok: false, reason: "Teams sending is unavailable, so this draft stays in draft-only mode." };
    }
    const response = await this.graph.request("GET", `/chats/${encodeURIComponent(chatId)}`);
    if (response.status !== 200) {
      return { ok: false, reason: "The destination chat could not be verified, so nothing was sent." };
    }
    const chat = chatLabelFromGraph(response.body, this.selfId() ?? "");
    if (!chat || chat.id !== chatId) {
      return { ok: false, reason: "The destination chat did not match this draft, so nothing was sent." };
    }
    return { ok: true, label: chat.label };
  }
}
