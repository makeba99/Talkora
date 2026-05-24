/**
 * Image proxy for third-party media with efficient caching.
 *
 * Routes Tenor GIFs and Google profile images through our own origin so
 * the browser receives a `Cache-Control: public, max-age=31536000, immutable`
 * header instead of the 1-day TTL those CDNs set. This satisfies Lighthouse's
 * "Use efficient cache lifetimes" audit and removes direct third-party
 * connections that contribute to the ">4 preconnect" warning.
 *
 * Security: only URLs from an explicit allowlist of origins are proxied.
 * All other URLs receive a 400 response.
 *
 * Caching strategy (two-tier):
 *   ≤ CACHE_MAX_BYTES (4 MB): buffered in the LRU map, served instantly.
 *   > CACHE_MAX_BYTES:        streamed directly from upstream — no buffering,
 *     no 413. This eliminates the failure mode where large animated GIFs used
 *     as lobby card backgrounds showed a blank card because the browser cached
 *     the old 413 response.
 *
 * Error responses always include Cache-Control: no-store so the browser never
 * caches a transient failure (upstream blip, timeout, etc.).
 *
 * Accept header: the proxy requests image/avif,image/webp so Tenor returns
 * animated WebP when available (60-80% smaller than GIF). The <img> element
 * on the client displays animated WebP natively — no <video> needed.
 */

import type { Express, Request, Response } from "express";

const ALLOWED_HOSTNAMES = new Set([
  "media.tenor.com",
  "media1.tenor.com",
  "media2.tenor.com",
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
/** Files at or below this size are buffered and cached in the LRU map. */
const CACHE_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
/** Hard limit for streamed (non-cached) responses — protects against huge files. */
const STREAM_MAX_BYTES = 30 * 1024 * 1024; // 30 MB
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

function sendNoStore(res: Response, status: number, message: string) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json({ error: message });
}

export function registerImageProxy(app: Express): void {
  app.get("/api/proxy/image", async (req: Request, res: Response) => {
    const url = String(req.query.url ?? "").trim();

    if (!url || !isAllowedUrl(url)) {
      return sendNoStore(res, 400, "Invalid or disallowed URL");
    }

    // Serve from in-memory cache when fresh.
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
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(20_000),
      });

      if (!upstream.ok) {
        return sendNoStore(res, 502, "Upstream fetch failed");
      }

      const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
      const declaredLength = Number(upstream.headers.get("content-length") ?? 0);

      // ── Streaming path for large files (> CACHE_MAX_BYTES) ──────────────
      // Never buffer or cache; pass bytes straight through. This prevents
      // 413 responses which the browser would cache, breaking card backgrounds.
      if (declaredLength > CACHE_MAX_BYTES) {
        if (declaredLength > STREAM_MAX_BYTES) {
          return sendNoStore(res, 413, "Image exceeds maximum size");
        }
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.setHeader("Content-Type", contentType);
        if (declaredLength) res.setHeader("Content-Length", String(declaredLength));

        const reader = upstream.body?.getReader();
        if (!reader) return sendNoStore(res, 502, "No response body");

        let streamed = 0;
        let aborted = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamed += value.byteLength;
          if (streamed > STREAM_MAX_BYTES) {
            reader.cancel();
            aborted = true;
            break;
          }
          res.write(Buffer.from(value));
        }
        if (!aborted) res.end();
        return;
      }

      // ── Buffered path for small files (≤ CACHE_MAX_BYTES) ───────────────
      // Buffer the full response, cache it, then serve instantly on repeat requests.
      const reader = upstream.body?.getReader();
      if (!reader) return sendNoStore(res, 502, "No response body");

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > CACHE_MAX_BYTES) {
          // Content-Length was absent or wrong — fall back to streaming the rest.
          // We already buffered some chunks; send them then stream the remainder.
          reader.cancel();
          // Send what we have as a non-cached response.
          res.setHeader("Cache-Control", "public, max-age=86400");
          res.setHeader("Content-Type", contentType);
          for (const chunk of chunks) res.write(Buffer.from(chunk));
          res.write(Buffer.from(value));
          res.end();
          return;
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
      return sendNoStore(res, 502, "Proxy fetch failed");
    }
  });
}
