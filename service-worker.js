/*
 * myAlternates service worker
 * Strategy:
 *   - precache the app shell (HTML pages + CSS/JS + icons + offline page)
 *   - navigations: network-first, fall back to cache, then offline.html
 *   - same-origin static assets: stale-while-revalidate
 *   - Google Fonts: stale-while-revalidate in a dedicated cache
 *   - everything else (cross-origin APIs, form POSTs): left untouched
 *
 * Bump CACHE_VERSION whenever precached files change so old caches are purged.
 */
const CACHE_VERSION = 'v11';
const PRECACHE = `precache-${CACHE_VERSION}`;
const RUNTIME = `runtime-${CACHE_VERSION}`;
const FONTS = `fonts-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './about.html',
  './pms.html',
  './pms-fees.html',
  './aif.html',
  './mf.html',
  './sif.html',
  './gift-city.html',
  './cagr.html',
  './sip.html',
  './xirr.html',
  './offline.html',
  './assets/site.css',
  './assets/lead-form.js',
  './assets/product-metrics.js',
  './assets/logo-myalternates.png',
  './assets/logo-pmsbazaar.png',
  './assets/logo-foot.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png',
  './assets/icons/favicon-16.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE)
      // addAll is atomic; a single 404 fails the whole install, so add individually
      .then((cache) => Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([PRECACHE, RUNTIME, FONTS]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isFontRequest(url) {
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  return cached || network || fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navigations: network-first with cache + offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () =>
          (await caches.match(request)) ||
          (await caches.match('./index.html')) ||
          caches.match('./offline.html')
        )
    );
    return;
  }

  // Google Fonts
  if (isFontRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, FONTS));
    return;
  }

  // Same-origin static assets
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
    return;
  }

  // Cross-origin (APIs, webhooks): don't intercept
});
