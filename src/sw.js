/**
 * Service worker source. Not bundled by vite — `scripts/pwa-plugin.mjs` reads
 * this file at build time and substitutes the two placeholders below with the
 * real precache list and a content-derived version, emitting `dist/sw.js`.
 *
 * Strategy: the whole game is a handful of hashed files, so precache all of it
 * and serve cache-first. A run then starts instantly and works with no network
 * at all — the point of shipping this as a PWA. A new build lands under a new
 * cache name and only takes over once the page asks it to (see src/pwa.ts), so
 * an update can never swap assets out from under a run in progress.
 */

const VERSION = "__CACHE_VERSION__";
const CACHE = `standstill-${VERSION}`;

/** Every URL the app needs offline. First entry is the app shell. */
const PRECACHE = __PRECACHE__;
const SHELL = PRECACHE[0];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // cache: "reload" so a stale HTTP cache can't seed the precache.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" })))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("standstill-") && n !== CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/** The page sends this when it reaches a moment where a reload is harmless. */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(caches.match(SHELL).then((hit) => hit ?? fetch(req)));
    return;
  }
  event.respondWith(cacheFirst(req));
});

/**
 * Cache-first. Safe because every asset filename is content-hashed: a changed
 * file is a changed URL, and the old cache is dropped wholesale on activate.
 */
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  } catch (err) {
    const shell = await cache.match(SHELL);
    if (shell && req.destination === "document") return shell;
    throw err;
  }
}
