// Bump this on EVERY release. With a cache-first strategy an unchanged name means
// users keep the old files forever — and worse, index.html and app.js can be served
// from different generations, producing a mismatched pair that throws at load.
const CACHE_NAME = 'talkcalc-v3.1';

// IMPORTANT: every path here is RELATIVE ('./x'), not root-absolute ('/x').
// This site is served from https://<user>.github.io/easycalc/, so '/index.html'
// resolves to the DOMAIN root and 404s. Relative paths resolve against the
// location of sw.js, which is the correct project directory on GitHub Pages
// and still correct if the app is ever moved to a custom domain root.
const SHELL = ['./', './index.html', './js/app.js', './js/iap.js'];
const ASSETS = ['./manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

// Absolute URL of the offline fallback document, resolved once.
const OFFLINE_URL = new URL('./index.html', self.location).href;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // Deliberately NOT cache.addAll(): addAll is all-or-nothing, so a single
      // 404 (a renamed icon, say) aborts the whole install and the worker never
      // activates — which looks exactly like "offline mode is broken".
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
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => { });
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(r => {
            if (r) return r;
            // Only fall back to the app shell for navigations. Handing index.html
            // to a failed <script> request would execute HTML as JS.
            if (req.mode === 'navigate') return caches.match(OFFLINE_URL);
            return Response.error();
          })
        )
    );
    return;
  }

  // Cache-first is correct for icons, the manifest, and the web font: they rarely
  // change and the network round-trip would just slow down first paint. Cross-origin
  // responses (Google Fonts) come back opaque, which is fine to store and replay.
  event.respondWith(
    caches.match(req).then(res =>
      res || fetch(req).then(net => {
        if (net && (net.ok || net.type === 'opaque')) {
          const copy = net.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => { });
        }
        return net;
      })
    ).catch(() => Response.error())
  );
});
