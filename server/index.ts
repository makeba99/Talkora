import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import zlib from "zlib";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { storage } from "./storage";
import { createServer } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { startCleanupScheduler } from "./cleanup";
import { applySecurityMiddleware } from "./security";
import { runMigrations, pool } from "./db";
import { detectCountry } from "./geo";

// ── Global crash guards ──────────────────────────────────────────────────────
// Without these, any unhandled Promise rejection or synchronous throw that
// escapes all try-catches will silently kill the process in Node ≥15.
// We log and continue rather than exiting so transient errors (network blips,
// one bad request) don't take the whole server down.
process.on("unhandledRejection", (reason, promise) => {
  console.error("[process] Unhandled rejection at:", promise, "reason:", reason);
  // Do NOT call process.exit() — let the server keep serving other requests.
});

process.on("uncaughtException", (err) => {
  console.error("[process] Uncaught exception:", err);
  // Only fatal if it's something we truly can't recover from.
  // For network errors, EPIPE, etc. we log and continue.
  if ((err as any).code && ["EPIPE", "ECONNRESET", "ENOTFOUND"].includes((err as any).code)) return;
  // For anything else log and keep running — the error handler middleware
  // will have already returned a 500 response to the caller.
});

const app = express();
const httpServer = createServer(app);

// ── HTTP server error handler ────────────────────────────────────────────────
// Without this, Node's EventEmitter throws any 'error' event as an uncaught
// exception. EADDRINUSE (port already in use) is the most common case in
// rapid-restart scenarios and will silently crash the process without this.
httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[server] Port ${process.env.PORT || 5000} is already in use. Is another instance running?`);
  } else {
    console.error("[server] HTTP server error:", err.message);
  }
  process.exit(1);
});

// Redirect legacy domain afikgang.online → vextorn.com (301 permanent)
const REDIRECT_HOSTS = new Set(["afikgang.online", "www.afikgang.online"]);
app.use((req: Request, res: Response, next: NextFunction) => {
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(":")[0];
  if (REDIRECT_HOSTS.has(host)) {
    return res.redirect(301, `https://vextorn.com${req.url}`);
  }
  next();
});

