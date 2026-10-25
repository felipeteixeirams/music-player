import { isCategoryId, readPageParams } from './_categories.js';
import { searchCatalog } from './_catalog.js';
import { buildDeezerFeed, fetchCategoryPage, fetchRadioGenres, fetchRadioTracks } from './_deezer.js';
import { findRadioStation } from './_radios.js';

/** What an endpoint answers, independent of the HTTP framework (Vercel handlers and the Express server share it). */
export interface EndpointResult {
  status: number;
  body: unknown;
  cacheControl?: string;
}

const failure = (status: number, error: string): EndpointResult => ({ status, body: { error } });

export async function feedEndpoint(): Promise<EndpointResult> {
  const feed = await buildDeezerFeed();
  const hasTracks = Object.values(feed.categories).some((page) => page.tracks.length > 0);
  // A feed with every category empty means the catalog is down: do not let the CDN keep it.
  if (!hasTracks) return failure(502, 'Não foi possível carregar as coleções agora');
  return { status: 200, body: feed, cacheControl: 's-maxage=7200, stale-while-revalidate=86400' };
}

export async function categoryEndpoint(query: { id?: unknown; index?: unknown; limit?: unknown }): Promise<EndpointResult> {
  const id = Array.isArray(query.id) ? query.id[0] : query.id;
  if (!isCategoryId(id)) return failure(400, 'Categoria desconhecida');

  const { index, limit } = readPageParams(query);
  const startTime = Date.now();
  try {
    const page = await fetchCategoryPage(id, { index, limit });
    console.log(`[Category] ✅ ${id} index=${index} → ${page.tracks.length} faixa(s) de ${page.total} em ${Date.now() - startTime}ms`);
    return { status: 200, body: page, cacheControl: 's-maxage=3600, stale-while-revalidate=86400' };
  } catch (err: any) {
    console.warn(`[Category] ⚠️ ${id} index=${index} falhou: ${err?.message || err}`);
    return failure(502, 'Não foi possível carregar esta coleção agora');
  }
}

/** Longest search text accepted: real queries are short, and every distinct text is a request the cache cannot answer. */
const MAX_QUERY_LENGTH = 200;

export async function searchEndpoint(query: { q?: unknown; index?: unknown; limit?: unknown }): Promise<EndpointResult> {
  const text = Array.isArray(query.q) ? query.q[0] : query.q;
  if (typeof text !== 'string' || !text.trim()) return failure(400, 'O parâmetro q é obrigatório');
  if (text.length > MAX_QUERY_LENGTH) return failure(400, `O parâmetro q aceita até ${MAX_QUERY_LENGTH} caracteres`);

  const { index, limit } = readPageParams(query);
  const startTime = Date.now();
  try {
    const result = await searchCatalog(text.trim(), { index, limit });
    console.log(`[Search] ✅ "${text.trim()}" index=${index} → ${result.tracks.length} faixa(s) de ${result.total} via ${result.source} em ${Date.now() - startTime}ms`);
    return {
      status: 200,
      body: result,
      cacheControl: result.tracks.length > 0 ? 's-maxage=1800, stale-while-revalidate=3600' : undefined
    };
  } catch (err: any) {
    console.warn(`[Search] ⚠️ Falha em todos os catálogos para "${text.trim()}": ${err?.message || err}`);
    return failure(502, 'Não foi possível buscar agora');
  }
}

/**
 * Radio: without `id`, the curated stations grouped by genre (changes rarely: cached); with a station `id`,
 * a fresh batch of its tracks (never cached: every call is a new shuffle, which is what keeps the radio going).
 */
export async function radioEndpoint(query: { id?: unknown }): Promise<EndpointResult> {
  const hasId = Array.isArray(query.id) ? query.id.length > 0 : query.id !== undefined;

  if (!hasId) {
    try {
      const genres = await fetchRadioGenres();
      if (genres.length === 0) return failure(502, 'Não foi possível carregar as estações agora');
      return { status: 200, body: { genres }, cacheControl: 's-maxage=86400, stale-while-revalidate=604800' };
    } catch (err: any) {
      console.warn(`[Radio] ⚠️ Lista de estações falhou: ${err?.message || err}`);
      return failure(502, 'Não foi possível carregar as estações agora');
    }
  }

  const station = findRadioStation(query.id);
  if (!station) return failure(400, 'Estação desconhecida');

  const startTime = Date.now();
  try {
    const page = await fetchRadioTracks(station);
    console.log(`[Radio] ✅ ${station.name} → ${page.tracks.length} faixa(s) em ${Date.now() - startTime}ms`);
    return { status: 200, body: page };
  } catch (err: any) {
    console.warn(`[Radio] ⚠️ ${station.name} falhou: ${err?.message || err}`);
    return failure(502, 'Não foi possível carregar esta estação agora');
  }
}
