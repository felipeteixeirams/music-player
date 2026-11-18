/**
 * The cache limit chosen in Settings (MB). The page keeps it in localStorage; the service worker, which cannot read that,
 * is sent it on every start and whenever it changes (INV-PERF-05). Without a worker, nothing is sent and the worker's
 * default applies.
 */
export const CACHE_SIZE_KEY = 'aurastream_cache_limit_mb';
export const DEFAULT_CACHE_LIMIT_MB = 250;

export function savedCacheLimitMb(): number {
  try {
    const value = parseInt(localStorage.getItem(CACHE_SIZE_KEY) ?? '', 10);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_CACHE_LIMIT_MB;
  } catch {
    return DEFAULT_CACHE_LIMIT_MB;
  }
}

export function sendCacheLimitToWorker(mb: number = savedCacheLimitMb()): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // `ready` resolves with the active worker, which takes the message even before it controls this page
  void navigator.serviceWorker.ready
    .then((registration) => registration.active?.postMessage({ type: 'cache-limit', mb }))
    .catch(() => undefined);
}
