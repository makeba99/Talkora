import path from "path";
import fs from "fs";
import type { Request } from "express";

/**
 * Per-route SEO + Breadcrumb structured-data injector.
 *
 * Why this file exists:
 *   Vextorn is a single-page React app, so by default every route serves the
 *   same `index.html` with the same generic `<title>` / `<meta description>`
 *   / OG tags / no breadcrumb. That's fine for users (React paints the right
 *   page), but it's bad for:
 *     1. Google rich results (no BreadcrumbList = no sitelink trail in SERP)
 *     2. Lighthouse SEO audits ("Document does not have a meta description"
 *        passes only because of the generic one — per-page text is far better)
 *     3. Social-card crawlers (every shared link looked the same)
 *
 *   This module fixes all three by transforming the built `index.html` on
 *   the fly for known SPA routes (`/teachers`, `/teachers/:id`, `/admin`,
 *   `/payment-methods`, `/messages/:userId`, `/room/:id`). Each route gets
 *   its own title, description, canonical, OG/Twitter tags, AND a fresh
 *   `BreadcrumbList` JSON-LD block — every page becomes individually
 *   rich-result eligible.
 *
 *   Only runs in production (where `dist/public/index.html` exists). In dev
 *   the Vite catch-all serves the un-rewritten template so HMR keeps
 *   working unchanged.
 */

let cachedTemplate: string | null = null;

function loadTemplate(): string | null {
  if (cachedTemplate) return cachedTemplate;
  // server/static.ts resolves the same path; we mirror it here so the two
  // stay in lock-step. The CJS bundle ships with __dirname defined natively.
  const indexPath = path.resolve(__dirname, "public", "index.html");
  if (!fs.existsSync(indexPath)) return null;
  cachedTemplate = fs.readFileSync(indexPath, "utf-8");
  return cachedTemplate;
}

/** RFC-compliant HTML attribute escape. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Safely embed strings inside a JSON-LD <script> block. */
function jsonSafe(s: string): string {
  // </script> in user data would break the JSON-LD block; the spec says we
  // must escape the forward slash. JSON.stringify handles the rest.
  return JSON.stringify(s).replace(/<\/script/gi, "<\\/script");
}

export function getOrigin(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.get("host") || "vextorn.com";
  return `${proto}://${host}`;
}

export interface BreadcrumbItem {
  /** Human-readable label shown in the SERP trail. */
  name: string;
  /** Absolute URL (or path resolved against origin in `buildBreadcrumbJsonLd`). */
  url: string;
}

/**
 * Build a schema.org BreadcrumbList JSON-LD `<script>` block.
 * Pass an absolute origin so relative URLs resolve correctly even when
 * crawlers index a preview deployment with a non-canonical host.
 */
export function buildBreadcrumbJsonLd(
  origin: string,
  items: BreadcrumbItem[],
): string {
  const itemListElement = items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    // Resolve relative paths against origin; pass through absolute URLs as-is.
    item: /^https?:\/\//i.test(it.url) ? it.url : `${origin}${it.url}`,
  }));
  const payload = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
  // Pretty-print for readability in "view source" without bloating bytes
  // meaningfully — the HTML response is compressed (br/gzip) anyway.
  const json = JSON.stringify(payload, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
  return `<script type="application/ld+json">${json}</script>`;
}

export interface InjectOptions {
  title: string;
  description: string;
  /** Absolute canonical URL for this exact route. */
  canonical: string;
  /** Absolute OG image URL; falls back to brand icon if omitted. */
  ogImage?: string;
  /** Breadcrumb trail. The first item should usually be {name:"Home", url:"/"}. */
  breadcrumbs?: BreadcrumbItem[];
  /** When true, swap the `robots` meta to `noindex, follow` (admin pages). */
  noindex?: boolean;
}

/**
 * Render the built index.html with the given route-specific metadata
 * applied. Every regex is anchored to the exact attribute layout in
 * `client/index.html` — keep them in sync if you edit the template head.
 */
export function renderIndexHtml(
  origin: string,
  opts: InjectOptions,
): string | null {
  const template = loadTemplate();
  if (!template) return null;

  const fallbackImage = `${origin}/vextorn-icon-512.png`;
  const ogImage = opts.ogImage || fallbackImage;

  const eTitle = escapeHtml(opts.title);
  const eDesc = escapeHtml(opts.description);
  const eUrl = escapeHtml(opts.canonical);
  const eImage = escapeHtml(ogImage);

  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${eTitle}</title>`)
    .replace(
      /<meta name="description" content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${eDesc}" />`,
    )
    .replace(
      /<link rel="canonical" href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${eUrl}" />`,
    )
    .replace(
      /<meta property="og:title" content="[^"]*"\s*\/?>/,
      `<meta property="og:title" content="${eTitle}" />`,
    )
    .replace(
      /<meta property="og:description" content="[^"]*"\s*\/?>/,
      `<meta property="og:description" content="${eDesc}" />`,
    )
    .replace(
      /<meta property="og:url" content="[^"]*"\s*\/?>/,
      `<meta property="og:url" content="${eUrl}" />`,
    )
    .replace(
      /<meta property="og:image" content="[^"]*"\s*\/?>/,
      `<meta property="og:image" content="${eImage}" />`,
    )
    .replace(
      /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
      `<meta name="twitter:title" content="${eTitle}" />`,
    )
    .replace(
      /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
      `<meta name="twitter:description" content="${eDesc}" />`,
    )
    .replace(
      /<meta name="twitter:image" content="[^"]*"\s*\/?>/,
      `<meta name="twitter:image" content="${eImage}" />`,
    );

  if (opts.noindex) {
    // Swap the two robots meta tags. We keep `follow` so internal links
    // from admin pages still pass authority signals to public pages.
    html = html
      .replace(
        /<meta name="robots" content="[^"]*"\s*\/?>/,
        `<meta name="robots" content="noindex, follow" />`,
      )
      .replace(
        /<meta name="googlebot" content="[^"]*"\s*\/?>/,
        `<meta name="googlebot" content="noindex, follow" />`,
      );
  }

  if (opts.breadcrumbs && opts.breadcrumbs.length > 0) {
    const bc = buildBreadcrumbJsonLd(origin, opts.breadcrumbs);
    // Inject right before </head> so it ships in the same parse pass as
    // the existing organization/website JSON-LD already in the template.
    html = html.replace(/<\/head>/i, `    ${bc}\n  </head>`);
  }

  // Quiet, content-addressed-style void of jsonSafe — we still want the
  // helper available for callers that build custom JSON-LD blocks.
  void jsonSafe;
  return html;
}
