// Bump this on EVERY release. With a cache-first strategy an unchanged name means
// users keep the old files forever — and worse, index.html and app.js can be served
// from different generations, producing a mismatched pair that throws at load.
const CACHE_NAME = 'talkcalc-v2.1';

// The app shell: always revalidated against the network so a deploy actually lands.
const SHELL = ['/', '/index.html', '/js/app.js', '/js/iap.js'];
// Static assets that change only when their filename changes.
const ASSETS = ['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL.concat(ASSETS)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

const isShell = req =>
  req.mode === 'navigate' ||
  req.destination === 'document' ||
  req.destination === 'script';

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first for HTML and JS. Cache-first here was why a code change could sit
  // unused on a device indefinitely, and why the two script files could fall out of
  // sync with each other. The cache is still written on every success, so offline
  // still works — it just stops being the first choice when the network is there.
  if (isShell(req)) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first is correct for icons and the manifest: they rarely change and the
  // network round-trip would just slow down first paint.
  event.respondWith(
    caches.match(req).then(res => res || fetch(req).then(net => {
      const copy = net.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
      return net;
    })).catch(() => caches.match('/index.html'))
  );
});
