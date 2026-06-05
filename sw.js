const CACHE = 'electrical-audit-v3';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './react.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Skip all caching on localhost or local network IPs so dev testing always gets fresh files
const isLocal = self.location.hostname === 'localhost'
  || self.location.hostname === '127.0.0.1'
  || /^192\.168\./.test(self.location.hostname);

self.addEventListener('install', e => {
  if (isLocal) { self.skipWaiting(); return; }
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  if (isLocal) { e.waitUntil(self.clients.claim()); return; }
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (isLocal) return; // let the browser fetch normally
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
