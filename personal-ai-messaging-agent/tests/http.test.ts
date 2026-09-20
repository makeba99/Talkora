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

  it("root page is a live status pointer, not an empty shell", async () => {
    const { url } = await listen();
    const res = await fetch(`${url}/`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toMatch(/Listening on localhost/i);
    expect(html).toMatch(/127\.0\.0\.1:5173/);
    expect(html).toMatch(/standalone local-first/i);
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

  it("Free4Talk is authorized browser only and rejects heroku room hosts", async () => {
    const { url } = await listen();
    const json = await fetch(`${url}/api/platforms`).then((r) => r.json());
    const f4t = json.platforms.find((p: any) => p.id === "free4talk");
    expect(f4t.integration.mode).toBe("authorized_browser");
    expect(f4t.integration.available).toBe(true);
    const bad = await fetch(`${url}/api/platforms/free4talk/room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://free4talk-x.herokuapp.com/room/1" }),
    });
    expect(bad.status).toBe(400);
    const body = await bad.json();
    expect(body.ok).toBe(false);
    expect(String(body.message || body.error)).toMatch(/not the public room page|heroku/i);
    const good = await fetch(`${url}/api/platforms/free4talk/room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.free4talk.com/room/demo-room" }),
    }).then((r) => r.json());
    expect(good.ok).toBe(true);
    expect(good.url).toBe("https://www.free4talk.com/room/demo-room");
    const live = await fetch(`${url}/api/platforms/free4talk/room/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "hello from signed-in account", asSignedInAccount: true }),
    });
    expect(live.status).toBe(409);
    const liveBody = await live.json();
    expect(String(liveBody.error)).toMatch(/Live send is off|simulation/i);
  });

  it("prefills Hilda room URL, exposes monitor flags, and keeps auto-reply inactive by default", async () => {
    const { url } = await listen();
    const room = await fetch(`${url}/api/platforms/free4talk/room`).then((r) => r.json());
    expect(room.suggestedUrl).toBe("https://www.free4talk.com/room/z2ee2");
    expect(room.url).toBe("https://www.free4talk.com/room/z2ee2");
    expect(room.roomId).toBe("z2ee2");
    const platforms = await fetch(`${url}/api/platforms`).then((r) => r.json());
    const f4t = platforms.platforms.find((p: any) => p.id === "free4talk");
    expect(f4t.suggestedUrl).toBe("https://www.free4talk.com/room/z2ee2");
    expect(f4t.autoEnabled).toBe(false);
    expect(f4t.autoReplyActive).toBe(false);
    const monitor = await fetch(`${url}/api/platforms/free4talk/monitor`).then((r) => r.json());
    expect(monitor.monitoring).toBe(false);
    expect(monitor.autoReplyActive).toBe(false);
    expect(monitor.simulationEnabled).toBe(true);
    expect(monitor.liveSendEnabled).toBe(false);
    const on = await fetch(`${url}/api/platforms/free4talk/monitor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on: true }),
    }).then((r) => r.json());
    expect(on.monitoring).toBe(true);
    const still = await fetch(`${url}/api/platforms/free4talk/monitor`).then((r) => r.json());
    expect(still.monitoring).toBe(true);
    expect(still.autoReplyActive).toBe(false);
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
