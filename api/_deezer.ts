import type { AlbumPage, AlbumSummary, ArtistPage, ArtistSummary, FeedResponse, RadioGenre, Track, TrackPage } from '../src/types/music';
import { CATEGORY_IDS, CATEGORY_PLAYLISTS, type CategoryId } from './_categories.js';
import { RADIO_GENRES, type RadioStationConfig } from './_radios.js';

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

export function mapDeezerArtist(input: unknown): ArtistSummary | null {
  const item = asRecord(input);
  if (!item) return null;
  const rawId = typeof item.id === 'number' || typeof item.id === 'string' ? String(item.id) : '';
  const name = asText(item.name);
  if (!/^\d+$/.test(rawId) || !name) return null;
  const fans = item.nb_fan;
  return {
    id: rawId,
    name,
    pictureUrl: asHttpUrl(item.picture_big) ?? asHttpUrl(item.picture_medium) ?? asHttpUrl(item.picture_xl) ?? FALLBACK_COVER,
    fans: typeof fans === 'number' && Number.isFinite(fans) && fans > 0 ? Math.round(fans) : 0
  };
}

/** The artists whose name matches the text, best first (Deezer orders by relevance). */
export async function searchDeezerArtists(query: string, limit = 3, fetchImpl?: FetchLike): Promise<ArtistSummary[]> {
  const payload = await requestDeezer(`/search/artist?q=${encodeURIComponent(query)}&limit=${limit}`, fetchImpl);
  const data = asRecord(payload)?.data;
  if (!Array.isArray(data)) return [];
  return data.map(mapDeezerArtist).filter((artist): artist is ArtistSummary => artist !== null);
}

export async function searchDeezerAlbums(query: string, limit = 8, fetchImpl?: FetchLike): Promise<AlbumSummary[]> {
  const payload = await requestDeezer(`/search/album?q=${encodeURIComponent(query)}&limit=${limit}`, fetchImpl);
  const data = asRecord(payload)?.data;
  if (!Array.isArray(data)) return [];
  return data.map((entry) => mapDeezerAlbum(entry)).filter((album): album is AlbumSummary => album !== null);
}

export function mapDeezerAlbum(input: unknown, fallbackArtist = ''): AlbumSummary | null {
  const item = asRecord(input);
  if (!item) return null;
  const rawId = typeof item.id === 'number' || typeof item.id === 'string' ? String(item.id) : '';
  const title = asText(item.title);
  if (!/^\d+$/.test(rawId) || !title) return null;
  const year = Number.parseInt(typeof item.release_date === 'string' ? item.release_date.slice(0, 4) : '', 10);
  return {
    id: rawId,
    title,
    coverUrl: asHttpUrl(item.cover_big) ?? asHttpUrl(item.cover_medium) ?? FALLBACK_COVER,
    year: Number.isFinite(year) && year > 1900 ? year : 0,
    artist: asText(asRecord(item.artist)?.name) ?? fallbackArtist
  };
}

/** Artists similar to this one, most similar first. */
export async function fetchRelatedArtists(artistId: string, fetchImpl?: FetchLike): Promise<ArtistSummary[]> {
  const payload = await requestDeezer(`/artist/${artistId}/related?limit=12`, fetchImpl);
  const data = asRecord(payload)?.data;
  if (!Array.isArray(data)) return [];
  return data.map(mapDeezerArtist).filter((artist): artist is ArtistSummary => artist !== null);
}

/** The artist's albums, newest first, one row per title (Deezer lists editions apart). */
export async function fetchArtistAlbums(artistId: string, artistName: string, fetchImpl?: FetchLike): Promise<AlbumSummary[]> {
  const payload = await requestDeezer(`/artist/${artistId}/albums?limit=100`, fetchImpl);
  const data = asRecord(payload)?.data;
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const albums: AlbumSummary[] = [];
  for (const entry of data) {
    const album = mapDeezerAlbum(entry, artistName);
    const key = album?.title.toLowerCase();
    if (!album || !key || seen.has(key)) continue;
    seen.add(key);
    albums.push(album);
  }
  return albums.sort((a, b) => b.year - a.year);
}

