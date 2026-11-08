import { COVER_HOST_SUFFIXES } from './coverHosts';

/**
 * Covers normally load straight from the catalog's CDN. On a network that blocks that domain but not ours, they load
 * through `/api/media?kind=image` instead: the first covers that fail directly and load through the proxy switch the
 * whole device to the proxy (remembered), so nothing needs configuring.
 */

export const PROXIABLE_HOST_SUFFIXES: readonly string[] = COVER_HOST_SUFFIXES;

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

/** The sizes the catalog's cover CDN (Deezer) serves, in pixels: a list row takes the smallest one that still looks sharp. */
export const DEEZER_COVER_SIZES = [56, 120, 250, 500] as const;
const DEEZER_COVER_SIZE_IN_PATH = /\/(\d+)x\1-/;

/**
 * The same Deezer cover at another size, or undefined when the address is not a Deezer cover in the known form (Apple's
 * covers and anything else keep the one address they have).
 */
export function deezerCoverAtSize(value: string | undefined, size: number): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.dzcdn.net') || !DEEZER_COVER_SIZE_IN_PATH.test(url.pathname)) return undefined;
    url.pathname = url.pathname.replace(DEEZER_COVER_SIZE_IN_PATH, `/${size}x${size}-`);
    return url.toString();
  } catch {
    return undefined;
  }
}
