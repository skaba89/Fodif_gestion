// Axe D2 (docs/14-ROADMAP-SAAS-PREMIUM.md) - offline shell for agents in low-connectivity zones.
// Deliberately hand-written and dependency-free (no Workbox): the strategy is small enough to
// read in full, and a build-time SW bundler would be one more moving part for a handful of
// rules. Bump CACHE_NAME whenever the app-shell list or the strategy below changes, so old
// caches are dropped on activate instead of accumulating.
const CACHE_NAME = 'fodip-shell-v1';
const OFFLINE_URL = '/hors-ligne';
const APP_SHELL = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  // Activate this version as soon as it finishes installing, instead of waiting for every open
  // tab of the old version to close - the app shell above is small and safe to swap in eagerly.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only ever intercept safe, same-origin GETs. Mutations (POST/PUT/PATCH/DELETE) always go
  // straight to the network so a flaky connection fails loudly instead of silently no-opping.
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  // Never intercept the backend proxy: API responses carry session-scoped, often sensitive
  // data (financing files, personal data) that must never be served stale from a shared cache,
  // and an offline API call should fail normally so the UI can show its own error state rather
  // than silently replaying an old response.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    // Network-first for page loads: always prefer the live page, and only fall back to the
    // cached offline shell when the network request itself fails outright.
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Next's content-hashed build output and the icons/manifest above are immutable by
  // construction (a change ships under a new hashed URL), so cache-first is safe here and
  // keeps the app shell working fully offline after the first successful visit.
  const isImmutableAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest';
  if (isImmutableAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
