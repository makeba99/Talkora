import { chmodSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applySettingsPatch, parseStoredSettings } from "../src/core/settings.js";
import { sanitizeFields } from "../src/core/redact.js";
import { DraftStore, emptyState } from "../src/core/store.js";
import { fallbackMessageId } from "../src/teams/fallback-id.js";
import { htmlToText } from "../src/teams/html.js";
import { interpretProbe, normalizeLabel } from "../src/teams/match-chat.js";
import { parseMessagePage, graphPathFromNextLink } from "../src/teams/parse.js";
import { parseProbeOutput } from "../src/teams/uia.js";
import { GraphMessageSender } from "../src/send/graph-sender.js";
import type { GraphRequest, GraphResponse } from "../src/teams/graph-request.js";
import { GraphTeamsReader } from "../src/teams/graph-reader.js";
import { FileSecretStore } from "../src/security/secrets.js";
import { loadState, persistState } from "../src/storage/state-file.js";
import { recoverDrafts } from "../src/core/recovery.js";
import { DEFAULT_SETTINGS } from "../src/core/settings.js";
import { OpenAiProvider } from "../src/ai/openai.js";

describe("Graph parsing and sending", () => {
  it("strips HTML, skips the signed-in user, and falls back when an id is missing", () => {
    const page = parseMessagePage({
      value: [
        {
          id: "mine",
          messageType: "message",
          createdDateTime: "2026-10-15T12:00:00Z",
          from: { user: { id: "me", displayName: "Me" } },
          body: { contentType: "text", content: "my own note" },
        },
        {
          id: "ada",
          messageType: "message",
          createdDateTime: "2026-10-15T12:01:00Z",
          from: { user: { id: "ada", displayName: "Ada" } },
          body: { contentType: "html", content: "<p>Hello&nbsp;<b>there</b></p>" },
        },
        {
          messageType: "message",
          createdDateTime: "2026-10-15T12:02:00Z",
          from: { user: { id: "ada", displayName: "Ada" } },
          body: { contentType: "text", content: "no id" },
        },
        { id: "system", messageType: "systemEventMessage", createdDateTime: "2026-10-15T12:03:00Z", body: { content: "joined" } },
      ],
      "@odata.nextLink": "https://evil.example/steal",
    }, "chat-a", "me");
    expect(page.entries.find((entry) => entry.id === "mine")?.message?.mine).toBe(true);
    expect(page.entries.find((entry) => entry.id === "ada")?.message?.text).toBe("Hello there");
    const fallback = page.entries.find((entry) => entry.message?.idSource === "fallback");
    expect(fallback?.id).toBe(fallbackMessageId({ chatId: "chat-a", senderId: "ada", createdAt: "2026-10-15T12:02:00Z", text: "no id" }));
    expect(page.nextPath).toBeNull();
    expect(graphPathFromNextLink("https://graph.microsoft.com/v1.0/chats/1/messages?$skiptoken=abc")).toBe("/chats/1/messages?$skiptoken=abc");
    expect(htmlToText("<p>A<br>B</p>", "html")).toBe("A\nB");
  });

  it("sends once and classifies Graph results without retrying", async () => {
    const calls: { method: string; path: string; body?: unknown }[] = [];
    const transport = (status: number, body: unknown): GraphRequest => ({
      async request(method, path, requestBody) {
        calls.push({ method, path, body: requestBody });
        if (status === 599) throw new Error("timed out");
        return { status, body } satisfies GraphResponse;
      },
    });
    const text = "Friday works.";
    const sent = await new GraphMessageSender(transport(201, { id: "graph-1" })).deliver({ draftId: "d", chatId: "19:chat@thread.v2", text });
    expect(sent).toMatchObject({ outcome: "sent", providerMessageId: "graph-1", acceptedText: text, acceptedChatId: "19:chat@thread.v2" });
    expect(calls).toEqual([{
      method: "POST",
      path: "/chats/19%3Achat%40thread.v2/messages",
      body: { body: { contentType: "text", content: text } },
    }]);
    expect((await new GraphMessageSender(transport(400, { error: { code: "BadRequest" } })).deliver({ draftId: "d", chatId: "c", text })).outcome).toBe("failed");
    expect((await new GraphMessageSender(transport(500, {})).deliver({ draftId: "d", chatId: "c", text })).outcome).toBe("uncertain");
    expect((await new GraphMessageSender(transport(201, {})).deliver({ draftId: "d", chatId: "c", text })).outcome).toBe("uncertain");
    expect((await new GraphMessageSender(transport(599, {})).deliver({ draftId: "d", chatId: "c", text })).outcome).toBe("uncertain");
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(5);
  });

  it("does not let the reader post messages", async () => {
    const methods: string[] = [];
    const reader = new GraphTeamsReader({
      async request(method) {
        methods.push(method);
        if (method !== "GET") throw new Error("write attempted");
        return { status: 200, body: { id: "me", value: [] } };
      },
    }, () => ({ signedIn: true, selfId: "me" }));
    await reader.listChats();
    await reader.fetchPage("chat-a", null);
    expect(methods).toEqual(["GET", "GET"]);
  });
});

