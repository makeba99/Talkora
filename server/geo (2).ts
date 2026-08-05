/**
 * Country detection utility.
 *
 * Priority order:
 *   1. CDN/proxy geo headers (Cloudflare `cf-ipcountry`, Vercel
 *      `x-vercel-ip-country`, or a custom `x-country-code` set by a
 *      reverse proxy in front of the app).
 *   2. ip-api.com free API lookup as a fallback — covers Replit dev,
 *      Railway, and other non-CDN environments where the above headers
 *      are absent.  Results are cached in-process for 1 hour to keep
 *      the lookup cost negligible and avoid rate-limit issues.
 *
 * Private/loopback IPs return `undefined` immediately (no API call).
 */

const ipCountryCache = new Map<string, { code: string; ts: number }>();
const CACHE_TTL_MS = 3_600_000;

const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

export async function detectCountry(
  headers: Record<string, any>
): Promise<string | undefined> {
  const fromHeader = (
    (headers["cf-ipcountry"] as string) ||
    (headers["x-vercel-ip-country"] as string) ||
    (headers["x-country-code"] as string) ||
    ""
  )
    .slice(0, 2)
    .toUpperCase();

  if (fromHeader && fromHeader.length === 2 && fromHeader !== "XX") {
    return fromHeader;
  }

  const rawIp = (
    (headers["x-forwarded-for"] as string) ||
    (headers["x-real-ip"] as string) ||
    ""
  )
    .split(",")[0]
    .trim();

  if (
    !rawIp ||
    rawIp === "::1" ||
    rawIp === "127.0.0.1" ||
    PRIVATE_IP_RE.test(rawIp)
  ) {
    return undefined;
  }

  const cached = ipCountryCache.get(rawIp);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.code;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const geoRes = await fetch(
      `http://ip-api.com/json/${rawIp}?fields=countryCode`,
      { signal: ctrl.signal }
    );
    clearTimeout(t);
    const json = (await geoRes.json()) as any;
    const code = (json.countryCode || "").slice(0, 2).toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) {
      ipCountryCache.set(rawIp, { code, ts: Date.now() });
      return code;
    }
  } catch {
    // Geo lookup failed or timed out — silently return undefined
  }

  return undefined;
}
