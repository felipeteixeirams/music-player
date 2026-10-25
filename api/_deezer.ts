import type { Track } from '../src/types/music';

const DEEZER_API = 'https://api.deezer.com';
const FALLBACK_COVER = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500';
const REQUEST_TIMEOUT_MS = 4000;

export const DEEZER_GENRES = { rock: 152, pop: 132 } as const;

type FetchLike = typeof fetch;

export interface DeezerListOptions {
  style?: string;
  limit?: number;
  requirePreview?: boolean;
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
    if (options.requirePreview && !track.sources.previewUrl) continue;
    seen.add(track.id);
    tracks.push(track);
    if (tracks.length >= (options.limit ?? 15)) break;
  }
  return tracks;
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

export async function searchDeezerTracks(query: string, options: DeezerListOptions = {}): Promise<Track[]> {
  // Pede mais itens que o limite para que faixas sem preview descartadas não esvaziem o resultado.
  const payload = await requestDeezer(
    `/search?q=${encodeURIComponent(query)}&limit=${(options.limit ?? 15) * 2}`,
    options.fetchImpl
  );
  return mapDeezerTracks(payload, options);
}

export async function fetchDeezerChart(genreId: number, options: DeezerListOptions = {}): Promise<Track[]> {
  const payload = await requestDeezer(
    `/chart/${genreId}/tracks?limit=${(options.limit ?? 15) * 2}`,
    options.fetchImpl
  );
  return mapDeezerTracks(payload, options);
}

export interface DeezerFeed {
  trending: Track[];
  rock: Track[];
  pop: Track[];
  lofi: Track[];
  featured: Track | null;
}

export async function buildDeezerFeed(fetchImpl?: FetchLike): Promise<DeezerFeed> {
  const base = { requirePreview: true, fetchImpl };
  const startTime = Date.now();
  const failed: string[] = [];
  const guarded = (name: string, request: Promise<Track[]>) =>
    request.catch((err: unknown): Track[] => {
      failed.push(name);
      console.warn(`[Feed] ⚠️ Categoria "${name}" falhou: ${(err as Error)?.message || err}`);
      return [];
    });

  const [trending, rock, pop, lofi] = await Promise.all([
    guarded('trending', fetchDeezerChart(0, { ...base, style: 'Top Hits' })),
    guarded('rock', fetchDeezerChart(DEEZER_GENRES.rock, { ...base, style: 'Rock' })),
    guarded('pop', fetchDeezerChart(DEEZER_GENRES.pop, { ...base, style: 'Pop' })),
    guarded('lofi', searchDeezerTracks('lofi chill beats', { ...base, style: 'Lofi Chill' }))
  ]);

  console.log(
    `[Feed] ${failed.length > 0 ? '⚠️' : '✅'} trending=${trending.length} rock=${rock.length} pop=${pop.length} lofi=${lofi.length} em ${Date.now() - startTime}ms`
  );
  return { trending, rock, pop, lofi, featured: trending[0] ?? rock[0] ?? null };
}
