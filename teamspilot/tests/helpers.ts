import http from "node:http";
import { createActivity } from "../src/core/redact.js";
import { DEFAULT_SETTINGS } from "../src/core/settings.js";
import { DraftStore, emptyState } from "../src/core/store.js";
import type { NormalizedMessage, Settings } from "../src/core/types.js";
import { AiConfigError, type AiProvider } from "../src/ai/provider.js";
import type { ReplyRequest } from "../src/ai/prompt.js";
import { DraftPipeline, type PipelineLogger } from "../src/pipeline/handle.js";
import { asPipelineStore } from "../src/pipeline/view.js";
import { ApprovalGate } from "../src/send/gate.js";
import type { MessageSender } from "../src/send/sender.js";
import { MemorySecretStore } from "../src/security/secrets.js";
import { createApp, createEventHub, type AppServices } from "../src/server/app.js";
import type { ProbeInterpretation } from "../src/teams/match-chat.js";
import { ChatMonitor, type Scheduler } from "../src/teams/monitor.js";
import type { MessagePage, TeamsReader } from "../src/teams/reader.js";

export class ManualScheduler implements Scheduler {
  tasks: { fn: () => void; cancelled: boolean }[] = [];
  schedule(fn: () => void): { cancel(): void } {
    const task = { fn, cancelled: false };
    this.tasks.push(task);
    return { cancel: () => { task.cancelled = true; } };
  }
  flush(): void {
    const tasks = this.tasks.splice(0);
    for (const task of tasks) if (!task.cancelled) task.fn();
  }
}

export class FakeReader implements TeamsReader {
  signedIn = true;
  self = "me";
  sendEnabled = true;
  verifyOk = true;
  polls = 0;
  chats = [
    { id: "chat-a", label: "Ada Lovelace", chatType: "oneOnOne" },
    { id: "chat-b", label: "Grace Hopper", chatType: "oneOnOne" },
  ];
  pages: Record<string, NormalizedMessage[]> = { "chat-a": [], "chat-b": [] };
  contextReads: string[] = [];

