// Bump this on EVERY release. Under stale-while-revalidate a stale cache now
// survives an extra launch by design, so the version name is the only thing
// guaranteeing users eventually land on a consistent set of files.
const CACHE_NAME = 'talkcalc-v3.1';

// Relative paths ('./x'), never root-absolute ('/x'). The app is served from
// https://<user>.github.io/easycalc/, so '/index.html' would resolve to the DOMAIN
// root and 404. Relative paths resolve against sw.js's own location, which is
// correct here and stays correct if the app ever moves to a domain root.
const SHELL = ['./', './index.html', './js/app.js', './js/iap.js', './js/panels.js'];
const ASSETS = [
  './css/styles.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const OFFLINE_URL = new URL('./index.html', self.location).href;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // Deliberately not cache.addAll(): addAll is all-or-nothing, so one 404
      // aborts the whole install and the worker never activates — which presents
      // as "offline mode is broken" with no obvious cause.
      .then(cache => Promise.all(
        SHELL.concat(ASSETS).map(url =>
          cache.add(url).catch(err => console.warn('[sw] precache miss:', url, err))
        )
      ))
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

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Stale-while-revalidate for everything.
  //
  // The previous network-first strategy cost ~580ms on every launch, because the
  // page waited for the network even when a perfectly good copy was already in the
  // cache. Here the cached copy is returned immediately and the network fetch runs
  // in the background to refresh the cache for NEXT launch.
  //
  // The trade-off: a deployed change reaches a device one launch later than it
  // used to. That is the deliberate price of a fast start.
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(req).then(cached => {
        const network = fetch(req)
          .then(res => {
            if (res && (res.ok || res.type === 'opaque')) {
              cache.put(req, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => null);

        // Cache hit: serve it now, let the refresh finish on its own time.
        if (cached) {
          event.waitUntil(network);
          return cached;
        }

        // Cache miss: nothing to serve but the network.
        return network.then(res => {
          if (res) return res;
          // Offline with no cached copy. Only navigations get the app shell —
          // handing index.html to a failed <script> would execute HTML as JS.
          if (req.mode === 'navigate') return cache.match(OFFLINE_URL);
          return Response.error();
        });
      })
    )
  );
});