/** The album and its tracks in album order. */
export async function fetchAlbumPage(albumId: string, fetchImpl?: FetchLike): Promise<AlbumPage> {
  const payload = await requestDeezer(`/album/${albumId}`, fetchImpl);
  const record = asRecord(payload);
  const album = mapDeezerAlbum(record, asText(asRecord(record?.artist)?.name) ?? '');
  if (!album) throw new Error('Álbum não encontrado');
  const raw = asRecord(record?.tracks)?.data;
  // The album's own track list leaves out the album and sometimes the artist: put them back before mapping
  const items = (Array.isArray(raw) ? raw : []).map((entry) => {
    const item = asRecord(entry) ?? {};
    return {
      ...item,
      album: item.album ?? { title: album.title, cover_big: album.coverUrl },
      artist: item.artist ?? { name: album.artist }
    };
  });
  const tracks = mapDeezerTracks({ data: items }, { style: album.artist });
  return { album, tracks: { tracks, total: tracks.length, nextIndex: null } };
}

/** The artist and a page of their most played tracks. */
export async function fetchArtistPage(artistId: string, options: DeezerPageOptions = {}): Promise<ArtistPage> {
  const index = options.index ?? 0;
  const [info, top] = await Promise.all([
    requestDeezer(`/artist/${artistId}`, options.fetchImpl),
    requestDeezer(`/artist/${artistId}/top?index=${index}&limit=${options.limit ?? 20}`, options.fetchImpl)
  ]);
  const artist = mapDeezerArtist(info);
  if (!artist) throw new Error('Artista não encontrado');
  // Albums are an extra: the page still opens with the top tracks when they fail
  const [albums, related] = await Promise.all([
    fetchArtistAlbums(artistId, artist.name, options.fetchImpl).catch((): AlbumSummary[] => []),
    fetchRelatedArtists(artistId, options.fetchImpl).catch((): ArtistSummary[] => [])
  ]);
  return { artist, top: mapDeezerPage(top, { ...options, index, style: artist.name }), albums, related };
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

/**
 * Our curated stations (see api/_radios.ts) with the covers Deezer's `/radio/genres` lists. A station Deezer no
 * longer lists is left out, and a genre left with no station disappears.
 */
export function mapRadioGenres(payload: unknown): RadioGenre[] {
  // station id -> cover (null when Deezer lists the station without one)
  const listed = new Map<number, string | null>();
  const genres = asRecord(payload)?.data;
  for (const genre of Array.isArray(genres) ? genres : []) {
    const radios = asRecord(genre)?.radios;
    for (const radio of Array.isArray(radios) ? radios : []) {
      const record = asRecord(radio);
      if (typeof record?.id !== 'number') continue;
      listed.set(record.id, asHttpUrl(record.picture_medium) ?? asHttpUrl(record.picture));
    }
  }

  return RADIO_GENRES
    .map((genre) => ({
      id: genre.id,
      name: genre.name,
      stations: genre.stations
        .filter((station) => listed.has(station.id))
        .map((station) => ({ id: station.id, name: station.name, picture: listed.get(station.id) ?? null }))
    }))
    .filter((genre) => genre.stations.length > 0);
}

export async function fetchRadioGenres(fetchImpl?: FetchLike): Promise<RadioGenre[]> {
  return mapRadioGenres(await requestDeezer('/radio/genres', fetchImpl));
}

/**
 * A batch of tracks from a station. Deezer answers 40 tracks drawn in random order from a fixed pool of
 * 50 to 120, never paginates, and answers differently on every call: asking again is how a radio goes on.
 */
export async function fetchRadioTracks(station: RadioStationConfig, fetchImpl?: FetchLike): Promise<TrackPage> {
  const payload = await requestDeezer(`/radio/${station.id}/tracks?limit=40`, fetchImpl);
  const tracks = mapDeezerTracks(payload, { style: station.name });
  return { tracks, total: tracks.length, nextIndex: null };
}

/**
 * A fresh preview address of a track. Deezer's preview links carry a signature that expires in about 15 minutes,
 * while lists are kept (by the CDN and by the phone) for hours: the player asks for a new one when it is about to
 * use an old one. Null when the track has none.
 */
export async function fetchDeezerPreviewUrl(trackId: number, fetchImpl?: FetchLike): Promise<string | null> {
  const payload = await requestDeezer(`/track/${trackId}`, fetchImpl);
  return mapDeezerTrack(payload)?.sources.previewUrl ?? null;
}
