import { randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { createActivity } from "../core/redact.js";
import type { DraftStore } from "../core/store.js";
import { applySettingsPatch } from "../core/settings.js";
import { DETECTION_SUMMARY, LIMITATIONS, SEND_POLICY, UserFacingError, type Settings } from "../core/types.js";
import type { DraftPipeline } from "../pipeline/handle.js";
import type { ApprovalGate } from "../send/gate.js";
import type { SecretStore } from "../security/secrets.js";
import type { ChatMonitor } from "../teams/monitor.js";
import type { ProbeInterpretation } from "../teams/match-chat.js";
import type { TeamsReader } from "../teams/reader.js";

export interface AuthController {
  status(): {
    configured: boolean;
    signedIn: boolean;
    account: { id: string; displayName: string; username: string } | null;
    pending: { userCode: string; verificationUri: string; message: string } | null;
    lastError: string | null;
  };
  startDeviceCode(): Promise<void>;
  signOut(): Promise<void>;
}

export interface EventHub {
  publish(event: Record<string, string>): void;
  subscribe(res: Response): void;
  unsubscribe(res: Response): void;
}

export interface AppServices {
  store: DraftStore;
  pipeline: DraftPipeline;
  gate: ApprovalGate;
  monitor: ChatMonitor;
  reader: TeamsReader;
  auth: AuthController;
  secrets: SecretStore;
  hub: EventHub;
  sessionToken: string;
  dataDir: string;
  probe(): Promise<ProbeInterpretation>;
}

export function createEventHub(): EventHub {
  const clients = new Set<Response>();
  return {
    publish(event) {
      const payload = `data: ${JSON.stringify(event)}\n\n`;
      for (const client of clients) client.write(payload);
    },
    subscribe(res) {
      clients.add(res);
      res.write(": connected\n\n");
    },
    unsubscribe(res) {
      clients.delete(res);
    },
  };
}

export function createApp(services: AppServices): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Cache-Control", "no-store");
    if (process.env.NODE_ENV === "production") {
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      );
    }
    next();
  });
  app.use((req, res, next) => {
    if (!isLoopback(req) || !allowedHost(req.headers.host)) {
      res.status(403).json({ error: "TeamsPilot only accepts connections from this computer." });
      return;
    }
    if (!readCookie(req.headers.cookie, "tp_session")) {
      res.append("Set-Cookie", `tp_session=${services.sessionToken}; HttpOnly; SameSite=Strict; Path=/`);
    }
    next();
  });
  app.use(express.json({ limit: "256kb" }));

  const api = express.Router();
  api.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") return next();
    const origin = req.header("origin");
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
      res.status(403).json({ error: "Blocked cross-origin request." });
      return;
    }
    const cookie = readCookie(req.headers.cookie, "tp_session") ?? "";
    if (req.header("x-teamspilot-request") !== "1" || !safeEqual(cookie, services.sessionToken)) {
      res.status(403).json({ error: "The request was rejected." });
      return;
    }
    next();
  });

  api.get("/health", (_req, res) => {
    res.json({ ok: true, service: "teamspilot", bind: "127.0.0.1" });
  });

  api.get("/limitations", (_req, res) => {
    res.json({
      guaranteesAllIncomingMessages: false,
      detectionSummary: DETECTION_SUMMARY,
      sendPolicy: SEND_POLICY,
      limitations: LIMITATIONS,
      uiaSending: false,
    });
  });

  api.get("/status", async (_req, res) => {
    res.json(await buildStatus(services));
  });

  api.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Connection", "keep-alive");
    services.hub.subscribe(res);
    const beat = setInterval(() => res.write(": ping\n\n"), 20000);
    req.on("close", () => {
      clearInterval(beat);
      services.hub.unsubscribe(res);
    });
  });

  api.post("/monitoring/start", (_req, res) => {
    const result = services.monitor.start();
    services.hub.publish({ type: "changed" });
    res.json(result);
  });
  api.post("/monitoring/pause", (_req, res) => {
    services.monitor.pause();
    services.hub.publish({ type: "changed" });
    res.json({ ok: true });
  });
  api.post("/monitoring/stop", (_req, res) => {
    services.monitor.stop();
    services.hub.publish({ type: "changed" });
    res.json({ ok: true });
  });

  api.get("/chats", async (_req, res, next) => {
    try {
      const chats = services.reader.canDetect() ? await services.reader.listChats() : [];
      res.json({ chats });
    } catch (error) {
      next(error);
    }
  });

  api.post("/monitoring/chat", async (req, res, next) => {
    try {
      const body = z.object({ chatId: z.string().min(1).max(400) }).strict().parse(req.body);
      const chats = await services.reader.listChats();
      const chat = chats.find((item) => item.id === body.chatId);
      if (!chat) {
        res.status(400).json({ error: "That chat could not be verified, so the monitored chat was not changed." });
        return;
      }
      const settings = services.store.saveSettings({
        ...services.store.getSettings(),
        monitoredChatId: chat.id,
        monitoredChatLabel: chat.label,
      });
      log(services, "info", "chat_selected", { chatId: chat.id, status: "selected" });
      services.hub.publish({ type: "changed" });
      res.json({ settings: publicSettings(settings, await configured(services)) });
    } catch (error) {
      next(error);
    }
  });

  api.get("/auth", (_req, res) => {
    res.json(services.auth.status());
  });
  api.post("/auth/start", async (_req, res, next) => {
    try {
      await services.auth.startDeviceCode();
      log(services, "info", "sign_in_started", { detail: "Device code sign-in started." });
      res.json(services.auth.status());
    } catch (error) {
      next(error);
    }
  });
  api.post("/auth/sign-out", async (_req, res, next) => {
    try {
      services.monitor.stop();
      await services.auth.signOut();
      log(services, "info", "signed_out", {});
      services.hub.publish({ type: "changed" });
      res.json(services.auth.status());
    } catch (error) {
      next(error);
    }
  });

  api.get("/drafts", (_req, res) => {
    res.json({ drafts: services.store.list() });
  });

  api.post("/drafts/manual", async (req, res, next) => {
    try {
      const body = z
        .object({
          text: z.string().min(1).max(8000),
          senderLabel: z.string().min(1).max(120),
          chatId: z.string().min(1).max(400).nullable().optional(),
        })
        .strict()
        .parse(req.body);
      let chatId = "";
      let chatLabel = "No Teams chat";
      if (body.chatId) {
        const chats = services.reader.canDetect() ? await services.reader.listChats() : [];
        const chat = chats.find((item) => item.id === body.chatId);
        if (!chat) {
          res.status(400).json({ error: "That chat could not be verified, so the draft was not attached to it." });
          return;
        }
        chatId = chat.id;
        chatLabel = chat.label;
      }
      const draft = await services.pipeline.handleIncoming(
        {
          id: `manual:${randomUUID()}`,
          idSource: "manual",
          chatId,
          senderId: "manual-sender",
          senderLabel: body.senderLabel,
          text: body.text,
          createdAt: new Date().toISOString(),
          mine: false,
        },
        "manual",
        chatLabel,
      );
      res.json({ draft });
    } catch (error) {
      next(error);
    }
  });

  api.post("/drafts/:id/edit", async (req, res, next) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const body = z.object({ text: z.string().max(8000) }).strict().parse(req.body);
      const draft = await services.pipeline.edit(id, body.text);
      services.hub.publish({ type: "changed" });
      res.json({ draft });
    } catch (error) {
      next(error);
    }
  });
  api.post("/drafts/:id/regenerate", async (req, res, next) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const draft = await services.pipeline.regenerate(id);
      res.json({ draft });
    } catch (error) {
      next(error);
    }
  });
  api.post("/drafts/:id/discard", async (req, res, next) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const draft = await services.pipeline.discard(id);
      log(services, "info", "draft_discarded", { draftId: id, chatId: draft.chatId, status: "discarded" });
      services.hub.publish({ type: "changed" });
      res.json({ draft });
    } catch (error) {
      next(error);
    }
  });
  api.post("/drafts/:id/approve", async (req, res, next) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const body = z.object({ text: z.string().max(8000) }).strict().parse(req.body);
      const result = await services.gate.approveAndSend(id, body.text);
      services.hub.publish({ type: "changed" });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
  api.post("/drafts/:id/resolve", async (req, res, next) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const body = z.object({ resolution: z.enum(["was_sent", "not_sent"]) }).strict().parse(req.body);
      const result = await services.gate.resolveUncertain(id, body.resolution);
      services.hub.publish({ type: "changed" });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  api.post("/data/clear", (_req, res) => {
    services.monitor.stop();
    services.store.clearConversationData();
    log(services, "info", "conversation_data_cleared", { detail: "Drafts, context, and the activity log were deleted." });
    services.hub.publish({ type: "changed" });
    res.json({ ok: true });
  });

  api.get("/settings", async (_req, res) => {
    res.json({ settings: publicSettings(services.store.getSettings(), await configured(services)), auth: services.auth.status() });
  });
  api.put("/settings", (req, res, next) => {
    try {
      const settings = services.store.saveSettings(applySettingsPatch(services.store.getSettings(), req.body));
      log(services, "info", "settings_saved", { detail: "Settings saved." });
      services.hub.publish({ type: "changed" });
      res.json({ settings });
    } catch (error) {
      next(error);
    }
  });
  api.put("/settings/openai-key", async (req, res, next) => {
    try {
      const body = z.object({ apiKey: z.string().trim().min(20).max(300).regex(/^\S+$/) }).strict().parse(req.body);
      await services.secrets.set("openai-api-key", body.apiKey);
      log(services, "info", "openai_key_saved", { detail: "OpenAI API key stored." });
      res.json({ openaiConfigured: true });
    } catch (error) {
      next(error);
    }
  });
  api.delete("/settings/openai-key", async (_req, res, next) => {
    try {
      await services.secrets.delete("openai-api-key");
      log(services, "info", "openai_key_removed", { detail: "OpenAI API key removed." });
      res.json({ openaiConfigured: false });
    } catch (error) {
      next(error);
    }
  });

  api.get("/activity", (_req, res) => {
    res.json({ activity: services.store.activity() });
  });

  api.post("/probe", async (_req, res, next) => {
    try {
      const probe = await services.probe();
      services.monitor.rememberProbe(probe);
      res.json({ probe });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api", api);
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "The request was not valid." });
      return;
    }
    if (error instanceof UserFacingError) {
      res.status(error.httpStatus).json({ error: error.message });
      return;
    }
    if (error instanceof Error && /^(Draft not found|This draft )/.test(error.message)) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "The request could not be completed." });
  });
  return app;
}

