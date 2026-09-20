import path from "node:path";
import { describe, expect, it } from "vitest";
import { AgentRuntime, checkRateLimit, bumpRateLimit } from "../agent/orchestrator.ts";
import { openDatabase, updateSettings } from "../database/index.ts";
import type { PlatformConnector, NormalizedMessage, NormalizedConversation, SendResult } from "../connectors/platform-connector.ts";
import { IntegrationUnavailable } from "../connectors/platform-connector.ts";
import { generateReply, detectLanguage, qualityCheck } from "../ai/reply-engine.ts";
import { assertLocalhostBind, encryptSecret, decryptSecret, redact } from "../security/index.ts";
import { listLogs } from "../logging/index.ts";
import { logEvent } from "../logging/index.ts";

const ROOT = path.resolve(import.meta.dirname, "..");

class MockTeams implements PlatformConnector {
  readonly platform = "teams" as const;
  connected = true;
  failSend = false;
  sent: Array<{ body: string; simulate?: boolean }> = [];
  conversations: NormalizedConversation[] = [
    { platform: "teams", externalId: "chat-1", title: "Ada / Bob", lastMessageAt: "2026-01-01T00:00:00Z" },
  ];
  messages: NormalizedMessage[] = [
    {
      platform: "teams",
      externalId: "in-1",
      conversationExternalId: "chat-1",
      conversationTitle: "Ada / Bob",
      direction: "inbound",
      senderName: "Bob",
      body: "Can we meet tomorrow?",
      sentAt: "2026-01-01T00:00:00Z",
      rawType: "graph.chatMessage",
    },
  ];

  async connect() {
    this.connected = true;
    return { status: "connected" as const, message: "ok", currentUser: { id: "u1", displayName: "Ada" } };
  }
  async disconnect() { this.connected = false; }
  async getStatus() {
    return { status: this.connected ? "connected" as const : "disconnected" as const, message: "mock", integration: { available: true, exists: [], missing: [], canBuild: [], requiredConfig: [] } };
  }
  async getConversations() { return this.conversations; }
  async getConversation(id: string) { return this.conversations.find((c) => c.externalId === id) || null; }
  async getMessages() { return this.messages; }
  async watchForNewMessages() { return () => undefined; }
  async sendMessage(_id: string, body: string, options?: { simulate?: boolean }): Promise<SendResult> {
    if (this.failSend) throw new Error("Graph 403 Forbidden");
    this.sent.push({ body, simulate: options?.simulate });
    return { simulated: Boolean(options?.simulate), externalId: options?.simulate ? undefined : "out-1", sentAt: new Date().toISOString() };
  }
  async markAsRead() {}
  async getCurrentUser() { return { id: "u1", displayName: "Ada" }; }
  async logout() { this.connected = false; }
  async openPlatform() { return { url: "https://teams.microsoft.com/" }; }
}

describe("AI reply engine", () => {
  it("detects language and stays generic (no platform APIs)", async () => {
    expect(detectLanguage("Hola, ¿puedes confirmar?")).toBe("es");
    const result = await generateReply({
      platform: "teams",
      conversationTitle: "Chat",
      conversationCategory: "work",
      messages: [{ direction: "inbound", senderName: "Bob", body: "Can you confirm the time?", sentAt: "t" }],
      styleExamples: ["Sure — I'll look and ping you."],
      memory: [{ key: "pref", value: "short replies" }],
      settings: { mode: "approval", simulationEnabled: true },
    });
    expect(result.reply.length).toBeGreaterThan(2);
    expect(result.engine).toBe("local-heuristic");
    expect(result.recommended_action).not.toBe("skip");
  });

  it("skips no-reply traffic", () => {
    expect(qualityCheck("ok enough", "This is an automated message, do not reply")).toMatchObject({ ok: false });
  });
});

