const CACHE_VERSION = "vextorn-v6";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

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

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const KEEP = new Set([STATIC_CACHE, ASSET_CACHE, DYNAMIC_CACHE]);
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

  // Live API + sockets must always go to the network.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io/")) {
    return;
  }

  // Hashed Vite bundles in /assets/ are content-addressed and immutable.
  // Cache-first forever: if cached, instant; otherwise fetch + cache.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirstImmutable(request));
    return;
  }

  // Other same-origin static resources (icons, manifest, fonts).
  // Cache-first with network fallback.
  if (
    request.destination === "font" ||
    request.destination === "image" ||
    request.destination === "style" ||
    request.destination === "script"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }
});

async function cacheFirstImmutable(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
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
      body: data.body || "",
      icon: "/vextorn-icon-192.png",
      badge: "/vextorn-icon-192.png",
      data: data.url ? { url: data.url } : undefined,
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
