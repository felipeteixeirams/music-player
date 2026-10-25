/**
 * Where each home category gets its tracks: a curated Deezer playlist whose content matches what the
 * category promises (names and descriptions live in src/data/musicCatalog.ts). Editorial playlists can be
 * removed or renamed by Deezer; the live smoke test checks that each one still exists and has tracks.
 */
export const CATEGORY_PLAYLISTS = {
  // "Top Brazil" by Deezer Charts: the most played tracks in Brazil
  'top-hits': { playlistId: 1111141961, style: 'Top Brasil' },
  // "Rock Essentials" by Deezer Rock: AC/DC, Pink Floyd, David Bowie, The Beatles...
  'classic-rock': { playlistId: 1306931615, style: 'Classic Rock' },
  // "New Alternative" by Deezer Alternative: current indie and alternative
  'alternative-pop': { playlistId: 1402845615, style: 'Alternative & Indie' },
  // "study lofi" by Deezer Mood: lo-fi beats for focus
  'lofi-chill': { playlistId: 8749345882, style: 'Lofi Chill' },
  // "Synthwave" by Deezer Dance
  'synthwave': { playlistId: 5896949744, style: 'Synthwave' }
} as const;

export type CategoryId = keyof typeof CATEGORY_PLAYLISTS;

export const CATEGORY_IDS = Object.keys(CATEGORY_PLAYLISTS) as CategoryId[];

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_PLAYLISTS, value);
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
/** Deezer pages never go this deep for our lists; a larger `index` only fishes for requests the cache has not seen. */
export const MAX_PAGE_INDEX = 5000;

/** Reads `index` and `limit` from a query string: non-negative integers, limit clamped to 1..MAX_PAGE_SIZE. */
export function readPageParams(raw: { index?: unknown; limit?: unknown }): { index: number; limit: number } {
  const toInt = (value: unknown, fallback: number) => {
    const text = Array.isArray(value) ? value[0] : value;
    const n = typeof text === 'string' && /^\d+$/.test(text) ? Number(text) : NaN;
    return Number.isSafeInteger(n) ? n : fallback;
  };
  return {
    index: Math.min(MAX_PAGE_INDEX, toInt(raw.index, 0)),
    limit: Math.min(MAX_PAGE_SIZE, Math.max(1, toInt(raw.limit, DEFAULT_PAGE_SIZE)))
  };
}
