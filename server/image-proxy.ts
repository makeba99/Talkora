/**
 * Image proxy for third-party media with efficient caching.
 *
 * Routes tenor GIFs and Google profile images through our own origin so
 * the browser receives a `Cache-Control: public, max-age=31536000, immutable`
 * header instead of the 1-day TTL those CDNs set. This satisfies Lighthouse's
 * "Use efficient cache lifetimes" audit for those resources and removes the
 * direct third-party connections that contribute to the ">4 preconnect" warning.
 *
 * Security: only URLs from an explicit allowlist of origins are proxied.
 * All other URLs receive a 400 response.
 *
 * Caching: an in-memory LRU map with a 24-hour TTL holds up to 200 entries.
 * The first request fetches from the upstream CDN; subsequent requests are
 * served from memory with no upstream round-trip. The 1-year browser cache
 * means real users almost never hit this endpoint twice for the same asset.
 *
 * Size cap: responses larger than MAX_PROXY_BYTES (4 MB) are rejected with
 * 413. The client-side onError handler hides the <img> so the card still
 * renders cleanly. This prevents multi-MB GIFs from being stored in the
 * in-memory cache and inflating Lighthouse payload measurements.
 */

import type { Express, Request, Response } from "express";

const ALLOWED_HOSTNAMES = new Set([
  "media.tenor.com",
  "c.tenor.com",
  "tenor.com",
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
]);

function isAllowedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    return ALLOWED_HOSTNAMES.has(u.hostname);
  } catch {
    return false;
  }
}

type CacheEntry = {
  buffer: Buffer;
  contentType: string;
  cachedAt: number;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;
const MAX_PROXY_BYTES = 4 * 1024 * 1024; // 4 MB hard cap — rejects multi-MB GIFs
const proxyCache = new Map<string, CacheEntry>();

function evictIfNeeded(): void {
  if (proxyCache.size < MAX_ENTRIES) return;
  let oldest = "";
  let oldestTime = Infinity;
  for (const [key, entry] of proxyCache) {
    if (entry.cachedAt < oldestTime) {
      oldestTime = entry.cachedAt;
      oldest = key;
    }
  }
  if (oldest) proxyCache.delete(oldest);
}

export function registerImageProxy(app: Express): void {
  app.get("/api/proxy/image", async (req: Request, res: Response) => {
    const url = String(req.query.url ?? "").trim();

    if (!url || !isAllowedUrl(url)) {
      return res.status(400).json({ error: "Invalid or disallowed URL" });
    }

    const cached = proxyCache.get(url);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader("Content-Length", String(cached.buffer.length));
      res.setHeader("X-Proxy-Cache", "HIT");
      return res.end(cached.buffer);
    }

    try {
      const upstream = await fetch(url, {
        headers: {
          "User-Agent": "Vextorn-Proxy/1.0",
          // Prefer WebP/AVIF so Tenor returns a smaller animated WebP when
          // available (typically 60–80 % smaller than the equivalent GIF).
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!upstream.ok) {
        return res.status(502).json({ error: `Upstream returned ${upstream.status}` });
      }

      // Early rejection on Content-Length if the upstream declares its size.
      const declaredLength = Number(upstream.headers.get("content-length") ?? 0);
      if (declaredLength > MAX_PROXY_BYTES) {
        return res.status(413).json({ error: "Image exceeds size limit" });
      }

      const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";

      // Stream into chunks so we can abort mid-download if the body exceeds
      // the cap (important for chunked-encoded responses with no Content-Length).
      const reader = upstream.body?.getReader();
      if (!reader) {
        return res.status(502).json({ error: "No response body" });
      }
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_PROXY_BYTES) {
          reader.cancel();
          return res.status(413).json({ error: "Image exceeds size limit" });
        }
        chunks.push(value);
      }
      const buffer = Buffer.concat(chunks);

      evictIfNeeded();
      proxyCache.set(url, { buffer, contentType, cachedAt: Date.now() });

      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", String(buffer.length));
      res.setHeader("X-Proxy-Cache", "MISS");
      return res.end(buffer);
    } catch (err: any) {
      console.error("[image-proxy] fetch failed:", err?.message ?? err);
      return res.status(502).json({ error: "Proxy fetch failed" });
    }
  });
}
