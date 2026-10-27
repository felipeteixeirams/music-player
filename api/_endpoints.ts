import { isCategoryId, readPageParams } from './_categories.js';
import { searchCatalog } from './_catalog.js';
import { buildDeezerFeed, fetchAlbumPage, fetchArtistPage, fetchCategoryPage, fetchDeezerPreviewUrl, fetchRadioGenres, fetchRadioTracks, searchDeezerArtists } from './_deezer.js';
import { findRadioStation } from './_radios.js';
import { fetchLiveStations, findLiveStyle, isStationUuid, LIVE_STYLES, reportStationClick } from './_radioBrowser.js';

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
  return { status: 200, body: feed, cacheControl: 's-maxage=1800, stale-while-revalidate=3600' };
}

export async function categoryEndpoint(query: { id?: unknown; index?: unknown; limit?: unknown }): Promise<EndpointResult> {
  const id = Array.isArray(query.id) ? query.id[0] : query.id;
  if (!isCategoryId(id)) return failure(400, 'Categoria desconhecida');

  const { index, limit } = readPageParams(query);
  const startTime = Date.now();
  try {
    const page = await fetchCategoryPage(id, { index, limit });
    console.log(`[Category] ✅ ${id} index=${index} → ${page.tracks.length} faixa(s) de ${page.total} em ${Date.now() - startTime}ms`);
    return { status: 200, body: page, cacheControl: 's-maxage=1800, stale-while-revalidate=3600' };
  } catch (err: any) {
    console.warn(`[Category] ⚠️ ${id} index=${index} falhou: ${err?.message || err}`);
    return failure(502, 'Não foi possível carregar esta coleção agora');
  }
}

/** Longest search text accepted: real queries are short, and every distinct text is a request the cache cannot answer. */
const MAX_QUERY_LENGTH = 200;

