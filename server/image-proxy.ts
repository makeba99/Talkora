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
 * 413. The client-side onError handler hides the element so the card still
 * renders cleanly. This prevents multi-MB GIFs from being stored in the
 * in-memory cache and inflating Lighthouse payload measurements.
 *
 * Tenor GIF → MP4 rewriting: when the request URL is a Tenor .gif, the proxy
 * internally rewrites it to the .mp4 equivalent before fetching. Tenor hosts
 * the same animation as MP4, which is typically 5–10× smaller than the GIF.
 * The client renders Tenor assets with <video autoPlay loop muted> so MP4
 * bytes are decoded correctly. Falls back to the original GIF URL if the MP4
 * variant is unavailable (e.g. older Tenor content without an MP4 track).
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

const TENOR_HOSTNAMES = new Set([
  "media.tenor.com",
  "c.tenor.com",
  "tenor.com",
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

/**
 * If the URL is a Tenor GIF, return the equivalent MP4 URL (5–10× smaller).
 * Returns null for non-Tenor URLs or Tenor URLs that aren't GIFs.
 *
 * Tenor stores every animation as both .gif and .mp4 at the same path — only
 * the file extension differs. Rewriting avoids any Tenor API calls.
 */
function rewriteTenorGifToMp4(url: string): string | null {
  try {
    const u = new URL(url);
    if (!TENOR_HOSTNAMES.has(u.hostname)) return null;
    if (!u.pathname.toLowerCase().endsWith(".gif")) return null;
    u.pathname = u.pathname.slice(0, -4) + ".mp4";
    u.searchParams.delete("itemformat");
    u.searchParams.delete("format");
    return u.toString();
  } catch {
    return null;
  }
}

type CacheEntry = {
  buffer: Buffer;
  contentType: string;
  cachedAt: number;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;
const MAX_PROXY_BYTES = 4 * 1024 * 1024; // 4 MB hard cap
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

async function fetchWithSizeCap(
  fetchUrl: string,
  abortMs = 15_000,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const upstream = await fetch(fetchUrl, {
    headers: {
      "User-Agent": "Vextorn-Proxy/1.0",
      // Prefer WebP/AVIF so Tenor returns a smaller animated WebP when
      // available (typically 60–80 % smaller than the equivalent GIF).
      Accept: "image/avif,image/webp,image/*,video/mp4,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(abortMs),
  });

  if (!upstream.ok) return null;

  const declaredLength = Number(upstream.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_PROXY_BYTES) return null;

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";

  const reader = upstream.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_PROXY_BYTES) {
      reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return { buffer: Buffer.concat(chunks), contentType };
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
      // ── Tenor GIF → MP4 rewrite ──────────────────────────────────────────
      // Attempt to serve the MP4 version first. MP4 is 5–10× smaller than
      // the equivalent GIF and plays correctly in the <video> element that
      // the client uses for Tenor backgrounds. Fall back to the original URL
      // if the MP4 variant is missing (e.g. very old Tenor content).
      const mp4Url = rewriteTenorGifToMp4(url);
      if (mp4Url) {
        const mp4Result = await fetchWithSizeCap(mp4Url).catch(() => null);
        if (mp4Result) {
          evictIfNeeded();
          proxyCache.set(url, { ...mp4Result, cachedAt: Date.now() });
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          res.setHeader("Content-Type", mp4Result.contentType);
          res.setHeader("Content-Length", String(mp4Result.buffer.length));
          res.setHeader("X-Proxy-Cache", "MISS");
          res.setHeader("X-Tenor-Rewritten", "mp4");
          return res.end(mp4Result.buffer);
        }
        // MP4 not available — fall through to the original URL below.
      }
      // ────────────────────────────────────────────────────────────────────

      const result = await fetchWithSizeCap(url);
      if (!result) {
        return res.status(413).json({ error: "Image exceeds size limit or fetch failed" });
      }

      evictIfNeeded();
      proxyCache.set(url, { ...result, cachedAt: Date.now() });

      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Length", String(result.buffer.length));
      res.setHeader("X-Proxy-Cache", "MISS");
      return res.end(result.buffer);
    } catch (err: any) {
      console.error("[image-proxy] fetch failed:", err?.message ?? err);
      return res.status(502).json({ error: "Proxy fetch failed" });
    }
  });
}