// Brotli + gzip + deflate compression for all text responses.
// `compression` v1.8 has built-in Brotli support — it picks `br` when the
// client advertises it and falls back to gzip/deflate otherwise — so we
// don't need any extra packages. Brotli at quality 4 is ~15% smaller than
// gzip on HTML/JS/CSS while staying inside our TTFB budget.
//
// threshold 0 compresses everything since SPA payloads are all >>1 KB.
// The custom filter bypasses already-compressed media (images/video/audio/
// fonts) so we don't waste CPU on payloads that can't shrink.
app.use(
  compression({
    level: 6,
    threshold: 0,
    brotli: {
      params: {
        // Quality 6 beats gzip -6 on text payloads with only ~2-5ms extra
        // CPU per response — a clear net win for our HTML/JS/CSS budget.
        // Text mode hint helps the encoder choose better dictionaries.
        [zlib.constants.BROTLI_PARAM_QUALITY]: 6,
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
      },
    },
    filter: (req, res) => {
      const type = String(res.getHeader("Content-Type") || "");
      if (/^image\/(?!svg)/i.test(type)) return false;
      if (/^video\//i.test(type)) return false;
      if (/^audio\//i.test(type)) return false;
      if (/^font\//i.test(type)) return false;
      return compression.filter(req, res);
    },
  }),
);
applySecurityMiddleware(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Fire-and-forget page view tracking — never blocks the request, zero latency impact.
// Only records HTML page loads (not API calls, uploads, or asset requests).
app.use((req: Request, _res: Response, next: NextFunction) => {
  const accept = req.headers.accept || "";
  if (
    req.method !== "GET" ||
    req.path.startsWith("/api/") ||
    req.path.startsWith("/uploads/") ||
    req.path.startsWith("/assets/") ||
    req.path.includes(".") ||
    !accept.includes("text/html")
  ) {
    return next();
  }
  void (async () => {
    try {
      const { storage: s } = await import("./storage");
      const { createHash } = await import("crypto");
      const referrer = (req.headers.referer as string) || (req.headers.referrer as string) || "";
      let referrerDomain = "";
      if (referrer) {
        try { referrerDomain = new URL(referrer).hostname.replace(/^www\./, ""); } catch {}
      }
      const country = await detectCountry(req.headers as Record<string, any>);
      const ip = ((req.headers["x-forwarded-for"] as string) || (req.headers["x-real-ip"] as string) || "").split(",")[0].trim();
      const ua = (req.headers["user-agent"] || "").slice(0, 200);
      const sessionHash = createHash("sha256").update(`${ip}::${ua}`).digest("hex").slice(0, 32);
      // Only store referrer if it's from a different origin (not the app itself)
      const origin = `${req.protocol}://${req.get("host")}`;
      const isExternalReferrer = referrer && !referrer.startsWith(origin);
      await s.recordPageView({
        path: req.path.slice(0, 255),
        referrer: isExternalReferrer ? referrer.slice(0, 500) : undefined,
        referrerDomain: isExternalReferrer ? referrerDomain.slice(0, 120) || undefined : undefined,
        country,
        sessionHash,
      });
    } catch {}
  })();
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// Health check endpoint — registered before any DB-dependent middleware so
// Railway's healthcheckPath (/api/health) always responds even if the DB is
// not yet ready. Returns 200 once the HTTP server is up, which is all Railway
// needs to know the process is alive.
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", ts: Date.now() });
});

(async () => {
  // ── Resilient startup ─────────────────────────────────────────────────────
  // Each step is wrapped in its own try-catch so that a failure in one step
  // (most commonly: DB not yet available on Railway during cold start) does NOT
  // crash the process before httpServer.listen() is called.  Without this,
  // runMigrations() throwing would leave the port unbound, Railway's health
  // check would time out, and the deploy would be marked as failed — even
  // though the static frontend could still be served perfectly well.
  //
  // A degraded startup (DB unavailable) means API endpoints return 500, but
  // the React SPA still loads from dist/public and the user sees the lobby
  // skeleton rather than a blank connection-refused page.
  try {
    await runMigrations();
  } catch (err) {
    console.error("[startup] DB migrations failed — continuing without migrations:", (err as Error)?.message || err);
  }

  // ── VAPID key auto-provisioning ─────────────────────────────────────────────
  // If VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set as environment variables
  // (common in Railway/Replit first-deploy), generate a persistent keypair and
  // store it in app_settings so the same keys survive across restarts/redeploys.
  try {
    const hasPub = !!process.env.VAPID_PUBLIC_KEY;
    const hasPri = !!process.env.VAPID_PRIVATE_KEY;
    if (!hasPub || !hasPri) {
      const { rows: pubRows } = await pool.query<{ value: string }>(
        `SELECT value FROM app_settings WHERE key = 'vapid_public_key'`
      );
      const { rows: priRows } = await pool.query<{ value: string }>(
        `SELECT value FROM app_settings WHERE key = 'vapid_private_key'`
      );
      if (pubRows.length && priRows.length) {
        process.env.VAPID_PUBLIC_KEY = pubRows[0].value;
        process.env.VAPID_PRIVATE_KEY = priRows[0].value;
        log("[vapid] Loaded VAPID keys from app_settings");
      } else {
        const webpush = (await import("web-push")).default;
        const keys = webpush.generateVAPIDKeys();
        await pool.query(
          `INSERT INTO app_settings (key, value) VALUES ('vapid_public_key', $1), ('vapid_private_key', $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [keys.publicKey, keys.privateKey]
        );
        process.env.VAPID_PUBLIC_KEY = keys.publicKey;
        process.env.VAPID_PRIVATE_KEY = keys.privateKey;
        log(`[vapid] Generated and stored new VAPID keys (public: ${keys.publicKey.slice(0, 20)}…)`);
      }
    }
  } catch (err) {
    console.error("[startup] VAPID key provisioning failed:", (err as Error)?.message || err);
  }

  // ── SESSION_SECRET auto-provisioning ────────────────────────────────────────
  // SESSION_SECRET must be stable across restarts so existing browser sessions
  // remain valid. Without it, every server restart invalidates all sessions —
  // logged-in users get silently logged out on the next page load.
  //
  // Strategy (same as VAPID keys): generate once, store in app_settings, reload
  // on every subsequent boot. This means zero manual env-var management while
  // still giving each deployment its own unique, persistent secret.
  try {
    if (!process.env.SESSION_SECRET) {
      const { rows } = await pool.query<{ value: string }>(
        `SELECT value FROM app_settings WHERE key = 'session_secret'`
      );
      if (rows.length) {
        process.env.SESSION_SECRET = rows[0].value;
        log("[session] Loaded SESSION_SECRET from app_settings");
      } else {
        const { randomBytes } = await import("crypto");
        const secret = randomBytes(48).toString("hex"); // 96-char hex string
        await pool.query(
          `INSERT INTO app_settings (key, value) VALUES ('session_secret', $1)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [secret]
        );
        process.env.SESSION_SECRET = secret;
        log("[session] Generated and stored new SESSION_SECRET");
      }
    }
  } catch (err) {
    console.error("[startup] SESSION_SECRET provisioning failed — sessions may not persist:", (err as Error)?.message || err);
  }

  try {
    await setupAuth(app);
    registerAuthRoutes(app);
  } catch (err) {
    console.error("[startup] Auth setup failed — auth endpoints may be unavailable:", (err as Error)?.message || err);
  }

  try {
    await registerRoutes(httpServer, app);
    startCleanupScheduler();
  } catch (err) {
    console.error("[startup] Route registration failed:", (err as Error)?.message || err);
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app, async () => {
      const [allRooms, announcements] = await Promise.all([
        storage.getAllRooms(),
        storage.getAnnouncements(),
      ]);
      // Match the /api/rooms filter exactly: only rooms with active users,
      // and strip the accessKey field for public safety.
      const rooms = allRooms
        .filter((r: any) => (r.activeUsers ?? 0) > 0)
        .map((r: any) => ({ ...r, accessKey: null }));
      return { rooms, announcements } as Record<string, unknown>;
    });
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
      // Cache-warming ping. The lobby's primary data fetch is `getAllRooms()`,
      // and on a cold process it pays for: Postgres connection acquisition
      // from the pool, Drizzle query compilation, and a cold Postgres query
      // plan + page cache. Pre-executing it here means the very first real
      // visitor's `/api/rooms` call hits a fully warm code path, shaving
      // ~50–150 ms off their TTFB. Fire-and-forget — a warm-up failure must
      // never affect server availability or block the listen callback.
      void (async () => {
        try {
          const t0 = Date.now();
          await storage.getAllRooms();
          log(`cache-warmed /api/rooms in ${Date.now() - t0}ms`);
        } catch (err) {
          log(`cache-warm skipped: ${(err as Error)?.message || String(err)}`);
        }
      })();
      setTimeout(() => {
        void (async () => {
          try {
            const t0 = Date.now();
            await storage.getPublishedAnnouncements(5, undefined, true);
            log(`cache-warmed /api/announcements in ${Date.now() - t0}ms`);
          } catch (err) {
            log(`announcement cache-warm skipped: ${(err as Error)?.message || String(err)}`);
          }
        })();
      }, 2000);
    },
  );

  // ── Graceful shutdown ────────────────────────────────────────────────────────
  // Replit's autoscale platform (and most container orchestrators) send SIGTERM
  // before forcibly killing the process with SIGKILL. Without a handler the
  // process exits immediately — mid-flight HTTP requests get a connection reset,
  // active WebSocket/Socket.IO connections are torn down without a close frame,
  // and the PostgreSQL pool is abandoned (leaking a connection for up to 30s
  // on the DB side). With the handler we:
  //   1. Stop accepting new connections (httpServer.close())
  //   2. Wait up to 10s for in-flight requests to finish
  //   3. Drain the PostgreSQL pool
  //   4. Exit cleanly with code 0 so the orchestrator knows we shut down OK
  let isShuttingDown = false;
  const shutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log(`[shutdown] Received ${signal} — shutting down gracefully…`);

    // Stop accepting new connections; existing ones can finish.
    httpServer.close(async () => {
      log("[shutdown] HTTP server closed");
      try {
        await pool.end();
        log("[shutdown] PostgreSQL pool drained");
      } catch (err) {
        console.error("[shutdown] Pool drain error:", (err as Error)?.message);
      }
      log("[shutdown] Goodbye.");
      process.exit(0);
    });

    // Hard-kill safety net: if the server hasn't closed within 10s, force exit.
    // This prevents Replit from waiting for SIGKILL (which would take longer
    // and could leave DB connections hanging).
    setTimeout(() => {
      console.error("[shutdown] Graceful shutdown timed out after 10s — forcing exit");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
})();
