import type { AlbumSummary, TrackPage } from '../src/types/music';
import { searchDeezerAlbums, searchDeezerPage } from './_deezer.js';
import { searchItunesTracks } from './_itunes.js';

export type CatalogProvider = 'deezer' | 'itunes';

export interface CatalogSearchResult extends TrackPage {
  source: CatalogProvider;
  albums?: AlbumSummary[];
}

type FetchLike = typeof fetch;

/**
 * Deezer first; iTunes when Deezer fails or finds nothing on the first page. Throws only when both fail.
 * iTunes has no usable paging, so its results come as a single page.
 */
export async function searchCatalog(
  query: string,
  options: { index?: number; limit?: number; fetchImpl?: FetchLike } = {}
): Promise<CatalogSearchResult> {
  const { index = 0, limit, fetchImpl } = options;

  let deezerError: unknown = null;
  let albums: AlbumSummary[] = [];
  if (index === 0) {
    try {
      albums = await searchDeezerAlbums(query, 8, fetchImpl);
    } catch {}
  }

  try {
    const page = await searchDeezerPage(query, { index, limit, style: 'Deezer', fetchImpl });
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
