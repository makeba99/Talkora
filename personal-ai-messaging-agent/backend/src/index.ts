import express from "express";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, getSettings, updateSettings } from "../../database/index.ts";
import { Free4TalkConnector, FREE4TALK_ORIGIN, HILDA_ROOM_URL } from "../../connectors/free4talk/index.ts";
import { TeamsConnector } from "../../connectors/teams/index.ts";
import { IntegrationUnavailable } from "../../connectors/platform-connector.ts";
import { AgentRuntime } from "../../agent/orchestrator.ts";
import { listLogs, logEvent } from "../../logging/index.ts";
import {
  assertLocalhostBind,
  dataDir,
  frontendPort,
  host,
  loadEnvFile,
  port,
  redact,
} from "../../security/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT = path.resolve(__dirname, "../..");

loadEnvFile(ROOT);

export function createApp(options?: { dbFile?: string; fetchFn?: typeof fetch }) {
  const db = openDatabase(ROOT, options?.dbFile);
  const f4t = new Free4TalkConnector(dataDir(ROOT));
  const teams = new TeamsConnector(db, ROOT, options?.fetchFn || fetch);
  const runtime = new AgentRuntime(db, { free4talk: f4t, teams }, ROOT);

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    const remote = req.socket.remoteAddress || "";
    const ok = remote === "127.0.0.1" || remote === "::1" || remote === ":ffff:127.0.0.1" || remote.endsWith("127.0.0.1");
    if (!ok) {
      res.status(403).json({ error: "Localhost only" });
      return;
    }
    next();
  });

  const asyncHandler = (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      fn(req, res).catch(next);
    };

  const pid = (req: express.Request): string => {
    const v = req.params.id;
    return Array.isArray(v) ? v[0] : v;
  };

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, name: "Personal AI Messaging Agent", bind: `${host()}:${port()}`, ui: `http://127.0.0.1:${frontendPort()}` });
  });

  app.get("/", (_req, res) => {
    const ui = `http://127.0.0.1:${frontendPort()}`;
    const api = `http://${host()}:${port()}`;
    res.type("html").status(200).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Personal AI Messaging Agent — running</title>
  <style>
    body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif; background:#14151c; color:#efe7d6; }
    main { max-width: 40rem; margin: 12vh auto; padding: 0 1.5rem; }
    h1 { font-size: 1.6rem; margin: 0 0 .4rem; }
    .ok { color:#3f9d6e; font-weight:600; letter-spacing:.04em; text-transform:uppercase; font-size:.8rem; }
    a { color:#7ec8c4; }
    .card { border:1px solid #2a2d3a; border-radius:12px; padding:1.1rem 1.2rem; background:#1a1c25; margin-top:1.2rem; }
    code { font-family: ui-monospace, monospace; }
  </style>
</head>
<body>
  <main>
    <p class="ok">Listening on localhost</p>
    <h1>Personal AI Messaging Agent</h1>
    <p>This process is up. Standalone local-first messaging agent.</p>
    <div class="card">
      <p>API: <a href="${api}/api/health">${api}/api/health</a></p>
      <p>Desk UI: <a href="${ui}">${ui}</a></p>
    </div>
    <p>Default mode is Approval. Simulation is on. Live send is off.</p>
  </main>
</body>
</html>`);
  });

  app.get("/api/dashboard", asyncHandler(async (_req, res) => {
    const settings = getSettings(db);
    const platforms = await Promise.all([f4t.getStatus(), teams.getStatus()]);
    const pending = db.prepare(`SELECT COUNT(*) as c FROM drafts WHERE status = 'pending'`).get() as { c: number };
    const sent = db.prepare(`SELECT COUNT(*) as c FROM sent_messages`).get() as { c: number };
    const convos = db.prepare(`SELECT COUNT(*) as c FROM conversations`).get() as { c: number };
    res.json({
      settings,
      platforms: [
        { id: "free4talk", ...platforms[0] },
        { id: "teams", ...platforms[1] },
      ],
      pendingDrafts: pending.c,
      sentCount: sent.c,
      conversationCount: convos.c,
      simulationBanner: settings.simulationEnabled || !settings.liveSendEnabled,
    });
  }));

  app.get("/api/inbox", (_req, res) => {
    const rows = db.prepare(
      `SELECT c.*, (
         SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY sent_at DESC LIMIT 1
       ) as last_body
       FROM conversations c
       ORDER BY COALESCE(c.last_message_at, '') DESC`,
    ).all();
    res.json({ conversations: rows });
  });

  app.get("/api/conversations", (_req, res) => {
    res.json({ conversations: db.prepare(`SELECT * FROM conversations ORDER BY last_message_at DESC`).all() });
  });

  app.get("/api/conversations/:id", (req, res) => {
    const convo = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(req.params.id);
    if (!convo) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const messages = db.prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY sent_at ASC`).all(req.params.id);
    const drafts = db.prepare(`SELECT * FROM drafts WHERE conversation_id = ? ORDER BY created_at DESC`).all(req.params.id);
    const memory = db.prepare(`SELECT * FROM conversation_memory WHERE conversation_id = ?`).all(req.params.id);
    res.json({ conversation: convo, messages, drafts, memory });
  });

  app.post("/api/conversations/:id/category", (req, res) => {
    const category = req.body?.category === "work" ? "work" : "personal";
    db.prepare(`UPDATE conversations SET category = ? WHERE id = ?`).run(category, req.params.id);
    db.prepare(
      `INSERT INTO conversation_settings (conversation_id, auto_enabled, paused, category, updated_at)
       VALUES (?, 0, 0, ?, ?)
       ON CONFLICT(conversation_id) DO UPDATE SET category = excluded.category, updated_at = excluded.updated_at`,
    ).run(req.params.id, category, new Date().toISOString());
    res.json({ ok: true, category });
  });

  app.post("/api/conversations/:id/auto", (req, res) => {
    const auto = Boolean(req.body?.auto);
    db.prepare(`UPDATE conversations SET auto_enabled = ? WHERE id = ?`).run(auto ? 1 : 0, req.params.id);
    res.json({ ok: true, auto });
  });

  app.get("/api/drafts", (_req, res) => {
    const drafts = db.prepare(
      `SELECT d.*, c.title as conversation_title FROM drafts d
       LEFT JOIN conversations c ON c.id = d.conversation_id
       ORDER BY d.created_at DESC`,
    ).all();
    res.json({ drafts });
  });

  app.post("/api/drafts/:id/approve", asyncHandler(async (req, res) => {
    const result = await runtime.approveDraft(pid(req));
    res.json({ ok: true, result: redact(result) });
  }));

  app.post("/api/drafts/:id/reject", asyncHandler(async (req, res) => {
    await runtime.rejectDraft(pid(req));
    res.json({ ok: true });
  }));

  app.post("/api/drafts/:id/edit", (req, res) => {
    if (typeof req.body?.body !== "string") {
      res.status(400).json({ error: "body required" });
      return;
    }
    runtime.editDraft(pid(req), req.body.body);
    res.json({ ok: true });
  });

  app.get("/api/platforms", asyncHandler(async (_req, res) => {
    const [free4talk, teamsStatus] = await Promise.all([f4t.getStatus(), teams.getStatus()]);
    const platformSettings = db.prepare(`SELECT * FROM platform_settings`).all() as any[];
    const appSettings = getSettings(db);
    const f4tAuto = Boolean(platformSettings.find((s) => s.platform === "free4talk")?.auto_enabled);
    const autoReplyActive =
      Boolean(free4talk.monitoring) &&
      f4tAuto &&
      !appSettings.simulationEnabled &&
      appSettings.liveSendEnabled &&
      !appSettings.emergencyStop;
    res.json({
      platforms: [
        {
          id: "free4talk",
          openUrl: FREE4TALK_ORIGIN,
          suggestedUrl: HILDA_ROOM_URL,
          autoEnabled: f4tAuto,
          autoReplyActive,
          ...free4talk,
        },
        { id: "teams", openUrl: "https://teams.microsoft.com/", ...teamsStatus },
      ],
      settings: platformSettings,
    });
  }));

  app.post("/api/platforms/free4talk/room", asyncHandler(async (req, res) => {
    const url = typeof req.body?.url === "string" ? req.body.url : "";
    const result = await f4t.setRoomUrl(url);
    logEvent(db, { event: "free4talk_room_url", platform: "free4talk", detail: { ok: result.ok, href: result.probe?.href || null } });
    res.status(result.ok ? 200 : 400).json({ error: result.ok ? undefined : result.message, ...result });
  }));

  app.get("/api/platforms/free4talk/room", asyncHandler(async (_req, res) => {
    const status = await f4t.getStatus();
    res.json({
      url: status.room?.url || HILDA_ROOM_URL,
      suggestedUrl: HILDA_ROOM_URL,
      roomId: status.room?.roomId || "z2ee2",
      probe: status.room?.probe || null,
      status: status.status,
      message: status.message,
      monitoring: status.monitoring || false,
    });
  }));

  app.get("/api/platforms/free4talk/room/messages", asyncHandler(async (_req, res) => {
    const status = await f4t.getStatus();
    if (!status.room?.roomId) {
      res.json({ messages: [], message: status.message });
      return;
    }
    try {
      const messages = await f4t.getMessages(status.room.roomId);
      res.json({ messages, probe: status.room.probe });
    } catch (error) {
      if (error instanceof IntegrationUnavailable) {
        res.status(409).json({ error: "Integration unavailable", messages: [], ...error.toJSON() });
        return;
      }
      throw error;
    }
  }));

  app.post("/api/platforms/free4talk/room/send", asyncHandler(async (req, res) => {
    const body = typeof req.body?.body === "string" ? req.body.body : "";
    const status = await f4t.getStatus();
    if (!status.room?.roomId) {
      res.status(409).json({ error: "Integration unavailable", reason: "Paste a room URL first." });
      return;
    }
    const settings = getSettings(db);
    if (settings.emergencyStop) {
      res.status(409).json({ error: "Emergency stop is on. Nothing will send." });
      return;
    }
    const asSignedInAccount = req.body?.asSignedInAccount === true;
    const simulate =
      req.body?.simulate === true ||
      !asSignedInAccount ||
      settings.simulationEnabled ||
      !settings.liveSendEnabled;
    if (asSignedInAccount && simulate && req.body?.simulate !== true) {
      res.status(409).json({
        error:
          "Live send is off or simulation is on. Enable Live send and turn simulation off in Settings (or on this page), then send as the signed-in room account. This app will not click Send until then.",
        simulated: true,
        liveSendEnabled: settings.liveSendEnabled,
        simulationEnabled: settings.simulationEnabled,
      });
      return;
    }
    const result = await f4t.sendMessage(status.room.roomId, body, { simulate });
    if (!result.simulated) {
      const convoId = runtime.upsertConversation("free4talk", status.room.roomId, `Free4Talk room ${status.room.roomId}`, result.sentAt);
      runtime.insertMessage(convoId, {
        platform: "free4talk",
        externalId: result.externalId || `dom-${Date.now()}`,
        conversationExternalId: status.room.roomId,
        conversationTitle: `Free4Talk room ${status.room.roomId}`,
        direction: "outbound",
        senderName: "Me (signed-in room account)",
        body,
        sentAt: result.sentAt,
        rawType: "free4talk.visible-dom.myself",
      });
      db.prepare(
        `INSERT INTO sent_messages (id, platform, conversation_id, draft_id, body, mode, simulated, external_id, error, created_at)
         VALUES (?, 'free4talk', ?, NULL, ?, 'approval', 0, ?, NULL, ?)`,
      ).run(randomUUID(), convoId, body, result.externalId || null, result.sentAt);
    }
    logEvent(db, {
      event: result.simulated ? "free4talk_simulated_type" : "free4talk_live_type",
      platform: "free4talk",
      detail: { simulated: result.simulated, asSignedInAccount },
    });
    res.json({ ...result, asSignedInAccount: asSignedInAccount && !result.simulated });
  }));

  app.post("/api/platforms/free4talk/monitor", asyncHandler(async (req, res) => {
    const on = req.body?.on !== false;
    const result = await runtime.setFree4TalkMonitoring(on);
    res.json(result);
  }));

  app.get("/api/platforms/free4talk/monitor", asyncHandler(async (_req, res) => {
    const status = await f4t.getStatus();
    const appSettings = getSettings(db);
    const f4tAuto = Boolean(
      (db.prepare(`SELECT auto_enabled FROM platform_settings WHERE platform = 'free4talk'`).get() as any)?.auto_enabled,
    );
    res.json({
      monitoring: Boolean(status.monitoring),
      autoEnabled: f4tAuto,
      autoReplyActive:
        Boolean(status.monitoring) &&
        f4tAuto &&
        !appSettings.simulationEnabled &&
        appSettings.liveSendEnabled &&
        !appSettings.emergencyStop,
      simulationEnabled: appSettings.simulationEnabled,
      liveSendEnabled: appSettings.liveSendEnabled,
      emergencyStop: appSettings.emergencyStop,
    });
  }));

  app.post("/api/platforms/free4talk/screenshot", asyncHandler(async (req, res) => {
    const dest =
      typeof req.body?.path === "string" && req.body.path.startsWith("/cursor/stores/")
        ? req.body.path
        : "/cursor/stores/bc-f656d379-f884-4f88-b220-1f2fcee9c42e/media/free4talk-live.png";
    const result = await f4t.screenshotTo(dest);
    res.status(result.ok ? 200 : 409).json({ ...result, path: dest });
  }));

  app.post("/api/platforms/:id/connect", asyncHandler(async (req, res) => {
    const connector = req.params.id === "teams" ? teams : req.params.id === "free4talk" ? f4t : null;
    if (!connector) {
      res.status(404).json({ error: "Unknown platform" });
      return;
    }
    const result = await connector.connect();
    logEvent(db, { event: "connect", platform: pid(req), detail: { status: result.status, message: result.message } });
    res.json(result);
  }));

  app.post("/api/platforms/:id/disconnect", asyncHandler(async (req, res) => {
    const connector = req.params.id === "teams" ? teams : req.params.id === "free4talk" ? f4t : null;
    if (!connector) {
      res.status(404).json({ error: "Unknown platform" });
      return;
    }
    await connector.disconnect();
    res.json({ ok: true });
  }));

  app.post("/api/platforms/:id/reconnect", asyncHandler(async (req, res) => {
    const connector = req.params.id === "teams" ? teams : req.params.id === "free4talk" ? f4t : null;
    if (!connector) {
      res.status(404).json({ error: "Unknown platform" });
      return;
    }
    await connector.disconnect();
    const result = await connector.connect();
    res.json(result);
  }));

  app.post("/api/platforms/:id/logout", asyncHandler(async (req, res) => {
    const connector = req.params.id === "teams" ? teams : req.params.id === "free4talk" ? f4t : null;
    if (!connector) {
      res.status(404).json({ error: "Unknown platform" });
      return;
    }
    await connector.logout();
    res.json({ ok: true });
  }));

  app.get("/api/platforms/:id/open", asyncHandler(async (req, res) => {
    const connector = req.params.id === "teams" ? teams : req.params.id === "free4talk" ? f4t : null;
    if (!connector) {
      res.status(404).json({ error: "Unknown platform" });
      return;
    }
    res.json(await connector.openPlatform());
  }));

  app.post("/api/platforms/:id/pause", (req, res) => {
    runtime.pausePlatform(req.params.id, true);
    res.json({ ok: true, paused: true });
  });

  app.post("/api/platforms/:id/resume", (req, res) => {
    runtime.pausePlatform(req.params.id, false);
    res.json({ ok: true, paused: false });
  });

  app.post("/api/platforms/:id/auto", (req, res) => {
    const auto = Boolean(req.body?.auto);
    db.prepare(`UPDATE platform_settings SET auto_enabled = ?, updated_at = ? WHERE platform = ?`).run(
      auto ? 1 : 0,
      new Date().toISOString(),
      req.params.id,
    );
    db.prepare(`UPDATE platform_connections SET auto_enabled = ?, updated_at = ? WHERE platform = ?`).run(
      auto ? 1 : 0,
      new Date().toISOString(),
      req.params.id,
    );
    res.json({ ok: true, auto });
  });

  app.get("/api/activity", (_req, res) => {
    res.json({ logs: listLogs(db, 300) });
  });

  app.get("/api/sent", (_req, res) => {
    res.json({ sent: db.prepare(`SELECT * FROM sent_messages ORDER BY created_at DESC LIMIT 200`).all() });
  });

  app.get("/api/style", (_req, res) => {
    const row = db.prepare(`SELECT * FROM style_profiles WHERE id = 'default'`).get() as any;
    res.json({ name: row.name, notes: row.notes, examples: JSON.parse(row.examples || "[]") });
  });

  app.put("/api/style", (req, res) => {
    const examples = Array.isArray(req.body?.examples) ? req.body.examples.map(String) : [];
    const notes = typeof req.body?.notes === "string" ? req.body.notes : "";
    db.prepare(`UPDATE style_profiles SET examples = ?, notes = ?, updated_at = ? WHERE id = 'default'`).run(
      JSON.stringify(examples),
      notes,
      new Date().toISOString(),
    );
    res.json({ ok: true });
  });

  app.get("/api/memory", (_req, res) => {
    res.json({ memory: db.prepare(`SELECT * FROM conversation_memory ORDER BY created_at DESC`).all() });
  });

  app.post("/api/memory", (req, res) => {
    const key = String(req.body?.key || "").trim();
    const value = String(req.body?.value || "").trim();
    if (!key || !value) {
      res.status(400).json({ error: "key and value required" });
      return;
    }
    db.prepare(
      `INSERT INTO conversation_memory (id, conversation_id, platform, key, value, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      req.body?.conversationId || null,
      req.body?.platform || null,
      key,
      value,
      new Date().toISOString(),
    );
    res.json({ ok: true });
  });

  app.delete("/api/memory/:id", (req, res) => {
    db.prepare(`DELETE FROM conversation_memory WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  });

  app.get("/api/settings", (_req, res) => {
    res.json({ settings: getSettings(db) });
  });

  app.put("/api/settings", (req, res) => {
    const body = req.body || {};
    const settings = updateSettings(db, {
      mode: body.mode,
      simulationEnabled: body.simulationEnabled,
      liveSendEnabled: body.liveSendEnabled,
      pollIntervalSec: body.pollIntervalSec,
    });
    if (body.liveSendEnabled === true && body.simulationEnabled !== true) {
      logEvent(db, { level: "warn", event: "live_send_enabled", detail: { mode: settings.mode } });
    }
    res.json({ settings });
  });

  app.post("/api/emergency-stop", (_req, res) => {
    res.json({ settings: runtime.emergencyStop(true) });
  });

  app.post("/api/emergency-resume", (_req, res) => {
    res.json({ settings: runtime.emergencyStop(false) });
  });

  app.post("/api/agent/tick", asyncHandler(async (_req, res) => {
    const ingest = await runtime.ingestFromConnectors();
    const processed = await runtime.processInbox();
    res.json({ ingest, processed });
  }));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof IntegrationUnavailable) {
      res.status(409).json({ error: "Integration unavailable", ...err.toJSON() });
      return;
    }
    const message = err instanceof Error ? err.message : "Server error";
    logEvent(db, { level: "error", event: "http_error", detail: { message } });
    res.status(500).json({ error: message });
  });

  const frontendDist = path.join(ROOT, "frontend/dist");
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  return { app, db, runtime, connectors: { free4talk: f4t, teams } };
}

export async function main() {
  const bindHost = host();
  assertLocalhostBind(bindHost);
  const { app, runtime, connectors } = createApp();
  const listenPort = port();
  const server = app.listen(listenPort, bindHost, () => {
    console.log(`Personal AI Messaging Agent API on http://${bindHost}:${listenPort}`);
    console.log(`UI (dev): http://127.0.0.1:${frontendPort()}`);
    console.log("Default mode: approval. Simulation is ON. Live send is OFF.");
    connectors.free4talk
      .setRoomUrl(HILDA_ROOM_URL)
      .then((opened) => {
        console.log(opened.message);
        return runtime.setFree4TalkMonitoring(true);
      })
      .then(() => console.log("Free4Talk monitoring ON for", HILDA_ROOM_URL, "(will not click Send while simulation is on)"))
      .catch((err) => console.error("Free4Talk room open failed", err instanceof Error ? err.message : err));
  });
  const timer = setInterval(() => {
    runtime.ingestFromConnectors().then(() => runtime.processInbox()).catch((err) => {
      console.error("tick failed", err instanceof Error ? err.message : err);
    });
  }, 30_000);
  const shutdown = () => {
    clearInterval(timer);
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect || process.argv[1]?.endsWith("backend/src/index.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
