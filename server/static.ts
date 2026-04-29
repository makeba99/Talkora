import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

/**
 * Build a transformed copy of `index.html` plus a precomputed `Link` header
 * value that pre-warms the LCP critical path:
 *
 *  - Vite already injects `<link rel="modulepreload">` for chunks the entry
 *    statically imports, but the lobby (the LCP route) is `lazy()`-loaded,
 *    so the browser only discovers it AFTER React mounts. That costs an
 *    extra round-trip on first paint.
 *  - We scan `dist/public/assets/` for the lobby chunk + critical vendor
 *    chunks + the entry CSS, inject `<link rel="modulepreload">` tags into
 *    `<head>`, and emit a matching `Link:` HTTP header so the browser can
 *    start fetching them in parallel with HTML parsing.
 *
 * Done once at startup — every request just serves the cached buffer + header.
 */
function precomputeIndexHtml(distPath: string): { html: string; linkHeader: string } | null {
  const indexPath = path.join(distPath, "index.html");
  const assetsDir = path.join(distPath, "assets");
  if (!fs.existsSync(indexPath) || !fs.existsSync(assetsDir)) return null;

  let html: string;
  try {
    html = fs.readFileSync(indexPath, "utf8");
  } catch {
    return null;
  }

  let assetFiles: string[];
  try {
    assetFiles = fs.readdirSync(assetsDir);
  } catch {
    return null;
  }

  // Match the lazy-loaded chunks that sit on the LCP critical path. The
  // names come from the route imports in client/src/App.tsx and the
  // manualChunks split in vite.config.ts. Anything not on the LCP path
  // (admin, dm, room, teachers, payment-methods, charts/emoji/chess) is
  // intentionally excluded so we don't waste bandwidth pre-warming chunks
  // the user may never visit.
  const criticalScriptPatterns: RegExp[] = [
    /^lobby-[\w-]+\.js$/,             // LCP route
    /^react-vendor-[\w-]+\.js$/,      // react + react-dom + wouter
    /^query-vendor-[\w-]+\.js$/,      // tanstack/react-query
    /^radix-vendor-[\w-]+\.js$/,      // radix primitives used by lobby chrome
    /^icons-vendor-[\w-]+\.js$/,      // lucide-react icons rendered on lobby
    /^room-card-[\w-]+\.js$/,         // lobby grid item — sometimes split out
  ];
  const criticalStylePatterns: RegExp[] = [
    /^index-[\w-]+\.css$/,            // entry CSS
    /^lobby-[\w-]+\.css$/,            // route-level CSS, if cssCodeSplit emits one
  ];

  const scriptHrefs: string[] = [];
  const styleHrefs: string[] = [];

  for (const file of assetFiles) {
    if (criticalScriptPatterns.some((re) => re.test(file))) {
      scriptHrefs.push(`/assets/${file}`);
    } else if (criticalStylePatterns.some((re) => re.test(file))) {
      styleHrefs.push(`/assets/${file}`);
    }
  }

  // De-duplicate against any preload Vite already emitted into the HTML so
  // we don't ship two preload tags for the same file.
  const alreadyPreloaded = new Set<string>();
  const preloadRe = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:modulepreload|preload|stylesheet)["']/gi;
  const preloadRe2 = /<link[^>]+rel=["'](?:modulepreload|preload|stylesheet)["'][^>]*href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = preloadRe.exec(html)) !== null) alreadyPreloaded.add(m[1]);
  while ((m = preloadRe2.exec(html)) !== null) alreadyPreloaded.add(m[1]);

  const newScripts = scriptHrefs.filter((h) => !alreadyPreloaded.has(h));
  const newStyles = styleHrefs.filter((h) => !alreadyPreloaded.has(h));

  // Inject the missing modulepreload/style tags right before </head>. Order
  // doesn't matter for fetch priority — the browser starts the requests as
  // soon as it sees them in the parser stream.
  if (newScripts.length || newStyles.length) {
    const injection = [
      ...newScripts.map((h) => `    <link rel="modulepreload" href="${h}" crossorigin />`),
      ...newStyles.map((h) => `    <link rel="preload" href="${h}" as="style" />`),
    ].join("\n");
    html = html.replace(/<\/head>/i, `${injection}\n  </head>`);
  }

  // Build the Link HTTP header — this beats the in-HTML link tags by a
  // round-trip because the browser sees it before HTML parsing starts.
  // Limit to ~6 entries to stay under common 8 KB header limits.
  const headerEntries: string[] = [];
  for (const h of [...scriptHrefs].slice(0, 5)) {
    headerEntries.push(`<${h}>; rel=modulepreload; crossorigin`);
  }
  for (const h of [...styleHrefs].slice(0, 2)) {
    headerEntries.push(`<${h}>; rel=preload; as=style`);
  }
  const linkHeader = headerEntries.join(", ");

  return { html, linkHeader };
}

// Minimal MIME table for the precompressed-asset handler. The runtime
// compression middleware bypasses any response that already has a
// Content-Encoding header set, so this handler can safely set the encoding
// and let express.static (or our SPA fallback) handle the rest.
const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const precomputed = precomputeIndexHtml(distPath);

  // Pre-compressed asset handler. At build time we emit `<file>.br` (Brotli
  // q11) and `<file>.gz` (gzip 9) next to every text asset in dist/public/.
  // When the client supports `br` or `gzip`, we serve the pre-encoded copy
  // directly — skipping runtime compression entirely AND using a higher
  // compression ratio than any live encoder can afford. Free LCP win.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const accept = String(req.headers["accept-encoding"] || "");
    let encoding: "br" | "gzip" | null = null;
    if (/\bbr\b/i.test(accept)) encoding = "br";
    else if (/\bgzip\b/i.test(accept)) encoding = "gzip";
    if (!encoding) return next();

    // Resolve the requested path safely (no `..` traversal).
    const reqPath = decodeURIComponent(req.path);
    if (reqPath.includes("\0")) return next();
    const fullPath = path.join(distPath, reqPath);
    if (!fullPath.startsWith(distPath + path.sep) && fullPath !== distPath) {
      return next();
    }
    // index.html is served via the precomputed-HTML buffer below, not from
    // disk — skip it here so we don't ship a stale pre-compressed copy.
    if (reqPath === "/" || reqPath.endsWith("/index.html")) return next();

    const ext = path.extname(reqPath).toLowerCase();
    const mime = MIME_BY_EXT[ext];
    if (!mime) return next();

    const compressedPath = fullPath + (encoding === "br" ? ".br" : ".gz");
    if (!fs.existsSync(compressedPath)) return next();

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Encoding", encoding);
    res.setHeader("Vary", "Accept-Encoding");
    // Cache headers mirror the live express.static handler so the precompressed
    // path doesn't get a different TTL than the uncompressed path.
    if (reqPath.startsWith("/assets/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else if (reqPath.endsWith(".html") || reqPath.endsWith("sw.js")) {
      res.setHeader("Cache-Control", "no-cache");
    } else {
      res.setHeader("Cache-Control", "public, max-age=31536000, must-revalidate");
    }
    res.sendFile(compressedPath);
  });

  // Fast path for index.html: serve the in-memory transformed copy and emit
  // the precomputed Link header. We register this BEFORE express.static so
  // it wins for the bare `/` request and the SPA catch-all below.
  const sendIndex = (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (precomputed?.linkHeader) {
      res.setHeader("Link", precomputed.linkHeader);
    }
    if (precomputed?.html) {
      res.send(precomputed.html);
    } else {
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  };

  app.get("/", sendIndex);
  app.get("/index.html", sendIndex);

  app.use(
    express.static(distPath, {
      // Skip serving index.html via the static handler — we handle it above
      // so we always emit the Link header and the precomputed buffer.
      index: false,
      setHeaders: (res, filePath) => {
        // Vite emits hashed filenames into /assets/, so they are safe to cache
        // forever — any change ships a new hash. This makes repeat visits
        // near-instant and dramatically improves LCP/FCP on returning users.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }
        // index.html, robots.txt, sitemap.xml and the SW must always
        // revalidate so users and crawlers pick up new builds/sitemaps as
        // soon as we ship them.
        if (
          filePath.endsWith(".html") ||
          filePath.endsWith("sw.js") ||
          filePath.endsWith("robots.txt") ||
          filePath.endsWith("sitemap.xml")
        ) {
          res.setHeader("Cache-Control", "no-cache");
          return;
        }
        // Static branding (favicons, manifest, theme images, app icons).
        // These rarely change and are content-stable, so cache for 1 year
        // (the maximum that satisfies Lighthouse's "use efficient cache
        // lifetimes" audit). The service worker's CACHE_VERSION bump and
        // any URL change ship a new copy regardless.
        res.setHeader("Cache-Control", "public, max-age=31536000, must-revalidate");
      },
    }),
  );

  // SPA catch-all: anything else falls back to the (precomputed) index.html.
  app.use("/{*path}", sendIndex);
}
