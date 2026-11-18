// AuraStream Service Worker - Cache-first for static assets, network-first with cache fallback for streams
const CACHE_NAME = 'aurastream-v1';
// Covers have their own cache, so trimming them never evicts the app shell. Both are capped (oldest out first): an
// uncapped cache grows with every cover and every build the device ever saw (performance-audit, item A).
const COVER_CACHE_NAME = 'aurastream-covers-v1';
// Covers are capped by size (the limit chosen in Settings, sent by the page; 250 MB until it is) and by a count
// safety net. A cross-origin image answers without its size, so it is counted as this estimate.
const COVER_BUDGET_DEFAULT_BYTES = 250 * 1024 * 1024;
const COVER_ENTRY_LIMIT = 2000;
const OPAQUE_COVER_BYTES = 40 * 1024;
let coverBudgetBytes = COVER_BUDGET_DEFAULT_BYTES;
const SHELL_CACHE_LIMIT = 120;
const KEPT_CACHES = [CACHE_NAME, COVER_CACHE_NAME, 'aurastream-order-v1'];

// The order each capped cache was written in. The Cache API lists entries in no reliable order, so the order is kept
// here (one list per cache, in its own cache): the oldest entries are the ones that go.
const ORDER_CACHE_NAME = 'aurastream-order-v1';

// Each entry of the order is { url, bytes }. Lists written before the sizes were kept carry only the address.
async function readOrder(cacheName, cache) {
  const order = await caches.open(ORDER_CACHE_NAME);
  const saved = await order.match(`/__order__/${cacheName}`);
  if (saved) {
    const list = await saved.json();
    return list.map((entry) => (typeof entry === 'string' ? { url: entry, bytes: OPAQUE_COVER_BYTES } : entry));
  }
  // Written before the order was kept: the entries already there count as the oldest
  return (await cache.keys()).map((request) => ({ url: request.url, bytes: OPAQUE_COVER_BYTES }));
}

async function writeOrder(cacheName, list) {
  const order = await caches.open(ORDER_CACHE_NAME);
  await order.put(`/__order__/${cacheName}`, new Response(JSON.stringify(list)));
}

// Stores an answer and keeps the cache within its limits: at most `limit` entries and, when given, at most `budgetBytes`
// (the oldest go first). One write at a time: when several covers arrive together, a trim that ran between the others'
// writes would count too few entries and leave the cache over its limit.
let writes = Promise.resolve();
function answerBytes(response) {
  const length = Number(response.headers.get('content-length'));
  return Number.isFinite(length) && length > 0 ? length : OPAQUE_COVER_BYTES;
}
function putAndTrim(cacheName, request, response, limit, budgetBytes) {
  const bytes = answerBytes(response);
  const write = writes.then(async () => {
    const cache = await caches.open(cacheName);
    const order = (await readOrder(cacheName, cache)).filter((entry) => entry.url !== request.url);
    order.push({ url: request.url, bytes });
    await cache.put(request, response);
    const oldest = [];
    while (order.length > limit) oldest.push(order.shift());
    if (budgetBytes) {
      let total = order.reduce((sum, entry) => sum + entry.bytes, 0);
      while (order.length > 1 && total > budgetBytes) {
        const gone = order.shift();
        total -= gone.bytes;
        oldest.push(gone);
      }
    }
    await Promise.all(oldest.map((entry) => cache.delete(entry.url)));
    await writeOrder(cacheName, order);
  });
  writes = write.catch(() => {});
  return write;
}
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// The page tells the worker the limit chosen in Settings (MB). The worker cannot read the page's storage, and it starts
// again with the default when the browser restarts it, so the page sends it on every start.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  const mb = Number(data.mb);
  if (data.type === 'cache-limit' && Number.isFinite(mb) && mb > 0) coverBudgetBytes = mb * 1024 * 1024;
});

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
    // The historic catalog is read once per search and is in the page's own files: it must not push the app shell out of the cache
    url.pathname.startsWith('/historic/') ||
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
            // waitUntil keeps the write going after the answer is sent, so the answer is not delayed
            event.waitUntil(putAndTrim(COVER_CACHE_NAME, event.request, response.clone(), COVER_ENTRY_LIMIT, coverBudgetBytes).catch(() => {}));
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
          event.waitUntil(putAndTrim(CACHE_NAME, event.request, clone, SHELL_CACHE_LIMIT).catch(() => {}));
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
