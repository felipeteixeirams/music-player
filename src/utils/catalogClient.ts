import type { FeedResponse, RadioGenre, Track, TrackPage } from '../types/music';
import { apiFetch } from './apiFetch';

/** Raised for any answer that is not a usable page, with a message fit for the user. */
export class CatalogError extends Error {}

function isTrackPage(value: unknown): value is TrackPage {
  const page = value as Partial<TrackPage> | null;
  return Boolean(
    page
    && Array.isArray(page.tracks)
    && typeof page.total === 'number'
    && (page.nextIndex === null || typeof page.nextIndex === 'number')
  );
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await apiFetch(url, { signal });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new CatalogError('Sem conexão com o servidor. Verifique a internet e tente de novo.');
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // answered with something that is not JSON
  }
  if (!response.ok) {
    const message = (body as { error?: unknown } | null)?.error;
    throw new CatalogError(typeof message === 'string' ? message : 'O servidor não conseguiu responder agora.');
  }
  return body;
}

export async function fetchFeed(signal?: AbortSignal): Promise<FeedResponse> {
  const body = (await getJson('/api/feed', signal)) as Partial<FeedResponse> | null;
  const categories = body?.categories;
  if (!categories || typeof categories !== 'object' || !Object.values(categories).every(isTrackPage)) {
    throw new CatalogError('Resposta inesperada do servidor ao carregar as coleções.');
  }
  return { categories, featured: (body?.featured as Track | null) ?? null };
}

export async function fetchCategoryPage(categoryId: string, index: number, signal?: AbortSignal): Promise<TrackPage> {
  const body = await getJson(`/api/category?id=${encodeURIComponent(categoryId)}&index=${index}`, signal);
  if (!isTrackPage(body)) throw new CatalogError('Resposta inesperada do servidor ao carregar a coleção.');
  return body;
}

export async function fetchSearchPage(query: string, index: number, signal?: AbortSignal): Promise<TrackPage & { source?: string }> {
  const body = await getJson(`/api/search?q=${encodeURIComponent(query)}&index=${index}`, signal);
  if (!isTrackPage(body)) throw new CatalogError('Resposta inesperada do servidor ao buscar.');
  return body as TrackPage & { source?: string };
}

export async function fetchRadioGenres(signal?: AbortSignal): Promise<RadioGenre[]> {
  const body = (await getJson('/api/radio', signal)) as { genres?: unknown } | null;
  const genres = body?.genres;
  const valid = Array.isArray(genres) && genres.every((genre) => {
    const g = genre as Partial<RadioGenre> | null;
    return Boolean(g && typeof g.id === 'string' && typeof g.name === 'string' && Array.isArray(g.stations));
  });
  if (!valid) throw new CatalogError('Resposta inesperada do servidor ao carregar as estações.');
  return genres as RadioGenre[];
}

/** A new batch of tracks from a station; every call is a different shuffle. */
export async function fetchRadioTracks(stationId: number, signal?: AbortSignal): Promise<Track[]> {
  const body = await getJson(`/api/radio?id=${stationId}`, signal);
  if (!isTrackPage(body)) throw new CatalogError('Resposta inesperada do servidor ao carregar a estação.');
  return body.tracks;
}
