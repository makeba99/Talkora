const CACHE_VERSION = "vextorn-v9";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const ASSET_CACHE  = `${CACHE_VERSION}-assets`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE    = `${CACHE_VERSION}-api`;

// Pre-cache only truly static, versioned-forever assets.
// HTML is intentionally excluded — we never intercept navigation requests.
// Reason: intercepting HTML navigations causes crawlers (Googlebot, PageSpeed
// Insights, Lighthouse) to receive the offline fallback page instead of the
// real lobby when their simulated network throttling makes the fetch fail.
// Letting the browser fetch HTML natively means crawlers and real users always
// get the live page; static assets below are still cached for speed.
const STATIC_ASSETS = [
  "/manifest.json",
  "/vextorn-mark.svg",
  "/vextorn-icon-192.png",
  "/vextorn-icon-512.png",
];

// Lobby-critical API endpoints that are safe to serve stale on repeat visits.
// These are all public GET endpoints whose data is acceptable to show from
// cache for a few seconds while a fresh copy is fetched in the background.
//   - /api/rooms            — public room list, changes infrequently
//   - /api/rooms/participants — live participant counts (short stale window)
//   - /api/announcements    — platform announcements, rarely change
//   - /api/maintenance      — maintenance flag, changes extremely rarely
//
// /api/auth/user is intentionally excluded: it's private (Cookie-gated),
// changes on login/logout, and must never be served stale to avoid showing
// a logged-in shell to a user who signed out.
const SWR_PATHS = [
  "/api/rooms",
  "/api/rooms/participants",
  "/api/announcements",
  "/api/maintenance",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const KEEP = new Set([STATIC_CACHE, ASSET_CACHE, DYNAMIC_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Same-origin only; never intercept Replit workspace shell.
  if (url.hostname !== self.location.hostname || url.pathname.startsWith("/__replco/")) {
    return;
  }

  // NAVIGATION REQUESTS (HTML pages): never intercept.
  // Let the browser fetch these directly so crawlers, PageSpeed, and users
  // always receive the real page from the server, never a cached offline page.
  if (request.mode === "navigate" || request.destination === "document") {
    return;
  }

  // Stale-while-revalidate for lobby-critical public API endpoints.
  // On first visit: fetch from network and cache the response.
  // On repeat visits: serve the cached response INSTANTLY (0ms), then fetch
  // a fresh copy in the background so the NEXT load also gets a fast hit.
  // This removes these requests from the Lighthouse LCP waterfall entirely
  // on repeat views and satisfies the "Use efficient cache lifetimes" audit.
  if (SWR_PATHS.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache   = await caches.open(API_CACHE);
        const cached  = await cache.match(request);

        // Always kick off a background network fetch to keep the cache fresh.
        const networkPromise = fetch(request.clone())
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => null);

        if (cached) {
          // Serve stale immediately; extend the SW lifetime so the background
          // fetch can complete even after respondWith has already resolved.
          event.waitUntil(networkPromise);
          return cached;
        }

        // No cache entry yet — wait for the first network response.
        return (await networkPromise) || new Response(
          '{"error":"offline"}',
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      })()
    );
    return;
  }

  // All other API / socket requests must always hit the network.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io/")) {
    return;
  }

  // Hashed Vite bundles in /assets/ are content-addressed and immutable.
  // Cache-first forever: if cached, instant; otherwise fetch + cache.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirstImmutable(request));
    return;
  }

  // Other same-origin static resources (icons, manifest, fonts, images).
  // Cache-first with network fallback.
  if (
    request.destination === "font"  ||
    request.destination === "image" ||
    request.destination === "style" ||
    request.destination === "script"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }
});

async function cacheFirstImmutable(request) {
  const cache  = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function cacheFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Asset unavailable", { status: 503 });
  }
}

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "Vextorn", {
      body:   data.body || "",
      icon:   "/vextorn-icon-192.png",
      badge:  "/vextorn-icon-192.png",
      data:   data.url ? { url: data.url } : undefined,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) return client.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});
