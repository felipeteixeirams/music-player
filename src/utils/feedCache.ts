import type { FeedResponse } from '../types/music';

export const FEED_CACHE_KEY = 'aurastream_feed_cache';

/** A saved home feed older than this is dropped: it would show music the catalog no longer features. */
export const FEED_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface SavedFeed {
  savedAt: number;
  feed: FeedResponse;
}

const isPage = (value: unknown): boolean => {
  const page = value as { tracks?: unknown; total?: unknown; nextIndex?: unknown } | null;
  return Boolean(
    page
    && Array.isArray(page.tracks)
    && typeof page.total === 'number'
    && (page.nextIndex === null || typeof page.nextIndex === 'number')
  );
};

/** The last feed saved on this device, or null when there is none, it is too old or it is not what we saved. */
export function loadSavedFeed(storage: Pick<Storage, 'getItem'>, now = Date.now()): SavedFeed | null {
  try {
    const parsed = JSON.parse(storage.getItem(FEED_CACHE_KEY) ?? 'null') as { savedAt?: unknown; feed?: unknown } | null;
    const feed = parsed?.feed as { categories?: unknown; featured?: unknown } | undefined;
    const categories = feed?.categories;
    if (typeof parsed?.savedAt !== 'number' || now - parsed.savedAt > FEED_MAX_AGE_MS || parsed.savedAt > now + 60_000) return null;
    if (!categories || typeof categories !== 'object' || !Object.values(categories).every(isPage)) return null;
    if (!Object.values(categories).some((page) => (page as { tracks: unknown[] }).tracks.length > 0)) return null;
    return { savedAt: parsed.savedAt, feed: { categories, featured: (feed.featured as FeedResponse['featured']) ?? null } as FeedResponse };
  } catch {
    return null;
  }
}

/** Saves the feed just fetched; storage that refuses (private mode, full) only means no saved copy next time. */
export function saveFeed(storage: Pick<Storage, 'setItem'>, feed: FeedResponse, now = Date.now()): void {
  try {
    storage.setItem(FEED_CACHE_KEY, JSON.stringify({ savedAt: now, feed } satisfies SavedFeed));
  } catch {
    // keep going
  }
}

/** "há instantes", "há 5 min", "há 3 h", "há 2 dias": how long ago something was saved. */
export function formatAge(savedAt: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - savedAt) / 60_000));
  if (minutes < 1) return 'há instantes';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}
