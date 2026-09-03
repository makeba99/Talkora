/**
 * Shared media proxy utility.
 *
 * Routes Tenor GIF and Google profile image URLs through the server-side proxy
 * at /api/proxy/image so:
 *   1. Tenor's hotlink protection doesn't block the image (browser sends our
 *      origin as Referer; Tenor may reject it — proxying removes the Referer
 *      entirely and fetches from the server).
 *   2. The browser receives a 1-year Cache-Control header instead of Tenor's
 *      1-day TTL.
 *   3. Direct third-party connections are removed from the network waterfall.
 *
 * Must stay in sync with the ALLOWED_HOSTNAMES list in server/image-proxy.ts.
 */

const PROXIED_HOSTNAMES = new Set([
  "media.tenor.com",
  "media1.tenor.com",
  "media2.tenor.com",
  "c.tenor.com",
  "tenor.com",
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
  "i.imgur.com",
  "upload.wikimedia.org",
  "thumb.wikimedia.org",
]);

export function proxyMediaUrl(src: string): string {
  if (!src) return src;
  try {
    const u = new URL(src);
    if (u.protocol === "https:" && PROXIED_HOSTNAMES.has(u.hostname)) {
      return `/api/proxy/image?url=${encodeURIComponent(src)}`;
    }
  } catch {
    // not a valid URL — pass through unchanged
  }
  return src;
}