describe("Agent runtime", () => {
  it("default approval + simulation never live-sends", async () => {
    const db = openDatabase(ROOT, ":memory:");
    const teams = new MockTeams();
    const runtime = new AgentRuntime(db, { teams }, ROOT);
    await runtime.ingestFromConnectors();
    const processed = await runtime.processInbox();
    expect(processed.drafts).toBeGreaterThanOrEqual(1);
    expect(teams.sent.length).toBe(0);
    const pending = db.prepare(`SELECT * FROM drafts WHERE status = 'pending'`).all() as any[];
    expect(pending.length).toBeGreaterThan(0);
    const result = await runtime.approveDraft(pending[0].id);
    expect(result).toMatchObject({ simulated: true });
    expect(teams.sent[0].simulate).toBe(true);
    db.close();
  });

  it("auto mode requires per-platform and per-conversation opt-in", async () => {
    const db = openDatabase(ROOT, ":memory:");
    updateSettings(db, { mode: "auto" });
    const teams = new MockTeams();
    const runtime = new AgentRuntime(db, { teams }, ROOT);
    await runtime.ingestFromConnectors();
    await runtime.processInbox();
    expect(teams.sent.length).toBe(0);
    db.prepare(`UPDATE platform_settings SET auto_enabled = 1 WHERE platform = 'teams'`).run();
    db.prepare(`UPDATE conversations SET auto_enabled = 1`).run();
    db.prepare(`DELETE FROM drafts`).run();
    db.prepare(`DELETE FROM messages`).run();
    teams.messages[0].externalId = "in-2";
    await runtime.ingestFromConnectors();
    await runtime.processInbox();
    expect(teams.sent.length).toBe(1);
    expect(teams.sent[0].simulate).toBe(true);
    db.close();
  });

  it("emergency stop blocks dispatch", async () => {
    const db = openDatabase(ROOT, ":memory:");
    const teams = new MockTeams();
    const runtime = new AgentRuntime(db, { teams }, ROOT);
    await runtime.ingestFromConnectors();
    await runtime.processInbox();
    runtime.emergencyStop(true);
    const draft = db.prepare(`SELECT * FROM drafts WHERE status = 'pending'`).get() as any;
    await expect(runtime.approveDraft(draft.id)).rejects.toThrow(/Emergency stop/);
    db.close();
  });

  it("duplicate protection blocks a second send of the same reply", async () => {
    const db = openDatabase(ROOT, ":memory:");
    const teams = new MockTeams();
    const runtime = new AgentRuntime(db, { teams }, ROOT);
    await runtime.ingestFromConnectors();
    await runtime.processInbox();
    const draft = db.prepare(`SELECT * FROM drafts WHERE status = 'pending'`).get() as any;
    await runtime.approveDraft(draft.id);
    db.prepare(`UPDATE drafts SET status = 'pending' WHERE id = ?`).run(draft.id);
    const second = await runtime.approveDraft(draft.id);
    expect(second).toMatchObject({ duplicate: true });
    expect(teams.sent.length).toBe(1);
    db.close();
  });

  it("rate limits extra replies in the same hour", () => {
    const db = openDatabase(ROOT, ":memory:");
    expect(checkRateLimit(db, "teams:c1", 1).allowed).toBe(true);
    bumpRateLimit(db, "teams:c1");
    expect(checkRateLimit(db, "teams:c1", 1).allowed).toBe(false);
    db.close();
  });

  it("records failed send without claiming success", async () => {
    const db = openDatabase(ROOT, ":memory:");
    const teams = new MockTeams();
    teams.failSend = true;
    const runtime = new AgentRuntime(db, { teams }, ROOT);
    await runtime.ingestFromConnectors();
    await runtime.processInbox();
    const draft = db.prepare(`SELECT * FROM drafts WHERE status = 'pending'`).get() as any;
    await expect(runtime.approveDraft(draft.id)).rejects.toThrow(/403/);
    const sent = db.prepare(`SELECT * FROM sent_messages`).get() as any;
    expect(sent.error).toMatch(/403/);
    expect(draft && db.prepare(`SELECT status FROM drafts WHERE id = ?`).get(draft.id)).toMatchObject({ status: "failed" });
    db.close();
  });

  it("pauses a platform", async () => {
    const db = openDatabase(ROOT, ":memory:");
    const teams = new MockTeams();
    const runtime = new AgentRuntime(db, { teams }, ROOT);
    await runtime.ingestFromConnectors();
    runtime.pausePlatform("teams", true);
    const processed = await runtime.processInbox();
    expect(processed.skipped).toBeGreaterThanOrEqual(1);
    expect(teams.sent.length).toBe(0);
    db.close();
  });

  it("stores memory and style examples", () => {
    const db = openDatabase(ROOT, ":memory:");
    db.prepare(`UPDATE style_profiles SET examples = ? WHERE id = 'default'`).run(JSON.stringify(["cheers, Ada"]));
    db.prepare(`INSERT INTO conversation_memory (id, conversation_id, platform, key, value, created_at) VALUES ('1', NULL, NULL, 'timezone', 'PT', ?)`).run(new Date().toISOString());
    const style = db.prepare(`SELECT examples FROM style_profiles WHERE id = 'default'`).get() as any;
    expect(JSON.parse(style.examples)[0]).toBe("cheers, Ada");
    const mem = db.prepare(`SELECT key FROM conversation_memory`).get() as any;
    expect(mem.key).toBe("timezone");
    db.close();
  });

  it("logs activity without secrets", () => {
    const db = openDatabase(ROOT, ":memory:");
    logEvent(db, { event: "test", detail: { access_token: "super-secret-token-value-1234567890", note: "ok" } });
    const logs = listLogs(db, 10);
    expect(JSON.stringify(logs[0].detail)).not.toContain("super-secret-token");
    expect(logs[0].detail.note).toBe("ok");
    db.close();
  });
});

