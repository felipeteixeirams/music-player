import type { FeedResponse, Track, TrackPage } from '../src/types/music';
import { CATEGORY_IDS, CATEGORY_PLAYLISTS, type CategoryId } from './_categories.js';

const DEEZER_API = 'https://api.deezer.com';
const FALLBACK_COVER = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500';
const REQUEST_TIMEOUT_MS = 4000;

type FetchLike = typeof fetch;

export interface DeezerListOptions {
  style?: string;
  fetchImpl?: FetchLike;
}

export interface DeezerPageOptions extends DeezerListOptions {
  index?: number;
  limit?: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asHttpUrl(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function mapDeezerTrack(input: unknown, style = 'Deezer'): Track | null {
  const item = asRecord(input);
  if (!item) return null;

  const rawId = typeof item.id === 'number' || typeof item.id === 'string' ? String(item.id) : '';
  if (!/^\d+$/.test(rawId)) return null;

  const title = asText(item.title_short) ?? asText(item.title);
  const artist = asText(asRecord(item.artist)?.name);
  const duration = item.duration;
  if (!title || !artist) return null;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return null;

  const album = asRecord(item.album);
  const previewUrl = asHttpUrl(item.preview);

  return {
    id: `deezer-${rawId}`,
    title,
    artist,
    album: asText(album?.title) ?? 'Single',
    duration: Math.round(duration),
    coverUrl: asHttpUrl(album?.cover_big) ?? asHttpUrl(album?.cover_medium) ?? FALLBACK_COVER,
    style,
    categoryId: 'web',
    sources: previewUrl ? { localUrl: '', previewUrl } : { localUrl: '' }
  };
}

export function mapDeezerTracks(payload: unknown, options: DeezerListOptions = {}): Track[] {
  const data = asRecord(payload)?.data;
  if (!Array.isArray(data)) return [];

  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const entry of data) {
    const track = mapDeezerTrack(entry, options.style);
    if (!track || seen.has(track.id)) continue;
    seen.add(track.id);
    tracks.push(track);
  }
  return tracks;
}

/**
 * A page of tracks plus where the next one starts. `nextIndex` counts the items Deezer returned, not the
 * ones that mapped to a track, so a dropped or duplicated item never shifts the following page.
 */
export function mapDeezerPage(payload: unknown, options: DeezerPageOptions = {}): TrackPage {
  const index = options.index ?? 0;
  const record = asRecord(payload);
  const received = Array.isArray(record?.data) ? record.data.length : 0;
  const reportedTotal = record?.total;
  const total = typeof reportedTotal === 'number' && Number.isFinite(reportedTotal) && reportedTotal >= 0
    ? reportedTotal
    : index + received;
  const consumed = index + received;
  return {
    tracks: mapDeezerTracks(payload, options),
    total,
    nextIndex: received > 0 && consumed < total ? consumed : null
  };
}

async function requestDeezer(path: string, fetchImpl: FetchLike = fetch): Promise<unknown> {
  const response = await fetchImpl(`${DEEZER_API}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`Deezer HTTP ${response.status}`);

  const payload: unknown = await response.json();
  const apiError = asRecord(asRecord(payload)?.error);
  if (apiError) throw new Error(`Deezer API: ${asText(apiError.message) ?? 'erro desconhecido'}`);
  return payload;
}

export async function searchDeezerPage(query: string, options: DeezerPageOptions = {}): Promise<TrackPage> {
  const index = options.index ?? 0;
  const payload = await requestDeezer(
    `/search?q=${encodeURIComponent(query)}&index=${index}&limit=${options.limit ?? 20}`,
    options.fetchImpl
  );
  return mapDeezerPage(payload, { ...options, index });
}

export async function searchDeezerTracks(query: string, options: DeezerPageOptions = {}): Promise<Track[]> {
  return (await searchDeezerPage(query, options)).tracks;
}

export async function fetchDeezerPlaylistPage(playlistId: number, options: DeezerPageOptions = {}): Promise<TrackPage> {
  const index = options.index ?? 0;
  const payload = await requestDeezer(
    `/playlist/${playlistId}/tracks?index=${index}&limit=${options.limit ?? 20}`,
    options.fetchImpl
  );
  return mapDeezerPage(payload, { ...options, index });
}

/** A page of one home category, read from the playlist that backs it. */
export async function fetchCategoryPage(
  categoryId: CategoryId,
  options: Pick<DeezerPageOptions, 'index' | 'limit' | 'fetchImpl'> = {}
): Promise<TrackPage> {
  const { playlistId, style } = CATEGORY_PLAYLISTS[categoryId];
  return fetchDeezerPlaylistPage(playlistId, { ...options, style });
}

const FEED_PAGE_SIZE = 15;

export async function buildDeezerFeed(fetchImpl?: FetchLike): Promise<FeedResponse> {
  const startTime = Date.now();
  const failed: string[] = [];
  const empty: TrackPage = { tracks: [], total: 0, nextIndex: null };

  const pages = await Promise.all(
    CATEGORY_IDS.map((id) =>
      fetchCategoryPage(id, { index: 0, limit: FEED_PAGE_SIZE, fetchImpl }).catch((err: unknown): TrackPage => {
        failed.push(id);
        console.warn(`[Feed] ⚠️ Categoria "${id}" falhou: ${(err as Error)?.message || err}`);
        return empty;
      })
    )
  );

  const categories = Object.fromEntries(CATEGORY_IDS.map((id, i) => [id, pages[i]]));
  console.log(
    `[Feed] ${failed.length > 0 ? '⚠️' : '✅'} ${CATEGORY_IDS.map((id, i) => `${id}=${pages[i].tracks.length}`).join(' ')} em ${Date.now() - startTime}ms`
  );
  return { categories, featured: categories['top-hits'].tracks[0] ?? null };
}
