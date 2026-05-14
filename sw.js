const CACHE = 'electrical-audit-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/react.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install — cache all core assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate — clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — serve from cache first, fallback to network
self.addEventListener('fetch', e => {
  // Skip non-GET and cross-origin requests (e.g. XLSX CDN)
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) {
    // For CDN requests (XLSX), try network first then cache
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  // For local assets: cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
