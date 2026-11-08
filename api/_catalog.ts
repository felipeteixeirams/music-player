import type { AlbumSummary, TrackPage } from '../src/types/music';
import { searchDeezerAlbums, searchDeezerPage, searchDeezerPlaylists } from './_deezer.js';
import { searchItunesAlbums, searchItunesTracks } from './_itunes.js';

export type CatalogProvider = 'deezer' | 'itunes';

export interface CatalogSearchResult extends TrackPage {
  source: CatalogProvider;
  albums?: AlbumSummary[];
}

type FetchLike = typeof fetch;

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const MAX_ALBUMS = 12;

/** iTunes answers a search with loose matches too (a K-Pop soundtrack for "Classic Metal Som Livre"): keep the albums that share a word with the text. */
export function relevantToQuery(query: string, albums: AlbumSummary[]): AlbumSummary[] {
  const words = normalize(query).split(' ').filter((word) => word.length >= 3);
  if (words.length === 0) return albums;
  return albums.filter((album) => {
    const haystack = ` ${normalize(`${album.title} ${album.artist}`)} `;
    return words.some((word) => haystack.includes(` ${word} `) || haystack.includes(` ${word}`));
  });
}

/**
 * Albums from Deezer and from iTunes in one list, then the playlists (`kind: 'playlist'`). An album whose title holds
 * the whole search text goes first, those from iTunes before Deezer's (a DJ's single can carry the exact same title); the same title and artist from the two sources appears once (Deezer's).
 */
export function mergeAlbumResults(query: string, deezer: AlbumSummary[], itunes: AlbumSummary[], playlists: AlbumSummary[]): AlbumSummary[] {
  const wanted = normalize(query);
  const seen = new Set<string>();
  const albums: AlbumSummary[] = [];
  for (const album of [...deezer, ...itunes]) {
    const key = `${normalize(album.title)}|${normalize(album.artist)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    albums.push(album);
  }
  const holdsQuery = (album: AlbumSummary): boolean => wanted.length > 0 && normalize(album.title).includes(wanted);
  const fromItunes = (album: AlbumSummary): boolean => album.id.startsWith('it-');
  const asked = albums.filter(holdsQuery);
  // iTunes first among them: its singles were already dropped, so what is left is a proper (often official) album
  const ranked = [...asked.filter(fromItunes), ...asked.filter((album) => !fromItunes(album)), ...albums.filter((album) => !holdsQuery(album))].slice(0, MAX_ALBUMS);
  return [...ranked, ...playlists];
}

/** Albums and playlists for the first page of a search; each source may fail without taking the others down. */
const COLLECTIONS_DEADLINE_MS = 2500;

/** A source that is slow or down counts as "nothing": the tracks must not wait for it. */
const orNothing = (work: Promise<AlbumSummary[]>): Promise<AlbumSummary[]> =>
  Promise.race([work.catch(() => [] as AlbumSummary[]), new Promise<AlbumSummary[]>((resolve) => setTimeout(() => resolve([]), COLLECTIONS_DEADLINE_MS).unref?.())]);

async function searchCollections(query: string, fetchImpl?: FetchLike): Promise<AlbumSummary[]> {
  const [deezer, itunes, playlists] = await Promise.all([
    orNothing(searchDeezerAlbums(query, 8, fetchImpl)),
    orNothing(searchItunesAlbums(query, 8, fetchImpl)),
    orNothing(searchDeezerPlaylists(query, 6, fetchImpl))
  ]);
  return mergeAlbumResults(query, deezer, relevantToQuery(query, itunes), playlists);
}

/**
 * Deezer first; iTunes when Deezer fails or finds nothing on the first page. Throws only when both fail.
 * iTunes has no usable paging, so its results come as a single page.
 */
export async function searchCatalog(
  query: string,
  options: { index?: number; limit?: number; fetchImpl?: FetchLike; collections?: boolean } = {}
): Promise<CatalogSearchResult> {
  const { index = 0, limit, fetchImpl, collections = true } = options;

  let deezerError: unknown = null;
  // The collections are looked up while the tracks are, with a deadline, so a slow source cannot hold the answer
  // Callers that only want tracks (the smart playlist) skip the album and playlist lookup
  const albumsPromise: Promise<AlbumSummary[]> = index === 0 && collections ? searchCollections(query, fetchImpl) : Promise.resolve([]);
  const tracksFirst = searchDeezerPage(query, { index, limit, style: 'Deezer', fetchImpl });
  tracksFirst.catch(() => undefined);
  const albums = await albumsPromise;

  try {
    const page = await tracksFirst;
    if (page.tracks.length > 0 || index > 0) return { ...page, albums, source: 'deezer' };
  } catch (err) {
    deezerError = err;
    if (index > 0) throw err;
    console.warn(`[Catalog] Falha na busca Deezer, tentando iTunes: ${(err as Error)?.message || err}`);
  }

  try {
    const tracks = await searchItunesTracks(query, { style: 'Apple Music', limit, fetchImpl });
    return { tracks, total: tracks.length, nextIndex: null, albums, source: 'itunes' };
  } catch (err) {
    if (deezerError) throw err;
    // Deezer answered with no tracks and iTunes is down: an empty result is still truthful.
    console.warn(`[Catalog] Falha na busca iTunes: ${(err as Error)?.message || err}`);
    return { tracks: [], total: 0, nextIndex: null, albums, source: 'deezer' };
  }
}
