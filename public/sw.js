/**
 * Service worker.
 *
 * The game is a handful of static files and generates everything else at
 * runtime, so caching is simple: serve same-origin assets from the cache and
 * fall back to the network, but always try the network first for the HTML so
 * a new deploy is picked up on the next launch.
 *
 * This is what makes the installed game start instantly and work with no
 * signal - useful on a phone, and the whole point of installing it.
 */
const VERSION = 'lastgate-v1';
const CORE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(CORE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isDocument = request.mode === 'navigate' || request.destination === 'document';

  if (isDocument) {
    // Network first: a stale index.html would pin an old build forever.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(VERSION).then((c) => c.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match('./index.html'))),
    );
    return;
  }

  // Hashed assets never change, so cache first is safe and fast.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            void caches.open(VERSION).then((c) => c.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
