import { createHash } from 'node:crypto';

type FetchLike = typeof fetch;

const ITUNES_SEARCH = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP = 'https://itunes.apple.com/lookup';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_FEED_BYTES = 6 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_EPISODES = 300;
const MAX_SHOWS = 20;
const MAX_QUERY_LENGTH = 200;

export interface PodcastShow {
  /** The iTunes collection id: the only way the app names a show (the feed address never comes from the client). */
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  description?: string;
  language?: string;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  /** ISO date, "" when the feed gives none. */
  publishedAt: string;
  durationSeconds: number;
  audioUrl: string;
  description: string;
  coverUrl: string;
}

export class PodcastError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const asRecord = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Cover and artwork addresses are shown in an <img>: only http(s). */
function webUrl(value: unknown): string {
  const text = asText(value);
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

const httpsOnly = (value: string): string => (value.startsWith('http://') ? `https://${value.slice(7)}` : value);

export function mapShow(input: unknown): PodcastShow | null {
  const item = asRecord(input);
  if (!item) return null;
  const id = String(item.collectionId ?? '');
  const title = asText(item.collectionName);
  if (!/^\d{1,12}$/.test(id) || !title) return null;
  const cover = webUrl(item.artworkUrl600) || webUrl(item.artworkUrl100);
  return { id, title, author: asText(item.artistName), coverUrl: httpsOnly(cover.replace(/\/\d+x\d+bb\./, '/600x600bb.')) };
}

/** `GET /api/search?podcasts=<text>`: the shows whose name or host matches. */
export async function searchShows(text: unknown, fetchImpl: FetchLike = fetch): Promise<PodcastShow[]> {
  const query = Array.isArray(text) ? text[0] : text;
  if (typeof query !== 'string' || !query.trim()) throw new PodcastError(400, 'O parâmetro podcasts é obrigatório');
  if (query.length > MAX_QUERY_LENGTH) throw new PodcastError(400, `O parâmetro podcasts aceita até ${MAX_QUERY_LENGTH} caracteres`);
  const url = `${ITUNES_SEARCH}?${new URLSearchParams({ term: query.trim(), media: 'podcast', entity: 'podcast', country: 'BR', limit: String(MAX_SHOWS) })}`;
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new PodcastError(502, `A busca de podcasts respondeu HTTP ${response.status}`);
  const data = asRecord(await response.json());
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map(mapShow).filter((show): show is PodcastShow => show !== null);
}

/** A feed address is fetched by this server, so it must not reach the machine's own network. */
export function isPublicFeedUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (host.includes(':')) return false; // IPv6 literals: not needed for a public podcast host
  const octets = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (octets) {
    const [a, b] = [Number(octets[1]), Number(octets[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) return false;
  }
  return true;
}

/** The feed text, following a few redirects by hand so each hop is checked as well. */
async function fetchFeedText(feedUrl: string, fetchImpl: FetchLike): Promise<string> {
  let current = feedUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isPublicFeedUrl(current)) throw new PodcastError(502, 'Endereço do feed não permitido');
    const response = await fetchImpl(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5', 'User-Agent': 'AuraStream/1.0 (+podcast reader)' }
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new PodcastError(502, 'Redirecionamento do feed sem destino');
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) throw new PodcastError(502, `O feed respondeu HTTP ${response.status}`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_FEED_BYTES) throw new PodcastError(413, 'Feed grande demais');
    const text = await response.text();
    if (text.length > MAX_FEED_BYTES) throw new PodcastError(413, 'Feed grande demais');
    return text;
  }
  throw new PodcastError(502, 'Redirecionamentos demais no feed');
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole);
}

/** The text of the first `<tag>…</tag>` (CDATA unwrapped, entities decoded, tags dropped), "" when absent. */
function tagText(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  if (!match) return '';
  const inner = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return decode(inner.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attr(xml: string, tag: string, name: string): string {
  const match = new RegExp(`<${tag}\\s[^>]*?${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(xml);
  return match ? decode(match[1]).trim() : '';
}

/** "01:10:05", "70:05" or plain seconds. */
export function parseDuration(text: string): number {
  const value = text.trim();
  if (/^\d+(\.\d+)?$/.test(value)) return Math.round(Number(value));
  const parts = value.split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function isoDate(text: string): string {
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : '';
}

/** Episodes of an RSS feed, newest first, only those with a playable audio address. Never throws on a bad item. */
export function parseFeed(xml: string, showId: string): { show: Partial<PodcastShow>; episodes: PodcastEpisode[] } {
  const channelHead = xml.split(/<item[\s>]/i)[0] ?? '';
  const showCover = webUrl(attr(channelHead, 'itunes:image', 'href')) || webUrl(tagText(channelHead.replace(/<itunes:image[^>]*>/gi, ''), 'url'));
  const show: Partial<PodcastShow> = {
    description: tagText(channelHead, 'description').slice(0, 600),
    language: tagText(channelHead, 'language') || undefined,
    ...(showCover ? { coverUrl: httpsOnly(showCover) } : {})
  };

  const episodes: PodcastEpisode[] = [];
  for (const [, item] of xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)) {
    if (episodes.length >= MAX_EPISODES) break;
    const enclosure = /<enclosure\s[^>]*>/i.exec(item)?.[0] ?? '';
    const audioUrl = webUrl(attr(enclosure, 'enclosure', 'url'));
    const type = attr(enclosure, 'enclosure', 'type').toLowerCase();
    if (!audioUrl || (type && !type.startsWith('audio/') && !/\.(mp3|m4a|aac|ogg|opus|wav)(\?|$)/i.test(audioUrl))) continue;
    const title = tagText(item, 'title');
    if (!title) continue;
    const key = tagText(item, 'guid') || audioUrl;
    episodes.push({
      id: `pod-${showId}-${createHash('sha1').update(key).digest('hex').slice(0, 10)}`,
      title,
      publishedAt: isoDate(tagText(item, 'pubDate')),
      durationSeconds: parseDuration(tagText(item, 'itunes:duration')),
      audioUrl: httpsOnly(audioUrl),
      description: tagText(item, 'description').slice(0, 400),
      coverUrl: httpsOnly(webUrl(attr(item, 'itunes:image', 'href')) || showCover)
    });
  }
  // The feed order is usually newest first, but not always: the app gets it sorted
  episodes.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  return { show, episodes };
}

/** `GET /api/search?podcast=<id>`: the show and its episodes, from the feed its iTunes entry names. */
export async function showWithEpisodes(idInput: unknown, fetchImpl: FetchLike = fetch): Promise<{ show: PodcastShow; episodes: PodcastEpisode[] }> {
  const id = Array.isArray(idInput) ? idInput[0] : idInput;
  if (typeof id !== 'string' || !/^\d{1,12}$/.test(id)) throw new PodcastError(400, 'Identificador de podcast inválido');

  const lookup = await fetchImpl(`${ITUNES_LOOKUP}?${new URLSearchParams({ id, entity: 'podcast', country: 'BR' })}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!lookup.ok) throw new PodcastError(502, `A consulta ao podcast respondeu HTTP ${lookup.status}`);
  const data = asRecord(await lookup.json());
  const entry = asRecord(Array.isArray(data?.results) ? data.results[0] : null);
  const base = mapShow(entry);
  const feedUrl = asText(entry?.feedUrl);
  if (!base || !feedUrl) throw new PodcastError(404, 'Podcast não encontrado');

  const { show: fromFeed, episodes } = parseFeed(await fetchFeedText(feedUrl, fetchImpl), base.id);
  return { show: { ...base, description: fromFeed.description, language: fromFeed.language }, episodes };
}
