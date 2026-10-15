import http from "node:http";
import { describe, expect, it } from "vitest";
import { DETECTION_SUMMARY } from "../src/core/types.js";
import { createApp } from "../src/server/app.js";
import { authed, cookieFor, harness, listen, message, servicesFor } from "./helpers.js";
import { MemorySecretStore } from "../src/security/secrets.js";

describe("local HTTP API", () => {
  it("binds to loopback, blocks foreign hosts, and requires the local header", async () => {
    const parts = harness();
    const app = createApp(servicesFor(parts));
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    expect(address && typeof address !== "string" && address.address).toBe("127.0.0.1");
    const url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    const cookie = await cookieFor(url);
    const health = await fetch(`${url}/api/limitations`);
    const limits = await health.json() as { guaranteesAllIncomingMessages: boolean; detectionSummary: string; uiaSending: boolean };
    expect(limits.guaranteesAllIncomingMessages).toBe(false);
    expect(limits.uiaSending).toBe(false);
    expect(limits.detectionSummary).toBe(DETECTION_SUMMARY);

    const foreign = await raw({ url: `${url}/api/drafts`, method: "GET", host: "evil.test" });
    expect(foreign.status).toBe(403);
    const denied = await fetch(`${url}/api/monitoring/start`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}" });
    expect(denied.status).toBe(403);
    const crossed = await fetch(`${url}/api/monitoring/stop`, {
      method: "POST",
      headers: { cookie, origin: "https://evil.test", "content-type": "application/json", "x-teamspilot-request": "1" },
      body: "{}",
    });
    expect(crossed.status).toBe(403);
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it("creates a review draft without sending, then sends only the approved text", async () => {
    const parts = harness();
    const secrets = new MemorySecretStore();
    const running = await listen(createApp(servicesFor(parts, secrets)));
    const cookie = await cookieFor(running.url);
    const created = await fetch(`${running.url}/api/drafts/manual`, authed(cookie, {
      text: "Can you confirm the Friday review?",
      senderLabel: "Ada",
      chatId: "chat-a",
    }));
    const body = await created.json() as { draft: { id: string; currentReply: string; status: string } };
    expect(created.status).toBe(200);
    expect(body.draft.status).toBe("pending_review");
    expect(parts.sender.calls).toEqual([]);

    const sneaky = await fetch(`${running.url}/api/drafts/${body.draft.id}/approve`, authed(cookie, { text: body.draft.currentReply, chatId: "chat-b" }));
    expect(sneaky.status).toBe(400);
    expect(parts.sender.calls).toEqual([]);

    const edited = "Yes. I can do the Friday review.";
    const saved = await fetch(`${running.url}/api/drafts/${body.draft.id}/edit`, { ...authed(cookie, { text: edited }), method: "POST" });
    expect(saved.status).toBe(200);
    const approved = await fetch(`${running.url}/api/drafts/${body.draft.id}/approve`, authed(cookie, { text: edited }));
    const result = await approved.json() as { ok: boolean; status: string };
    expect(result).toMatchObject({ ok: true, status: "sent" });
    expect(parts.sender.calls).toEqual([{ draftId: body.draft.id, chatId: "chat-a", text: edited }]);

    const key = "sk-live-looking-key-0123456789abcdef";
    const stored = await fetch(`${running.url}/api/settings/openai-key`, { ...authed(cookie, { apiKey: key }), method: "PUT" });
    expect(stored.status).toBe(200);
    const settings = await (await fetch(`${running.url}/api/settings`, { headers: { cookie } })).text();
    const activity = await (await fetch(`${running.url}/api/activity`, { headers: { cookie } })).text();
    expect(settings).not.toContain(key);
    expect(activity).not.toContain(key);
    const auto = await fetch(`${running.url}/api/settings`, { ...authed(cookie, { autoSend: true }), method: "PUT" });
    expect(auto.status).toBe(400);
    await running.close();
  });

  it("stays draft-only and does not send when monitoring cannot see Teams", async () => {
    const parts = harness();
    parts.reader.signedIn = false;
    const running = await listen(createApp(servicesFor(parts)));
    const cookie = await cookieFor(running.url);
    const started = await fetch(`${running.url}/api/monitoring/start`, authed(cookie, {}));
    const body = await started.json() as { ok: boolean };
    expect(body.ok).toBe(false);
    const status = await (await fetch(`${running.url}/api/status`)).json() as { mode: string; monitoring: string; guaranteesAllIncomingMessages: boolean };
    expect(status.mode).toBe("draft-only");
    expect(status.monitoring).toBe("stopped");
    expect(status.guaranteesAllIncomingMessages).toBe(false);
    await fetch(`${running.url}/api/monitoring/pause`, authed(cookie, {}));
    const afterPause = await (await fetch(`${running.url}/api/status`)).json() as { monitoring: string };
    expect(afterPause.monitoring).toBe("stopped");
    const draft = await parts.pipeline.handleIncoming(message({ text: "Are you there?" }), "teams", "Ada Lovelace");
    const approved = await fetch(`${running.url}/api/drafts/${draft!.id}/approve`, authed(cookie, { text: draft!.currentReply }));
    const result = await approved.json() as { ok: boolean };
    expect(result.ok).toBe(false);
    expect(parts.sender.calls).toEqual([]);
    await running.close();
  });
});

function raw(input: { url: string; method: string; host: string }): Promise<{ status: number; body: string }> {
  const url = new URL(input.url);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port: url.port,
      path: url.pathname,
      method: input.method,
      headers: { host: input.host },
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += String(chunk); });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
}
