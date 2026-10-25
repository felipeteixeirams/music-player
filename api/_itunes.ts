import type { Track } from '../src/types/music';

const ITUNES_SEARCH = 'https://itunes.apple.com/search';
const FALLBACK_COVER = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500';
const REQUEST_TIMEOUT_MS = 4000;

type FetchLike = typeof fetch;

export interface ItunesListOptions {
  style?: string;
  limit?: number;
  fetchImpl?: FetchLike;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asHttpsUrl(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  try {
    return new URL(text).protocol === 'https:' ? text : null;
  } catch {
    return null;
  }
}

/** iTunes serves artwork at the size named in the URL; ask for a larger one. */
function largeArtwork(url: string | null): string {
  return url ? url.replace(/\/\d+x\d+bb\./, '/600x600bb.') : FALLBACK_COVER;
}

export function mapItunesTrack(input: unknown, style = 'Apple Music'): Track | null {
  const item = asRecord(input);
  if (!item || item.wrapperType !== 'track' || item.kind !== 'song') return null;

  const rawId = typeof item.trackId === 'number' || typeof item.trackId === 'string' ? String(item.trackId) : '';
  if (!/^\d+$/.test(rawId)) return null;

  const title = asText(item.trackName);
  const artist = asText(item.artistName);
  const millis = item.trackTimeMillis;
  if (!title || !artist) return null;
  if (typeof millis !== 'number' || !Number.isFinite(millis) || millis <= 0) return null;

  const previewUrl = asHttpsUrl(item.previewUrl);
  return {
    id: `itunes-${rawId}`,
    title,
    artist,
    album: asText(item.collectionName) ?? 'Single',
    duration: Math.round(millis / 1000),
    coverUrl: largeArtwork(asHttpsUrl(item.artworkUrl100)),
    style,
    categoryId: 'web',
    sources: previewUrl ? { localUrl: '', previewUrl } : { localUrl: '' }
  };
}

export function mapItunesTracks(payload: unknown, options: ItunesListOptions = {}): Track[] {
  const results = asRecord(payload)?.results;
  if (!Array.isArray(results)) return [];

  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const entry of results) {
    const track = mapItunesTrack(entry, options.style);
    if (!track || seen.has(track.id)) continue;
    seen.add(track.id);
    tracks.push(track);
    if (tracks.length >= (options.limit ?? 15)) break;
  }
  return tracks;
}

export async function searchItunesTracks(query: string, options: ItunesListOptions = {}): Promise<Track[]> {
  const params = new URLSearchParams({
    term: query,
    media: 'music',
    entity: 'song',
    limit: String((options.limit ?? 15) * 2)
  });
  const response = await (options.fetchImpl ?? fetch)(`${ITUNES_SEARCH}?${params}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`iTunes HTTP ${response.status}`);
  return mapItunesTracks(await response.json(), options);
}