describe("settings, redaction, probe, and local files", () => {
  it("rejects automatic sending and keeps stored settings strict", () => {
    expect(() => applySettingsPatch({ ...DEFAULT_SETTINGS }, { autoSend: true })).toThrow(/Automatic sending/);
    const parsed = parseStoredSettings({ ...DEFAULT_SETTINGS, autoSend: true, model: "gpt-4.1-mini" });
    expect(parsed.ignoredAutoSend).toBe(true);
    expect(parsed.settings.model).toBe("gpt-4.1-mini");
    expect("autoSend" in parsed.settings).toBe(false);
  });

  it("redacts message text and keys from log fields", () => {
    const cleaned = sanitizeFields({ detail: "Please review the Q3 packet before Friday.", status: "pending_review" }, ["Please review the Q3 packet before Friday."], false);
    expect(cleaned.detail).toBe("[redacted]");
    expect(sanitizeFields({ detail: "Bearer sk-abcdefghijklmnopqrstuvwxyz and more" }, [], true).detail).not.toContain("sk-abc");
  });

  it("treats only a unique selected item as permission to follow a chat", () => {
    const chats = [
      { id: "chat-a", label: "Ada Lovelace", chatType: "oneOnOne" },
      { id: "chat-b", label: "Grace Hopper", chatType: "oneOnOne" },
    ];
    expect(normalizeLabel("Ada Lovelace | Microsoft Teams")).toBe("ada lovelace");
    const high = interpretProbe({ supported: true, teamsWindowFound: true, windowTitle: "Microsoft Teams", selectedLabels: ["Ada Lovelace"], messageTextExposed: true, composerFound: true, notes: [] }, chats);
    expect(high.confidence).toBe("high");
    expect(high.followChatId).toBe("chat-a");
    expect(high.canSendThroughUi).toBe(false);
    const low = interpretProbe({ supported: true, teamsWindowFound: true, windowTitle: "Grace Hopper | Microsoft Teams", selectedLabels: [], messageTextExposed: false, composerFound: false, notes: [] }, chats);
    expect(low.confidence).toBe("low");
    expect(low.followChatId).toBeNull();
    expect(low.suggestedChatId).toBe("chat-b");
    const parsed = parseProbeOutput('noise {"teamsWindowFound":true,"windowTitle":"Ada | Microsoft Teams","selectedLabels":"Ada","messageTextExposed":false,"composerFound":false,"notes":"probe"}');
    expect(parsed.selectedLabels).toEqual(["Ada"]);
  });

  it("stores drafts outside the secret file and recovers an in-flight send", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "teamspilot-"));
    const secrets = new FileSecretStore(path.join(dir, "secrets.json"));
    const stateFile = path.join(dir, "state.json");
    const store = new DraftStore(emptyState(), (state) => persistState(stateFile, state));
    const draft = store.create({
      sourceMessageId: "m",
      chatId: "chat-a",
      chatLabel: "Ada",
      senderId: "ada",
      senderLabel: "Ada",
      originalMessage: "secret conversation text",
      source: "teams",
    });
    store.update(draft.id, { status: "pending_review", currentReply: "reply text", generatedReply: "reply text" });
    store.beginSend(draft.id);
    return secrets.set("openai-api-key", "sk-test-key-1234567890").then(() => {
      const saved = readFileSync(stateFile, "utf8");
      expect(saved).not.toContain("sk-test-key");
      expect(readFileSync(path.join(dir, "secrets.json"), "utf8")).toContain("sk-test-key");
      if (process.platform !== "win32") expect(statSync(path.join(dir, "secrets.json")).mode & 0o777).toBe(0o600);
      chmodSync(stateFile, 0o600);
      const reloaded = new DraftStore(loadState(stateFile).state);
      recoverDrafts(reloaded);
      expect(reloaded.get(draft.id)?.status).toBe("uncertain");
      expect(reloaded.list().some((item) => item.status === "sent")).toBe(false);
    });
  });

  it("sends the configured model and keeps the API key out of errors", async () => {
    const key = "sk-test-key-12345678901234567890";
    let seen: { model?: string; authorization?: string } = {};
    const provider = new OpenAiProvider({
      apiKey: async () => key,
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { model: string };
        const headers = new Headers(init?.headers);
        seen = { model: body.model, authorization: headers.get("authorization") ?? "" };
        return new Response(JSON.stringify({ error: { message: key } }), { status: 401 });
      },
    });
    await expect(provider.generateReply({
      model: "gpt-4.1-mini",
      style: "concise",
      languageMode: "match",
      fixedLanguage: "",
      chatLabel: "Ada",
      incoming: { id: "1", idSource: "graph", chatId: "c", senderId: "a", senderLabel: "Ada", text: "Hello", createdAt: "2026-10-15T00:00:00Z", mine: false },
      context: [],
    })).rejects.toThrow(/rejected the API key/);
    try {
      await provider.generateReply({
        model: "gpt-4.1-mini",
        style: "concise",
        languageMode: "match",
        fixedLanguage: "",
        chatLabel: "Ada",
        incoming: { id: "1", idSource: "graph", chatId: "c", senderId: "a", senderLabel: "Ada", text: "Hello", createdAt: "2026-10-15T00:00:00Z", mine: false },
        context: [],
      });
    } catch (error) {
      expect(error instanceof Error ? error.message : "").not.toContain(key);
    }
    expect(seen.model).toBe("gpt-4.1-mini");
    expect(seen.authorization).toBe(`Bearer ${key}`);
  });
});
