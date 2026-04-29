import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { startCleanupScheduler } from "./cleanup";
import { applySecurityMiddleware } from "./security";

const app = express();
const httpServer = createServer(app);

// gzip/deflate compression for all text responses. Tuned slightly for SPAs:
// level 6 is the gzip default and the best speed/ratio tradeoff; threshold
// 0 compresses everything since our HTML/JS/CSS payloads are all >>1 KB.
// (Brotli would be ~15% smaller but the `compression` package only does
// gzip — adding a real brotli layer requires a tested package install,
// which we'll defer to avoid a regression risk.)
app.use(
  compression({
    level: 6,
    threshold: 0,
    filter: (req, res) => {
      const type = String(res.getHeader("Content-Type") || "");
      // Skip already-compressed payloads — wastes CPU and breaks streams.
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
