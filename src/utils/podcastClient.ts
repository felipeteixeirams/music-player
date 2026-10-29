import type { PodcastEpisodeItem, PodcastShowSummary } from '../types/music';
import { apiFetch } from './apiFetch';

/** Raised for any answer that is not usable, with a message fit for the user. */
export class PodcastClientError extends Error {}

const isText = (value: unknown): value is string => typeof value === 'string';

function isShow(value: unknown): value is PodcastShowSummary {
  const show = value as Partial<PodcastShowSummary> | null;
  return Boolean(show && isText(show.id) && isText(show.title) && isText(show.author) && isText(show.coverUrl));
}

function isEpisode(value: unknown): value is PodcastEpisodeItem {
  const episode = value as Partial<PodcastEpisodeItem> | null;
  return Boolean(
    episode && isText(episode.id) && isText(episode.title) && isText(episode.audioUrl) && isText(episode.publishedAt)
    && typeof episode.durationSeconds === 'number'
  );
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await apiFetch(url, { signal });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new PodcastClientError('Sem conexão com o servidor. Verifique a internet e tente de novo.');
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // not JSON
  }
  if (!response.ok) {
    const message = (body as { error?: unknown } | null)?.error;
    throw new PodcastClientError(typeof message === 'string' ? message : 'Não foi possível carregar os podcasts agora.');
  }
  return body;
}

/** The shows whose name or host matches the text; empty when none does. */
export async function fetchPodcastSearch(query: string, signal?: AbortSignal): Promise<PodcastShowSummary[]> {
  const body = (await getJson(`/api/search?podcasts=${encodeURIComponent(query)}`, signal)) as { shows?: unknown } | null;
  return Array.isArray(body?.shows) ? body.shows.filter(isShow) : [];
}

/** A show and its episodes, newest first. */
export async function fetchPodcastShow(id: string, signal?: AbortSignal): Promise<{ show: PodcastShowSummary; episodes: PodcastEpisodeItem[] }> {
  const body = (await getJson(`/api/search?podcast=${encodeURIComponent(id)}`, signal)) as { show?: unknown; episodes?: unknown } | null;
  if (!body || !isShow(body.show) || !Array.isArray(body.episodes)) throw new PodcastClientError('Resposta inesperada do servidor ao carregar o podcast.');
  return { show: body.show, episodes: body.episodes.filter(isEpisode) };
}
