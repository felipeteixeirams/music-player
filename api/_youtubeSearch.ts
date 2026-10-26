import { extractYouTubeId } from './_youtubeId.js';

type FetchLike = typeof fetch;

export interface TrackQuery {
  artist: string;
  title: string;
  duration: number;
}

export interface VideoCandidate {
  videoId: string;
  title: string;
  channel: string;
  durationSeconds: number | null;
}

export interface ResolveOptions {
  apiKey?: string;
  fetchImpl?: FetchLike;
}

/** A song longer than this is not a catalog track: refuse before spending a YouTube search on it. */
export const MAX_TRACK_DURATION_SECONDS = 7200;

const REQUEST_TIMEOUT_MS = 4000;
const MAX_DURATION_DIFF_SECONDS = 15;
const MIN_ACCEPTED_SCORE = 40;
const MAX_RESOLVED_VIDEOS = 3;
const UNWANTED_TERMS = ['live', 'ao vivo', 'cover', 'remix', 'karaoke', 'reaction', 'instrumental', 'slowed', 'sped up', '8d', 'nightcore'];
/** Music videos open with a scene, an intro or a skit the studio recording does not have: worse than audio, not unusable. */
const CLIP_TERMS = ['official video', 'official music video', 'music video', 'video oficial', 'videoclipe', 'clipe'];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** "4:08" -> 248, "1:02:03" -> 3723; null when the text is not a clock value. */
export function parseClockDuration(text: string): number | null {
  if (!/^\d{1,2}(:\d{2}){1,2}$/.test(text)) return null;
  return text.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

/** "PT4M8S" -> 248; null when the text is not an ISO-8601 duration. */
export function parseIsoDuration(text: string): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(text);
  if (!match || !text.slice(2)) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function collectVideoRenderers(node: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) {
    for (const child of node) collectVideoRenderers(child, found);
  } else if (node && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      const renderer = key === 'videoRenderer' ? asRecord(child) : null;
      if (renderer) found.push(renderer);
      else collectVideoRenderers(child, found);
    }
  }
  return found;
}

function firstRunText(value: unknown): string {
  const record = asRecord(value);
  if (!record) return '';
  const runs = record.runs;
  if (Array.isArray(runs)) return asText(asRecord(runs[0])?.text);
  return asText(record.simpleText);
}

/** Candidates from the unofficial youtube.com web search payload; never throws. */
export function parseWebSearchCandidates(payload: unknown): VideoCandidate[] {
  const candidates: VideoCandidate[] = [];
  for (const renderer of collectVideoRenderers(payload)) {
    const videoId = extractYouTubeId(renderer.videoId);
    const title = firstRunText(renderer.title);
    if (!videoId || !title) continue;
    candidates.push({
      videoId,
      title,
      channel: firstRunText(renderer.ownerText ?? renderer.longBylineText),
      durationSeconds: parseClockDuration(firstRunText(renderer.lengthText))
    });
  }
  return candidates;
}

/** Candidates from YouTube Data API v3 search.list merged with videos.list durations. */
export function parseOfficialCandidates(searchPayload: unknown, videosPayload: unknown): VideoCandidate[] {
  const durations = new Map<string, number | null>();
  const blocked = new Set<string>();
  const videoItems = asRecord(videosPayload)?.items;
  if (Array.isArray(videoItems)) {
    for (const item of videoItems) {
      const record = asRecord(item);
      const id = extractYouTubeId(record?.id);
      if (!id) continue;
      if (asRecord(record?.status)?.embeddable === false) blocked.add(id);
      durations.set(id, parseIsoDuration(asText(asRecord(record?.contentDetails)?.duration)));
    }
  }

  const candidates: VideoCandidate[] = [];
  const searchItems = asRecord(searchPayload)?.items;
  if (!Array.isArray(searchItems)) return candidates;
  for (const item of searchItems) {
    const record = asRecord(item);
    const videoId = extractYouTubeId(asRecord(record?.id)?.videoId);
    const snippet = asRecord(record?.snippet);
    const title = asText(snippet?.title);
    if (!videoId || !title || blocked.has(videoId)) continue;
    candidates.push({
      videoId,
      title,
      channel: asText(snippet?.channelTitle),
      durationSeconds: durations.get(videoId) ?? null
    });
  }
  return candidates;
}

