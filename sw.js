// Service Worker — Slide Master
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = 'slide-master-' + CACHE_VERSION;

const PRECACHE = [
  './',
  './index.html',
  './level.json',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Hanya tangani request same-origin
  if (url.origin !== self.location.origin) return;

  // Network-first untuk HTML navigation & level.json (agar update langsung terlihat)
  const isNavigation = req.mode === 'navigate';
  const isLevelJson = url.pathname.endsWith('/level.json');

  if (isNavigation || isLevelJson) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match('./index.html'))
        )
    );
    return;
  }

  // Cache-first untuk aset statis (icon, manifest, dll)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Revalidate di background
        fetch(req)
          .then((res) => {
            if (res && res.ok) {
              caches.open(CACHE_NAME).then((c) => c.put(req, res));
            }
          })
          .catch(() => {});
        return cached;
      }

      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});

// ===== MESSAGE (untuk skipWaiting dari client) =====
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});