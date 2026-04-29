import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import zlib from "zlib";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { startCleanupScheduler } from "./cleanup";
import { applySecurityMiddleware } from "./security";

const app = express();
const httpServer = createServer(app);

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
    serveStatic(app);
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
    },
  );
})();