/** A candidate with the reasons behind its score, for the logs and for choosing between versions. */
export interface RankedCandidate {
  candidate: VideoCandidate;
  score: number;
  /** Seconds away from the catalog duration; null when the video's length is unknown. */
  durationDiff: number | null;
  /** From a "Artist - Topic" channel: the label's own audio upload, the closest thing to the studio master. */
  topic: boolean;
}

/**
 * The app plays audio only, so the best video is the cleanest source of the studio recording: a Topic channel
 * (audio supplied by the label, with the catalog's exact duration, no intro or scenes) beats an official audio
 * upload, which beats a music video. Duration decides first among the rest: the closer, the likelier it is
 * the same recording without extra seconds.
 */
function evaluateCandidate(candidate: VideoCandidate, query: TrackQuery): RankedCandidate {
  const title = normalize(candidate.title);
  const channel = normalize(candidate.channel);
  const wantedTitle = normalize(query.title);
  const wantedArtist = normalize(query.artist);
  const wantedText = `${wantedTitle} ${wantedArtist}`;
  const topic = channel.endsWith('topic');
  let score = 0;
  let durationDiff: number | null = null;

  if (candidate.durationSeconds !== null) {
    durationDiff = Math.abs(candidate.durationSeconds - query.duration);
    if (durationDiff > MAX_DURATION_DIFF_SECONDS) return { candidate, score: -1, durationDiff, topic };
    score += durationDiff <= 2 ? 60 : durationDiff <= 5 ? 45 : 25;
  }
  if (wantedTitle && title.includes(wantedTitle)) score += 30;
  if (wantedArtist && title.includes(wantedArtist)) score += 10;
  if (wantedArtist && channel.includes(wantedArtist)) score += 20;
  if (topic) score += 40;
  else if (title.includes('official audio')) score += 15;
  else if (title.includes('official')) score += 5;

  for (const term of UNWANTED_TERMS) {
    // Heavier than the best duration bonus, so a live or cover take of the right length still falls below the threshold
    if (title.includes(term) && !wantedText.includes(term)) score -= 100;
  }
  if (CLIP_TERMS.some((term) => title.includes(term) && !wantedText.includes(term))) score -= 30;
  return { candidate, score, durationDiff, topic };
}

/** Acceptable videos with their scores, best match first; empty when nothing is close to the requested recording. */
export function rankCandidatesDetailed(candidates: VideoCandidate[], query: TrackQuery): RankedCandidate[] {
  return candidates
    .map((candidate) => evaluateCandidate(candidate, query))
    .filter(({ score }) => score >= MIN_ACCEPTED_SCORE)
    .sort((a, b) => b.score - a.score);
}

/** Acceptable videos, best match first; empty when nothing is close to the requested recording. */
export function rankCandidates(candidates: VideoCandidate[], query: TrackQuery): VideoCandidate[] {
  return rankCandidatesDetailed(candidates, query).map(({ candidate }) => candidate);
}

/** Best matching video, or null when nothing is close enough to the requested recording. */
export function pickBestCandidate(candidates: VideoCandidate[], query: TrackQuery): VideoCandidate | null {
  return rankCandidates(candidates, query)[0] ?? null;
}

/** oEmbed answers 401/403/404 for videos whose owner blocks embedding or that no longer exist. */
export async function isEmbeddable(videoId: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    return ![401, 403, 404].includes(response.status);
  } catch {
    // Network trouble says nothing about the video; let the player try it.
    return true;
  }
}

async function getJson(url: string, init: RequestInit, fetchImpl: FetchLike): Promise<unknown> {
  const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`YouTube HTTP ${response.status}`);
  return response.json();
}

