import { describe, expect, it } from "vitest";
import { Free4TalkConnector, free4talkReport } from "../connectors/free4talk/index.ts";
import { IntegrationUnavailable } from "../connectors/platform-connector.ts";
import {
  getMe,
  htmlToText,
  listChatMessages,
  listChats,
  pollDeviceToken,
  requestDeviceCode,
  sendChatMessage,
  GRAPH_BASE,
  LOGIN_BASE,
} from "../connectors/teams/graph.ts";
import { normalizeMessage } from "../connectors/platform-connector.ts";

describe("Free4Talk connector", () => {
  const connector = new Free4TalkConnector("/tmp/f4t-test", false);

  it("reports Integration unavailable for retrieval and send", async () => {
    await expect(connector.getConversations()).rejects.toBeInstanceOf(IntegrationUnavailable);
    await expect(connector.getMessages("x")).rejects.toBeInstanceOf(IntegrationUnavailable);
    await expect(connector.sendMessage("x", "hi")).rejects.toBeInstanceOf(IntegrationUnavailable);
    await expect(connector.sendMessage("x", "hi", { simulate: true })).rejects.toBeInstanceOf(IntegrationUnavailable);
    const status = await connector.getStatus();
    expect(status.integration.available).toBe(false);
    expect(status.integration.exists.length).toBeGreaterThan(0);
    expect(status.integration.missing.join(" ")).toMatch(/Official developer documentation/i);
    expect(free4talkReport.available).toBe(false);
  });

  it("connect does not fake a messaging login", async () => {
    const result = await connector.connect();
    expect(["integration_unavailable", "awaiting_user", "not_configured"]).toContain(result.status);
    expect(result.message.toLowerCase()).not.toMatch(/password/);
  });

  it("opens the real Free4Talk origin", async () => {
    expect(await connector.openPlatform()).toEqual({ url: "https://www.free4talk.com" });
  });
});

describe("Teams Graph client (mocked HTTP)", () => {
  it("device code + me + chats + messages + send use documented endpoints", async () => {
    const calls: string[] = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method || "GET"} ${url}`);
      if (url.includes("/devicecode")) {
        return json({
          device_code: "dc",
          user_code: "ABCD",
          verification_uri: "https://microsoft.com/devicelogin",
          expires_in: 900,
          interval: 5,
          message: "Open microsoft.com/devicelogin",
        });
      }
      if (url.includes("/token") && String(init?.body).includes("device_code")) {
        return json({
          token_type: "Bearer",
          expires_in: 3600,
          access_token: "access",
          refresh_token: "refresh",
        });
      }
      if (url.startsWith(`${GRAPH_BASE}/me?`) || url === `${GRAPH_BASE}/me`) {
        return json({ id: "u1", displayName: "Ada", mail: "ada@contoso.com", userPrincipalName: "ada@contoso.com" });
      }
      if (url.includes("/me/chats")) {
        return json({
          value: [{ id: "19:chat1", topic: "Project", chatType: "oneOnOne", lastUpdatedDateTime: "2026-01-01T00:00:00Z", members: [{ displayName: "Ada" }] }],
        });
      }
      if (url.includes("/messages") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body.body.content).toBe("Hello");
        return json({ id: "m-sent", createdDateTime: "2026-01-01T00:01:00Z" }, 201);
      }
      if (url.includes("/messages")) {
        return json({
          value: [
            {
              id: "m1",
              messageType: "message",
              createdDateTime: "2026-01-01T00:00:00Z",
              from: { user: { id: "u2", displayName: "Bob" } },
              body: { contentType: "html", content: "<p>Hi there</p>" },
            },
          ],
        });
      }
      return json({ error: { code: "NotFound", message: url } }, 404);
    };

    const device = await requestDeviceCode("organizations", "client", fetchFn);
    expect(device.verification_uri).toContain("microsoft.com/devicelogin");
    expect(calls[0]).toContain(`${LOGIN_BASE}/organizations/oauth2/v2.0/devicecode`);
    const token = await pollDeviceToken("organizations", "client", device.device_code, fetchFn);
    expect("access_token" in token).toBe(true);
    const me = await getMe("access", fetchFn);
    expect(me.id).toBe("u1");
    const chats = await listChats("access", fetchFn);
    expect(chats[0].id).toBe("19:chat1");
    const messages = await listChatMessages("access", "19:chat1", fetchFn);
    expect(htmlToText(messages[0].body?.content)).toBe("Hi there");
    const sent = await sendChatMessage("access", "19:chat1", "Hello", fetchFn);
    expect(sent.id).toBe("m-sent");
    expect(calls.some((c) => c.startsWith("POST") && c.includes("/chats/") && c.includes("/messages"))).toBe(true);
  });

  it("does not treat Graph errors as success", async () => {
    const fetchFn: typeof fetch = async () => json({ error: { code: "Forbidden", message: "Missing permission" } }, 403);
    await expect(sendChatMessage("access", "19:x", "Hello", fetchFn)).rejects.toThrow(/Missing permission/);
  });

  it("normalizes inbound Graph messages", () => {
    const n = normalizeMessage({
      platform: "teams",
      externalId: "m1",
      conversationExternalId: "c1",
      conversationTitle: "Chat",
      direction: "inbound",
      senderName: " Bob ",
      body: "  hello \u0000",
      sentAt: "2026-01-01T00:00:00Z",
      rawType: "graph.chatMessage",
    });
    expect(n.body).toBe("hello");
    expect(n.senderName).toBe("Bob");
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
