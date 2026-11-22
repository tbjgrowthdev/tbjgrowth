/* TBJ Growth Tech service worker.
 *
 * Hard rule: /admin, /login, /api and /portal are never cached or intercepted, and
 * neither is any non-GET or cross-origin request. Admin pages must never be
 * readable from Cache Storage after logout. Everything else:
 *   - "static" (build assets, images, fonts): cache-first
 *   - "page"   (public HTML): network-first, cached copy, then /offline.html
 *
 * Bump CACHE_VERSION to drop every old cache on the next activation.
 * tests/sw-cache-policy.test.ts loads this file directly.
 */
const CACHE_VERSION = "tbj-v2";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];
const PRIVATE_PREFIXES = ["/admin", "/login", "/api", "/portal"];
const STATIC_EXT = /\.(?:js|css|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf)$/i;

function isUnder(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

function cachePolicy(url, method, origin) {
  if (method !== "GET") return "bypass";
  if (url.origin !== origin) return "bypass";
  if (PRIVATE_PREFIXES.some((p) => isUnder(url.pathname, p))) return "bypass";
  if (url.pathname.startsWith("/_next/static/") || STATIC_EXT.test(url.pathname)) return "static";
  return "page";
}
self.__cachePolicy = cachePolicy;

// A response is only stored if it is a plain same-origin 200 that the server
// did not mark private and that does not set a cookie.
function isCacheable(response) {
  if (!response || !response.ok || response.type !== "basic") return false;
  const cc = (response.headers.get("Cache-Control") || "").toLowerCase();
  if (cc.includes("no-store") || cc.includes("private")) return false;
  if (response.headers.get("Set-Cookie")) return false;
  return true;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (isCacheable(response)) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (request.mode === "navigate") {
      const offline = await cache.match(OFFLINE_URL);
      if (offline) return offline;
    }
    throw error;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const policy = cachePolicy(new URL(request.url), request.method, self.location.origin);
  if (policy === "bypass") return;
  event.respondWith(policy === "static" ? cacheFirst(request) : networkFirst(request));
});