describe("security", () => {
  it("refuses non-localhost binds", () => {
    expect(() => assertLocalhostBind("0.0.0.0")).toThrow(/local-only/i);
    expect(() => assertLocalhostBind("127.0.0.1")).not.toThrow();
  });

  it("encrypts session payloads and redacts tokens", () => {
    const blob = encryptSecret(ROOT, JSON.stringify({ refresh_token: "abc" }));
    expect(blob.startsWith("v1:")).toBe(true);
    expect(decryptSecret(ROOT, blob)).toContain("abc");
    expect(redact({ refresh_token: "abc", hello: "world" })).toMatchObject({ refresh_token: "[redacted]", hello: "world" });
  });
});

describe("Free4Talk unavailable through the agent", () => {
  it("ingest records integration unavailable instead of fake chats", async () => {
    const db = openDatabase(ROOT, ":memory:");
    const f4t = {
      platform: "free4talk" as const,
      async connect() { return { status: "integration_unavailable" as const, message: "no api" }; },
      async disconnect() {},
      async getStatus() {
        return { status: "connected" as const, message: "browser only", integration: { available: false, exists: [], missing: [], canBuild: [], requiredConfig: [] } };
      },
      async getConversations() {
        throw new IntegrationUnavailable("free4talk", "getConversations", {
          available: false,
          reason: "no api",
          exists: [],
          missing: [],
          canBuild: [],
          requiredConfig: [],
        });
      },
      async getConversation() { return null; },
      async getMessages() { return []; },
      async watchForNewMessages() { return () => undefined; },
      async sendMessage() { throw new Error("no"); },
      async markAsRead() {},
      async getCurrentUser() { return null; },
      async logout() {},
      async openPlatform() { return { url: "https://www.free4talk.com" }; },
    };
    const runtime = new AgentRuntime(db, { free4talk: f4t }, ROOT);
    const ingest = await runtime.ingestFromConnectors();
    expect(ingest.ingested).toBe(0);
    expect(ingest.skipped.join(" ")).toMatch(/unavailable|no api/i);
    db.close();
  });
});
