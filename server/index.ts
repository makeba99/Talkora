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
import { runMigrations } from "./db";

const app = express();
const httpServer = createServer(app);

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
      const country = (
        (req.headers["cf-ipcountry"] as string) ||
        (req.headers["x-vercel-ip-country"] as string) ||
        (req.headers["x-country-code"] as string) ||
        ""
      ).slice(0, 2).toUpperCase() || undefined;
      const ip = ((req.headers["x-forwarded-for"] as string) || (req.headers["x-real-ip"] as string) || "").split(",")[0].trim();
      const ua = (req.headers["user-agent"] || "").slice(0, 200);
      const sessionHash = createHash("sha256").update(`${ip}::${ua}`).digest("hex").slice(0, 32);
      await s.recordPageView({
        path: req.path.slice(0, 255),
        referrer: referrer.slice(0, 500) || undefined,
        referrerDomain: referrerDomain.slice(0, 120) || undefined,
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

(async () => {
  await runMigrations();
  await setupAuth(app);
  registerAuthRoutes(app);

  await registerRoutes(httpServer, app);
  startCleanupScheduler();

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
})();