async function searchOfficial(searchText: string, apiKey: string, fetchImpl: FetchLike): Promise<VideoCandidate[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoCategoryId: '10',
    maxResults: '5',
    q: searchText,
    key: apiKey
  });
  const searchPayload = await getJson(`https://www.googleapis.com/youtube/v3/search?${params}`, {}, fetchImpl);
  const ids = parseOfficialCandidates(searchPayload, null).map((candidate) => candidate.videoId);
  if (ids.length === 0) return [];

  const videoParams = new URLSearchParams({ part: 'contentDetails,status', id: ids.join(','), key: apiKey });
  const videosPayload = await getJson(`https://www.googleapis.com/youtube/v3/videos?${videoParams}`, {}, fetchImpl);
  return parseOfficialCandidates(searchPayload, videosPayload);
}

async function searchWeb(searchText: string, fetchImpl: FetchLike): Promise<VideoCandidate[]> {
  const payload = await getJson(
    'https://www.youtube.com/youtubei/v1/search?prettyPrint=false',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en' } },
        query: searchText
      })
    },
    fetchImpl
  );
  return parseWebSearchCandidates(payload);
}

/** Which search produced the candidates: the official API, the web search, or the web search after the API refused. */
export type ResolveVia = 'official' | 'web' | 'web-after-official-failure';

export interface ResolvedVideos {
  videoIds: string[];
  via: ResolveVia;
  /** The videos behind `videoIds`, same order, with why each was chosen. */
  picks: RankedCandidate[];
  /** How many videos the search returned before ranking, to tell "nothing found" from "nothing close enough". */
  considered: number;
}

/** Official API when a key exists; the unofficial search when there is no key or the API refuses (quota, bad key). */
async function searchCandidates(
  searchText: string,
  options: ResolveOptions,
  fetchImpl: FetchLike
): Promise<{ candidates: VideoCandidate[]; via: ResolveVia }> {
  if (!options.apiKey) return { candidates: await searchWeb(searchText, fetchImpl), via: 'web' };

  try {
    return { candidates: await searchOfficial(searchText, options.apiKey, fetchImpl), via: 'official' };
  } catch (err) {
    console.warn(`[YouTube] API oficial indisponível (${(err as Error)?.message || err}); usando a busca web.`);
    return { candidates: await searchWeb(searchText, fetchImpl), via: 'web-after-official-failure' };
  }
}

/**
 * Finds embeddable YouTube videos of a catalog track, best match first. Uses the official Data API when a key is
 * configured and the unofficial web search otherwise (fragile; see the integration spec).
 */
export async function resolveYouTubeVideos(query: TrackQuery, options: ResolveOptions = {}): Promise<ResolvedVideos> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const searchText = `${query.artist} ${query.title} official audio`;
  const { candidates, via } = await searchCandidates(searchText, options, fetchImpl);
  // oEmbed only catches some blocked videos; the player reports the rest and the caller tries the next id.
  const ranked = rankCandidatesDetailed(candidates, query).slice(0, MAX_RESOLVED_VIDEOS + 1);
  const checks = await Promise.all(ranked.map((entry) => isEmbeddable(entry.candidate.videoId, fetchImpl)));
  const picks = ranked.filter((_, index) => checks[index]).slice(0, MAX_RESOLVED_VIDEOS);
  return { videoIds: picks.map((entry) => entry.candidate.videoId), via, picks, considered: candidates.length };
}

export async function resolveYouTubeVideoIds(query: TrackQuery, options: ResolveOptions = {}): Promise<string[]> {
  return (await resolveYouTubeVideos(query, options)).videoIds;
}

/**
 * The line the resolve routes log: what was chosen and why, or why nothing was. Without it a wrong version
 * cannot be told apart from a ranking that needs tuning.
 */
export function describeResolution(query: TrackQuery, result: ResolvedVideos, elapsedMs: number): string {
  const name = `"${query.artist} - ${query.title}"`;
  const head = `${result.videoIds.length > 0 ? '✅' : '⚠️'} ${name} → ${result.videoIds.length} vídeo(s) via ${result.via} em ${elapsedMs}ms`;
  const best = result.picks[0];
  if (!best) return `${head} | ${result.considered} candidato(s), nenhum aceito`;
  const diff = best.durationDiff === null ? 'duração desconhecida' : `Δ${best.durationDiff}s`;
  return `${head} | escolhido: "${best.candidate.title}" (${best.candidate.channel || 'canal desconhecido'}) ${diff}, ${best.score} pontos${best.topic ? ', Topic' : ''}`;
}
