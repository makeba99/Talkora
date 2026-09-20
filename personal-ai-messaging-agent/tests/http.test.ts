import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../backend/src/index.ts";
import { updateSettings } from "../database/index.ts";

const servers: http.Server[] = [];
const cleanups: Array<() => Promise<void>> = [];

async function listen(fetchFn?: typeof fetch) {
  const { app, db, connectors } = createApp({ dbFile: ":memory:", fetchFn });
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  cleanups.push(async () => {
    await connectors.teams.logout();
    await connectors.free4talk.logout();
  });
  await new Promise<void>((resolve) => server.on("listening", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return { url: `http://127.0.0.1:${addr.port}`, db };
}

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((fn) => fn()));
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
});

describe("HTTP app", () => {
  it("starts on localhost and exposes health", async () => {
    const { url } = await listen();
    const res = await fetch(`${url}/api/health`);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.bind).toContain("127.0.0.1");
  });

  it("dashboard defaults to approval + simulation banner", async () => {
    const { url } = await listen();
    const json = await fetch(`${url}/api/dashboard`).then((r) => r.json());
    expect(json.settings.mode).toBe("approval");
    expect(json.simulationBanner).toBe(true);
  });

  it("Teams connect without client id is not_configured, not a fake success", async () => {
    delete process.env.TEAMS_CLIENT_ID;
    const { url } = await listen();
    const json = await fetch(`${url}/api/platforms/teams/connect`, { method: "POST" }).then((r) => r.json());
    expect(json.status).toBe("not_configured");
    expect(json.message.toLowerCase()).toMatch(/client_id|entra|password/);
  });

  it("Free4Talk retrieve surfaces Integration unavailable", async () => {
    const { url } = await listen();
    const json = await fetch(`${url}/api/platforms`).then((r) => r.json());
    const f4t = json.platforms.find((p: any) => p.id === "free4talk");
    expect(f4t.integration.available).toBe(false);
  });

  it("settings, style, memory, emergency stop round-trip", async () => {
    const { url, db } = await listen();
    await fetch(`${url}/api/style`, { method: "PUT", body: JSON.stringify({ examples: ["cheers"], notes: "short" }), headers: { "Content-Type": "application/json" } });
    const style = await fetch(`${url}/api/style`).then((r) => r.json());
    expect(style.examples).toContain("cheers");
    await fetch(`${url}/api/memory`, { method: "POST", body: JSON.stringify({ key: "team", value: "ops" }), headers: { "Content-Type": "application/json" } });
    const mem = await fetch(`${url}/api/memory`).then((r) => r.json());
    expect(mem.memory[0].key).toBe("team");
    await fetch(`${url}/api/emergency-stop`, { method: "POST" });
    const settings = await fetch(`${url}/api/settings`).then((r) => r.json());
    expect(settings.settings.emergencyStop).toBe(true);
    updateSettings(db, { liveSendEnabled: false });
  });

  it("Teams device login uses mocked Entra endpoints", async () => {
    process.env.TEAMS_CLIENT_ID = "11111111-1111-1111-1111-111111111111";
    const fetchFn: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("/devicecode")) {
        return new Response(JSON.stringify({
          device_code: "dc",
          user_code: "WAFFLE",
          verification_uri: "https://microsoft.com/devicelogin",
          expires_in: 900,
          interval: 5,
          message: "Use WAFFLE at microsoft.com/devicelogin",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "authorization_pending" }), { status: 400, headers: { "Content-Type": "application/json" } });
    };
    const { url } = await listen(fetchFn);
    const json = await fetch(`${url}/api/platforms/teams/connect`, { method: "POST" }).then((r) => r.json());
    expect(json.status).toBe("awaiting_user");
    expect(json.deviceLogin.userCode).toBe("WAFFLE");
    delete process.env.TEAMS_CLIENT_ID;
  });
});