export async function attachUi(app: express.Express, httpServer: import("node:http").Server): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    const dir = rendererDir();
    if (!existsSync(path.join(dir, "index.html"))) {
      throw new Error("The TeamsPilot interface is not built. Run npm run build.");
    }
    app.use(express.static(dir, { index: false, etag: false, maxAge: 0 }));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) return next();
      res.sendFile(path.join(dir, "index.html"));
    });
    return;
  }
  const { createServer } = await import("vite");
  const vite = await createServer({
    configFile: path.resolve(process.cwd(), "vite.config.ts"),
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    try {
      const template = readFileSync(path.resolve(process.cwd(), "src/renderer/index.html"), "utf8");
      const html = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").end(html);
    } catch (error) {
      next(error);
    }
  });
}

async function buildStatus(services: AppServices) {
  const settings = services.store.getSettings();
  const monitor = services.monitor.snapshot();
  const auth = services.auth.status();
  const drafts = services.store.list();
  return {
    ...monitor,
    guaranteesAllIncomingMessages: false as const,
    detectionSummary: DETECTION_SUMMARY,
    sendPolicy: SEND_POLICY,
    account: auth.signedIn ? { signedIn: true, displayName: auth.account?.displayName ?? "Signed in" } : { signedIn: false, displayName: null },
    graphConfigured: auth.configured,
    openaiConfigured: await configured(services),
    monitoredChat: settings.monitoredChatId ? { id: settings.monitoredChatId, label: settings.monitoredChatLabel || "Selected chat" } : null,
    pendingReviewCount: drafts.filter((draft) => draft.status === "pending_review" || draft.status === "editing").length,
    pollIntervalMs: settings.pollIntervalMs,
    followTeamsWindow: settings.followTeamsWindow,
    uiaSupported: process.platform === "win32",
    uiaSending: false as const,
    dataDir: services.dataDir,
    bind: "127.0.0.1" as const,
  };
}

function publicSettings(settings: Settings, openaiConfigured: boolean) {
  return { ...settings, openaiConfigured };
}

async function configured(services: AppServices): Promise<boolean> {
  const key = await services.secrets.get("openai-api-key");
  return Boolean(key);
}

function log(services: AppServices, level: "info" | "error", event: string, fields: { draftId?: string; chatId?: string; detail?: string; status?: string; outcome?: string }): void {
  const settings = services.store.getSettings();
  services.store.addActivity(createActivity(level, event, fields, services.store.sensitiveSnippets(), settings.logMessageContent));
}

function isLoopback(req: Request): boolean {
  const address = req.socket.remoteAddress;
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function allowedHost(host: string | undefined): boolean {
  return /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host ?? "");
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function rendererDir(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(moduleDir, "renderer"), path.resolve(moduleDir, "../../dist/renderer"), path.resolve(process.cwd(), "dist/renderer")];
  return candidates.find((candidate) => existsSync(path.join(candidate, "index.html"))) ?? candidates[0];
}