export async function searchEndpoint(
  query: { q?: unknown; index?: unknown; limit?: unknown; preview?: unknown; artists?: unknown; artist?: unknown; album?: unknown },
  fetchImpl?: typeof fetch
): Promise<EndpointResult> {
  if (query.preview !== undefined) return previewEndpoint(query.preview, fetchImpl);
  if (query.artists !== undefined) return artistSearchEndpoint(query.artists, fetchImpl);
  if (query.album !== undefined) return albumEndpoint(query.album, fetchImpl);
  if (query.artist !== undefined) return artistEndpoint(query.artist, query, fetchImpl);
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

const firstText = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

/** `GET /api/search?artists=<text>`: the few artists whose name matches. An empty list is a valid answer. */
async function artistSearchEndpoint(raw: unknown, fetchImpl?: typeof fetch): Promise<EndpointResult> {
  const text = firstText(raw);
  if (typeof text !== 'string' || !text.trim()) return failure(400, 'O parâmetro artists é obrigatório');
  if (text.length > MAX_QUERY_LENGTH) return failure(400, `O parâmetro artists aceita até ${MAX_QUERY_LENGTH} caracteres`);
  try {
    const artists = await searchDeezerArtists(text.trim(), 3, fetchImpl);
    return { status: 200, body: { artists }, cacheControl: artists.length > 0 ? 's-maxage=1800, stale-while-revalidate=3600' : undefined };
  } catch (err: any) {
    console.warn(`[Search] ⚠️ Artistas de "${text.trim()}" falharam: ${err?.message || err}`);
    return failure(502, 'Não foi possível buscar artistas agora');
  }
}

/** `GET /api/search?artist=<id>`: the artist and a page of their most played tracks. */
async function artistEndpoint(raw: unknown, query: { index?: unknown; limit?: unknown }, fetchImpl?: typeof fetch): Promise<EndpointResult> {
  const id = firstText(raw);
  if (typeof id !== 'string' || !/^\d{1,12}$/.test(id)) return failure(400, 'Artista inválido');
  const { index, limit } = readPageParams(query);
  try {
    const page = await fetchArtistPage(id, { index, limit, fetchImpl });
    return { status: 200, body: page, cacheControl: 's-maxage=1800, stale-while-revalidate=3600' };
  } catch (err: any) {
    console.warn(`[Search] ⚠️ Artista ${id} falhou: ${err?.message || err}`);
    return failure(502, 'Não foi possível carregar este artista agora');
  }
}

/** `GET /api/search?album=<id>`: the album and its tracks. */
async function albumEndpoint(raw: unknown, fetchImpl?: typeof fetch): Promise<EndpointResult> {
  const id = firstText(raw);
  if (typeof id !== 'string' || !/^\d{1,12}$/.test(id)) return failure(400, 'Álbum inválido');
  try {
    const page = await fetchAlbumPage(id, fetchImpl);
    return { status: 200, body: page, cacheControl: 's-maxage=3600, stale-while-revalidate=86400' };
  } catch (err: any) {
    console.warn(`[Search] ⚠️ Álbum ${id} falhou: ${err?.message || err}`);
    return failure(502, 'Não foi possível carregar este álbum agora');
  }
}

/**
 * Radio: without `id`, the curated stations grouped by genre (changes rarely: cached); with a station `id`,
 * a fresh batch of its tracks (never cached: every call is a new shuffle, which is what keeps the radio going).
 */
export async function radioEndpoint(
  query: { id?: unknown; live?: unknown; click?: unknown },
  fetchImpl: typeof fetch = fetch
): Promise<EndpointResult> {
  if (query.live !== undefined) return liveRadioEndpoint(query.live, fetchImpl);
  if (query.click !== undefined) return radioClickEndpoint(query.click, fetchImpl);

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

/**
 * Live stations by style (radio-browser.info), alongside the curated list. `live` empty: the styles; `live=<style>`:
 * its most listened-to working stations. A style outside the list is refused, so the route cannot be made to
 * search the directory for anything else.
 */
async function liveRadioEndpoint(live: unknown, fetchImpl: typeof fetch): Promise<EndpointResult> {
  const value = Array.isArray(live) ? live[0] : live;
  if (value === '' || value === true) {
    return {
      status: 200,
      body: { styles: LIVE_STYLES.map(({ id, name }) => ({ id, name })) },
      cacheControl: 's-maxage=86400, stale-while-revalidate=604800'
    };
  }
  const style = findLiveStyle(value);
  if (!style) return failure(400, 'Estilo desconhecido');

  try {
    const stations = await fetchLiveStations(style, fetchImpl);
    console.log(`[LiveRadio] ✅ ${style.id} → ${stations.length} emissora(s)`);
    // An empty list is not kept by the CDN: it may just be the directory having a bad moment
    return { status: 200, body: { style: style.id, stations }, cacheControl: stations.length > 0 ? 's-maxage=3600, stale-while-revalidate=86400' : undefined };
  } catch (err: any) {
    console.warn(`[LiveRadio] ⚠️ ${style.id} falhou: ${err?.message || err}`);
    return failure(502, 'Não foi possível carregar as emissoras agora');
  }
}

/** The directory asks apps to report each play of a station; failing to do so never matters to the listener. */
async function radioClickEndpoint(click: unknown, fetchImpl: typeof fetch): Promise<EndpointResult> {
  const uuid = Array.isArray(click) ? click[0] : click;
  if (!isStationUuid(uuid)) return failure(400, 'Emissora inválida');
  try {
    await reportStationClick(uuid, fetchImpl);
  } catch (err: any) {
    console.warn(`[LiveRadio] ⚠️ clique não registrado: ${err?.message || err}`);
  }
  return { status: 200, body: { ok: true } };
}

/** `GET /api/search?preview=deezer-<id>`: a new preview address for a track whose old one expired. Never cached: it is short-lived. */
async function previewEndpoint(preview: unknown, fetchImpl?: typeof fetch): Promise<EndpointResult> {
  const value = Array.isArray(preview) ? preview[0] : preview;
  const match = typeof value === 'string' ? /^deezer-(\d{1,12})$/.exec(value) : null;
  if (!match) return failure(400, 'Faixa inválida');
  try {
    const previewUrl = await fetchDeezerPreviewUrl(Number(match[1]), fetchImpl);
    if (!previewUrl) return failure(404, 'Esta faixa não tem prévia');
    return { status: 200, body: { id: value, previewUrl } };
  } catch (err: any) {
    console.warn(`[Preview] ⚠️ ${value} falhou: ${err?.message || err}`);
    return failure(502, 'Não foi possível renovar a prévia agora');
  }
}
