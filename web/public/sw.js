/* Reading Buddy service worker.
   Goals: make the app installable and instant-loading, without ever interfering
   with the backend. Strategy:
   - Never touch non-GET requests (the Modal audio POSTs pass straight through).
   - Never touch cross-origin requests (Modal s2s/warmup are left alone).
   - Navigations: network-first (so a new deploy shows immediately), falling back
     to the cached shell when offline.
   - Same-origin static assets: stale-while-revalidate for instant loads. */

const CACHE = "reading-buddy-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Leave POSTs (Modal calls) and cross-origin requests completely alone.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML navigations: network-first so new deploys win; cache shell as fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put("/", net.clone());
          return net;
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match("/")) || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets: serve from cache immediately, refresh in the background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((net) => {
          if (net && net.status === 200) cache.put(req, net.clone());
          return net;
        })
        .catch(() => cached);
      return cached || network;
    })()
  );
});
