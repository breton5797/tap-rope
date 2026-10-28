/* TAP ROPE offline service worker. Generated at build time: the cache version and precache list
 * are filled in by the tap-rope-sw Vite plugin, so every deploy installs a fresh worker and cache. */
const PREFIX = __CACHE_PREFIX__;
const CACHE = `${PREFIX}__VERSION__`;
const PRECACHE = __PRECACHE__;
/** sub-apps in this scope that run their own worker (v8: the office build at ./office/) are never handled here */
const SKIP = __SKIP__.map((p) => new URL(p, self.registration.scope).pathname);
// Vite tags assets crossorigin; servers answer with "Vary: Origin", which would make precached entries miss
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // only this build's older caches: another build on the same origin keeps its own
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function cacheIfOk(req, res) {
  if (res.ok && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE).then((cache) => cache.put(req, copy));
  }
  return res;
}

/** Pages: network-first so a new deploy is picked up immediately; cached shell when offline. */
function networkFirst(req, fallbackUrl) {
  return fetch(req)
    .then((res) => cacheIfOk(req, res))
    .catch(() => caches.match(req, MATCH).then((hit) => hit || caches.match(fallbackUrl, MATCH)));
}

/** Hashed build assets never change under the same URL: cache-first. */
function cacheFirst(req) {
  return caches.match(req, MATCH).then((hit) => hit || fetch(req).then((res) => cacheIfOk(req, res)));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (SKIP.some((p) => url.pathname.startsWith(p))) return; // network / the sub-app's own worker
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, './index.html'));
  } else if (url.pathname.includes('/assets/') || url.pathname.includes('/art/') || url.pathname.includes('/fonts/')) {
    // art and fonts keep their names, but the cache name hashes their bytes, so a deploy swaps them atomically
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(networkFirst(req, req.url));
  }
});
