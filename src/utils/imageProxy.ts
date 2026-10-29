/**
 * Covers normally load straight from the catalog's CDN. On a network that blocks that domain but not ours, they load
 * through `/api/media?kind=image` instead: the first covers that fail directly and load through the proxy switch the
 * whole device to the proxy (remembered), so nothing needs configuring.
 */

/** The same list as `IMAGE_HOST_SUFFIXES` in `api/_mediaProxy.ts`; a test keeps them equal. */
export const PROXIABLE_HOST_SUFFIXES = ['.dzcdn.net', '.mzstatic.com'];

export const IMAGES_BLOCKED_KEY = 'aurastream_images_via_proxy';
/** Covers that failed directly and loaded through the proxy before the whole device is switched to it. */
export const RESCUES_TO_SWITCH = 2;

export function isProxiableImageUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && PROXIABLE_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

export const proxiedImageUrl = (value: string): string => `/api/media?kind=image&url=${encodeURIComponent(value)}`;

type Listener = () => void;
const listeners = new Set<Listener>();
const rescued = new Set<string>();
let viaProxy = readFlag();

function readFlag(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(IMAGES_BLOCKED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Whether covers go through the proxy on this device. */
export const imagesViaProxy = (): boolean => viaProxy;

export function subscribeImagesViaProxy(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A cover failed directly and loaded through the proxy: after a couple of them, the CDN is blocked here, not that one cover missing. */
export function recordRescuedImage(url: string): void {
  if (viaProxy) return;
  rescued.add(url);
  if (rescued.size < RESCUES_TO_SWITCH) return;
  viaProxy = true;
  try {
    localStorage.setItem(IMAGES_BLOCKED_KEY, '1');
  } catch {
    // storage refused: it lasts for this session
  }
  listeners.forEach((listener) => listener());
}

/** The address to load for a cover: the proxy's when this device is on it, otherwise the original. */
export function coverSrc(value: string | undefined): string | undefined {
  return viaProxy && isProxiableImageUrl(value) ? proxiedImageUrl(value) : value;
}
