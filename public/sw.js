// Network-first SW — always checks for updates, uses cache only when offline
const CACHE_NAME = "shotclock-v3";

self.addEventListener("install", () => {
  self.skipWaiting(); // activate immediately, don't wait
});

self.addEventListener("activate", (event) => {
  // Delete ALL old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => self.clients.claim()) // take control immediately
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    // ALWAYS try network first
    fetch(event.request)
      .then((response) => {
        // Got fresh response — cache it and return
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed (offline) — serve from cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});