  canDetect(): boolean { return this.signedIn; }
  canSend(): boolean { return this.signedIn && this.sendEnabled; }
  selfId(): string | null { return this.signedIn ? this.self : null; }
  async listChats() { return this.chats; }
  async fetchPage(chatId: string): Promise<MessagePage> {
    this.polls += 1;
    const messages = [...(this.pages[chatId] ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      entries: messages.map((message) => ({
        id: message.id,
        createdAt: message.createdAt,
        message: { ...message, mine: message.mine || message.senderId === this.self },
      })),
      nextPath: null,
    };
  }
  async readContext(chatId: string): Promise<NormalizedMessage[]> {
    this.contextReads.push(chatId);
    const page = await this.fetchPage(chatId);
    return page.entries.flatMap((entry) => (entry.message ? [{ ...entry.message, chatId }] : []));
  }
  async verifyDestination(chatId: string) {
    if (!this.canSend()) return { ok: false as const, reason: "Teams sending is unavailable, so this draft stays in draft-only mode." };
    if (!this.verifyOk || !chatId) return { ok: false as const, reason: "The destination chat could not be verified, so nothing was sent." };
    const chat = this.chats.find((item) => item.id === chatId);
    if (!chat) return { ok: false as const, reason: "The destination chat could not be verified, so nothing was sent." };
    return { ok: true as const, label: chat.label };
  }
}

export class FakeSender implements MessageSender {
  calls: { draftId: string; chatId: string; text: string }[] = [];
  mode: "sent" | "failed" | "uncertain" | "throw" | "mismatch" = "sent";
  async deliver(input: { draftId: string; chatId: string; text: string }) {
    this.calls.push(input);
    if (this.mode === "throw") throw new Error("socket hang up");
    if (this.mode === "failed") return { outcome: "failed" as const, detail: "Microsoft Graph rejected the message. Nothing was sent." };
    if (this.mode === "uncertain") return { outcome: "uncertain" as const, detail: "No confirmation from Microsoft Graph." };
    if (this.mode === "mismatch") {
      return { outcome: "sent" as const, providerMessageId: "x", acceptedText: "different text", acceptedChatId: "other-chat" };
    }
    return { outcome: "sent" as const, providerMessageId: "graph-message-1", acceptedText: input.text, acceptedChatId: input.chatId };
  }
}

export class FakeAi implements AiProvider {
  calls: ReplyRequest[] = [];
  fail = false;
  reply = "I can review the notes this afternoon.";
  gate: Promise<void> | null = null;
  async generateReply(input: ReplyRequest, signal?: AbortSignal): Promise<string> {
    this.calls.push(input);
    if (this.gate) await this.gate;
    if (signal?.aborted) throw new Error("aborted");
    if (this.fail) throw new AiConfigError("The AI provider returned an error. Nothing was sent.");
    return this.reply;
  }
}

export function message(overrides: Partial<NormalizedMessage> = {}): NormalizedMessage {
  return {
    id: "m1",
    idSource: "graph",
    chatId: "chat-a",
    senderId: "ada",
    senderLabel: "Ada Lovelace",
    text: "Can you review the notes today?",
    createdAt: new Date(Date.now() + 5000).toISOString(),
    mine: false,
    ...overrides,
  };
}

export function harness(settings: Partial<Settings> = {}) {
  const store = new DraftStore(emptyState({
    ...DEFAULT_SETTINGS,
    model: "gpt-test",
    monitoredChatId: "chat-a",
    monitoredChatLabel: "Ada Lovelace",
    ...settings,
  }));
  const reader = new FakeReader();
  const sender = new FakeSender();
  const ai = new FakeAi();
  const scheduler = new ManualScheduler();
  const log: PipelineLogger = {
    info(event, fields) {
      store.addActivity(createActivity("info", event, fields, store.sensitiveSnippets(), store.getSettings().logMessageContent));
    },
    error(event, fields) {
      store.addActivity(createActivity("error", event, fields, store.sensitiveSnippets(), store.getSettings().logMessageContent));
    },
  };
  const pipeline = new DraftPipeline({
    store: asPipelineStore(store),
    ai,
    context: reader,
    settings: () => store.getSettings(),
    selfId: () => reader.selfId(),
    log,
    notify: { draftReady() {}, changed() {} },
  });
  const gate = new ApprovalGate(store, sender, reader, (level, event, fields) => log[level](event, fields));
  const monitor = new ChatMonitor({
    reader,
    pipeline,
    store,
    settings: () => store.getSettings(),
    saveSettings: (next) => store.saveSettings(next),
    probe: { async probe() { return emptyProbe(); } },
    log,
    scheduler,
  });
  return { store, reader, sender, ai, pipeline, gate, monitor, scheduler };
}

export function emptyProbe(): ProbeInterpretation {
  return {
    supported: false,
    teamsWindowFound: false,
    confidence: "none",
    followChatId: null,
    suggestedChatId: null,
    suggestedLabel: null,
    messageTextExposed: false,
    composerFound: false,
    canSendThroughUi: false,
    notes: [],
  };
}

export async function listen(app: ReturnType<typeof createApp>): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

export function servicesFor(parts: ReturnType<typeof harness>, secrets = new MemorySecretStore()): AppServices {
  return {
    store: parts.store,
    pipeline: parts.pipeline,
    gate: parts.gate,
    monitor: parts.monitor,
    reader: parts.reader,
    secrets,
    hub: createEventHub(),
    sessionToken: "test-session-token",
    dataDir: "/tmp/teamspilot-test",
    auth: {
      status: () => ({
        configured: true,
        signedIn: parts.reader.signedIn,
        account: parts.reader.signedIn ? { id: "me", displayName: "Me", username: "me@contoso.com" } : null,
        pending: null,
        lastError: null,
      }),
      startDeviceCode: async () => undefined,
      signOut: async () => { parts.reader.signedIn = false; },
    },
    probe: async () => emptyProbe(),
  };
}

export async function cookieFor(url: string): Promise<string> {
  const response = await fetch(`${url}/api/health`);
  const setCookie = response.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  if (!cookie) throw new Error("missing cookie");
  return cookie;
}

export function authed(cookie: string, body?: unknown): RequestInit {
  return {
    method: body === undefined ? "GET" : "POST",
    headers: { cookie, "content-type": "application/json", "x-teamspilot-request": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}
