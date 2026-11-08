// AuraStream Service Worker - Cache-first for static assets, network-first with cache fallback for streams
const CACHE_NAME = 'aurastream-v1';
// Covers have their own cache, so trimming them never evicts the app shell. Both are capped (oldest out first): an
// uncapped cache grows with every cover and every build the device ever saw (performance-audit, item A).
const COVER_CACHE_NAME = 'aurastream-covers-v1';
const COVER_CACHE_LIMIT = 400;
const SHELL_CACHE_LIMIT = 120;
const KEPT_CACHES = [CACHE_NAME, COVER_CACHE_NAME];

async function trimCache(cache, limit) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
}
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!KEPT_CACHES.includes(key)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Do not cache audio streams or range requests to avoid breaking audio playback
  if (
    event.request.headers.get('range') ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.ogg') ||
    url.pathname.endsWith('.webm') ||
    url.pathname.includes('/streams/') ||
    url.pathname === '/version.json' ||
    url.hostname.includes('googlevideo') ||
    url.hostname.includes('youtube')
  ) {
    return;
  }

  // Cache covers and images (CacheFirst strategy)
  if (url.pathname.match(/\.(jpg|jpeg|png|svg|webp|gif)$/) || url.hostname.includes('wikimedia') || (url.pathname === '/api/media' && url.searchParams.get('kind') === 'image')) {
    event.respondWith(
      caches.open(COVER_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response && response.status === 200) {
            cache.put(event.request, response.clone()).then(() => trimCache(cache, COVER_CACHE_LIMIT)).catch(() => {});
          }
          return response;
        } catch (err) {
          return cached || new Response('Asset unavailable offline', { status: 503 });
        }
      })
    );
    return;
  }

  // Network-first strategy with cache fallback for app shell
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone).then(() => trimCache(cache, SHELL_CACHE_LIMIT))).catch(() => {});
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
