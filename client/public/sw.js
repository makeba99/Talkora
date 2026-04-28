const CACHE_VERSION = "vextorn-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const HTML_CACHE = `${CACHE_VERSION}-html`;

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.png",
  "/vextorn-mark.svg",
  "/vextorn-icon-192.png",
  "/vextorn-icon-512.png",
];

const OFFLINE_FALLBACK = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Vextorn — Offline</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d0b18;color:#e2e8f0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}
    .icon{font-size:64px;margin-bottom:24px}
    h1{font-size:24px;font-weight:700;margin-bottom:12px;color:#a78bfa}
    p{font-size:15px;color:#94a3b8;max-width:320px;line-height:1.6;margin-bottom:24px}
    button{background:#7c3aed;color:#fff;border:none;border-radius:12px;padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer;transition:opacity .2s}
    button:hover{opacity:.85}
  </style>
</head>
<body>
  <div class="icon">🔌</div>
  <h1>You're offline</h1>
  <p>Vextorn needs an internet connection to connect you with other language learners. Please check your connection and try again.</p>
  <button onclick="location.reload()">Try again</button>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const KEEP = new Set([STATIC_CACHE, DYNAMIC_CACHE, ASSET_CACHE, HTML_CACHE]);
  event.waitUntil(
    Promise.all([
      // Enable navigation preload so the network response races the SW boot.
      self.registration.navigationPreload?.enable().catch(() => {}),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => !KEEP.has(key)).map((key) => caches.delete(key)))
      ),
    ]).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Same-origin only; never intercept the Replit workspace iframe shell.
  if (url.hostname !== self.location.hostname || url.pathname.startsWith("/__replco/")) {
    return;
  }

  // Live data + sockets must always hit the network.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Hashed Vite output in /assets/ is immutable — serve from cache forever.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirstImmutable(request));
    return;
  }

  // HTML / navigations: stale-while-revalidate keeps repeat visits instant.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(staleWhileRevalidateHtml(event));
    return;
  }

  // Other static-by-destination resources (icons, manifest, fonts loaded
  // from same origin) — cache-first with background refresh.
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "image"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirstWithOfflineFallback(request));
});

async function cacheFirstImmutable(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response("Asset unavailable offline", { status: 503 });
  }
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
    return new Response("Asset unavailable offline", { status: 503 });
  }
}

async function staleWhileRevalidateHtml(event) {
  const { request } = event;
  const cache = await caches.open(HTML_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });

  const networkFetch = (async () => {
    try {
      const preload = await event.preloadResponse;
      const response = preload || (await fetch(request));
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      return null;
    }
  })();

  if (cached) {
    event.waitUntil(networkFetch);
    return cached;
  }

  const fresh = await networkFetch;
  if (fresh) return fresh;

  const indexCached = await cache.match("/");
  if (indexCached) return indexCached;
  return new Response(OFFLINE_FALLBACK, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const indexCached = await caches.match("/");
    if (indexCached) return indexCached;
    return new Response(OFFLINE_FALLBACK, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
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
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
