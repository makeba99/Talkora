import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        // Vite emits hashed filenames into /assets/, so they are safe to cache
        // forever — any change ships a new hash. This makes repeat visits
        // near-instant and dramatically improves LCP/FCP on returning users.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }
        // index.html and the SW must always revalidate so users pick up new
        // builds as soon as we ship them.
        if (filePath.endsWith(".html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-cache");
          return;
        }
        // Everything else (favicons, manifest, theme images) — short cache
        // with revalidation to balance freshness and speed.
        res.setHeader("Cache-Control", "public, max-age=86400, must-revalidate");
      },
    }),
  );

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
