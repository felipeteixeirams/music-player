import type { Track } from '../src/types/music';
import { searchDeezerTracks } from './_deezer.js';
import { searchItunesTracks } from './_itunes.js';

export type CatalogProvider = 'deezer' | 'itunes';

export interface CatalogSearchResult {
  tracks: Track[];
  source: CatalogProvider;
}

type FetchLike = typeof fetch;

/** Deezer first; iTunes when Deezer fails or finds nothing. Throws only when both fail. */
export async function searchCatalog(query: string, fetchImpl?: FetchLike): Promise<CatalogSearchResult> {
  let deezerError: unknown = null;
  try {
    const tracks = await searchDeezerTracks(query, { style: 'Deezer', fetchImpl });
    if (tracks.length > 0) return { tracks, source: 'deezer' };
  } catch (err) {
    deezerError = err;
    console.warn(`[Catalog] Falha na busca Deezer, tentando iTunes: ${(err as Error)?.message || err}`);
  }

  try {
    const tracks = await searchItunesTracks(query, { style: 'Apple Music', fetchImpl });
    return { tracks, source: 'itunes' };
  } catch (err) {
    if (deezerError) throw err;
    // Deezer answered with no tracks and iTunes is down: an empty result is still truthful.
    console.warn(`[Catalog] Falha na busca iTunes: ${(err as Error)?.message || err}`);
    return { tracks: [], source: 'deezer' };
  }
}
