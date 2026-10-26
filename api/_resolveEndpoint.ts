import { createHash } from 'node:crypto';
import type { AuthUser } from './_auth.js';
import { adminConfigFromEnv, createAdmin, type Admin } from './_supabaseAdmin.js';
import { describeResolution, MAX_TRACK_DURATION_SECONDS, resolveYouTubeVideos, type ResolvedVideos, type TrackQuery } from './_youtubeSearch.js';

/** How many tracks nobody has played before each person may bring in per day (each costs a YouTube search). */
export const DEFAULT_DAILY_NEW_TRACKS = 30;
/** A found video is kept for this long; the player reporting it broken removes it sooner. */
export const FOUND_TTL_MS = 180 * 24 * 3600 * 1000;
/** "The official search found nothing" is kept for a day: it costs quota to ask again, but videos do appear. */
export const MISS_TTL_MS = 24 * 3600 * 1000;

const CATALOG_ID = /^(deezer|itunes)-\d+$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export interface ResolveQuota {
  used: number;
  limit: number;
  exceeded: boolean;
}

export interface EndpointResult {
  status: number;
  body: unknown;
  cacheControl?: string;
}

export interface ResolveDeps {
  admin: Admin | null;
  search: (query: TrackQuery) => Promise<ResolvedVideos>;
  dailyLimit: number;
  now: () => number;
  log: (line: string) => void;
}

export function defaultDeps(): ResolveDeps {
  const config = adminConfigFromEnv();
  const limit = Number(process.env.DAILY_NEW_TRACKS);
  return {
    admin: config ? createAdmin(config) : null,
    search: (query) => resolveYouTubeVideos(query, { apiKey: process.env.YOUTUBE_API_KEY }),
    dailyLimit: Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_DAILY_NEW_TRACKS,
    now: Date.now,
    log: (line) => console.log(line)
  };
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && value.length <= 200 ? value.trim() : null;
}

/**
 * The key of the song itself: artist, title and length (in 5 s steps), whatever catalog id it came with. The same
 * song often has several ids (Deezer and iTunes, reissues): a video found for one serves the others, and costs one search.
 */
export function aliasKeyFor(query: TrackQuery): string {
  const text = `${query.artist.toLowerCase()}|${query.title.toLowerCase()}|${Math.round(query.duration / 5)}`;
  return `h-${createHash('sha1').update(text).digest('hex').slice(0, 24)}`;
}

/** The track's catalog id; clients from before it was sent are keyed by the song's own key. */
export function cacheKeyFor(query: TrackQuery, id: unknown): string {
  if (typeof id === 'string' && CATALOG_ID.test(id)) return id;
  return aliasKeyFor(query);
}

/** Both keys a track can be cached under (the catalog id, then the song), without repeating one. */
export function cacheKeysFor(query: TrackQuery, id: unknown): string[] {
  return [...new Set([cacheKeyFor(query, id), aliasKeyFor(query)])];
}

/** The first of `keys` that holds a videos list still good (a found one for a long time, "nothing found" for a day). */
function freshEntry(
  found: Record<string, { videoIds: string[]; resolvedAt: number }>,
  keys: string[],
  now: number
): { videoIds: string[]; resolvedAt: number } | null {
  for (const key of keys) {
    const entry = found[key];
    if (entry && now - entry.resolvedAt < (entry.videoIds.length > 0 ? FOUND_TTL_MS : MISS_TTL_MS)) return entry;
  }
  return null;
}

/**
 * GET: the YouTube videos that play a track. Tracks someone already played come from the shared cache and cost
 * nothing; a new one counts against the user's daily allowance, then is searched and cached for everybody.
 * Anything wrong with the database degrades to searching without cache or limit, so playback never depends on it.
 */
export async function resolveEndpoint(
  query: Record<string, unknown>,
  user: AuthUser | null,
  deps: ResolveDeps = defaultDeps()
): Promise<EndpointResult> {
  const artist = readText(query.artist);
  const title = readText(query.title);
  const duration = Number(query.duration);
  if (!artist || !title || !Number.isFinite(duration) || duration <= 0 || duration > MAX_TRACK_DURATION_SECONDS) {
    return { status: 400, body: { error: 'Os parâmetros artist, title e duration são obrigatórios' } };
  }

  const track: TrackQuery = { artist, title, duration };
  const keys = cacheKeysFor(track, query.id);
  const { admin, now } = deps;
  const noStore = 'private, no-store';

  if (admin) {
    try {
      const hit = freshEntry(await admin.getCachedMany(keys), keys, now());
      if (hit) return { status: 200, body: { videoIds: hit.videoIds }, cacheControl: noStore };
    } catch (err) {
      deps.log(`[Resolve] cache indisponível (${(err as Error).message}); buscando sem cache`);
    }
  }

  let quota: ResolveQuota | undefined;
  let consumed = false;
  if (admin && user) {
    try {
      const used = await admin.consume(user.id, deps.dailyLimit);
      if (used < 0) {
        quota = { used: deps.dailyLimit, limit: deps.dailyLimit, exceeded: true };
        return { status: 200, body: { videoIds: [], quota }, cacheControl: noStore };
      }
      consumed = true;
      quota = { used, limit: deps.dailyLimit, exceeded: false };
    } catch (err) {
      deps.log(`[Resolve] cota indisponível (${(err as Error).message}); buscando sem limite`);
    }
  }

  const startTime = now();
  let result: ResolvedVideos;
  try {
    result = await deps.search(track);
  } catch (err) {
    // A search that failed gave the user nothing: the unit goes back
    if (consumed && admin && user) await admin.refund(user.id).catch(() => undefined);
    deps.log(`[Resolve] ⚠️ Falha ao localizar vídeo para "${artist} - ${title}": ${(err as Error)?.message || err}`);
    return { status: 200, body: { videoIds: [], ...(quota ? { quota } : {}) } };
  }
  deps.log(`[Resolve] ${describeResolution(track, result, now() - startTime)}`);

  // Found videos are always kept. An empty answer is kept only when the official API gave it: the unofficial web
  // search comes back empty when it is merely blocked or changed, and that must not stick to a good track.
  if (admin && (result.videoIds.length > 0 || result.via === 'official')) {
    // Under the catalog id and under the song's own key, so the same song with another id is found next time
    await Promise.all(keys.map((key) => admin.putCached(key, result.videoIds, now()))).catch((err: Error) =>
      deps.log(`[Resolve] cache não gravado: ${err.message}`)
    );
  }
  return { status: 200, body: { videoIds: result.videoIds, ...(quota ? { quota } : {}) }, cacheControl: noStore };
}

/**
 * POST { id, videoId, artist?, title?, duration? }: the player could not play a video that came from the cache; drop it
 * (from the catalog id's entry and from the song's, when the song is given) so the next play searches again.
 */
export async function reportBadVideoEndpoint(body: unknown, deps: ResolveDeps = defaultDeps()): Promise<EndpointResult> {
  const { id, videoId, artist, title, duration } = (body ?? {}) as Record<string, unknown>;
  if (typeof id !== 'string' || !CATALOG_ID.test(id) || typeof videoId !== 'string' || !VIDEO_ID.test(videoId)) {
    return { status: 400, body: { error: 'id e videoId inválidos' } };
  }
  const { admin } = deps;
  if (!admin) return { status: 200, body: { ok: true } };

  const song = readText(artist) && readText(title) && Number.isFinite(Number(duration)) && Number(duration) > 0
    ? { artist: readText(artist) as string, title: readText(title) as string, duration: Number(duration) }
    : null;
  const keys = song ? cacheKeysFor(song, id) : [id];
  try {
    const found = await admin.getCachedMany(keys);
    for (const key of keys) {
      const cached = found[key];
      if (!cached?.videoIds.includes(videoId)) continue;
      const rest = cached.videoIds.filter((v) => v !== videoId);
      if (rest.length > 0) await admin.putCached(key, rest, cached.resolvedAt);
      else await admin.deleteCached(key);
    }
  } catch (err) {
    deps.log(`[Resolve] denúncia não aplicada: ${(err as Error).message}`);
  }
  return { status: 200, body: { ok: true } };
}

const MAX_LOOKUP = 40;

/**
 * POST { lookup: [{ id, artist, title, duration }] }: which of these tracks already have a video in the shared cache.
 * One database read, no search and no quota: the app asks for the tracks on screen (and the next ones in the queue),
 * so tapping one that somebody already played starts at once, without waiting for the network.
 */
export async function lookupEndpoint(body: unknown, deps: ResolveDeps = defaultDeps()): Promise<EndpointResult> {
  const items = (body as { lookup?: unknown } | null)?.lookup;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LOOKUP) {
    return { status: 400, body: { error: `lookup deve ter de 1 a ${MAX_LOOKUP} faixas` } };
  }
  const tracks: { id: string; query: TrackQuery }[] = [];
  for (const item of items) {
    const { id, artist, title, duration } = (item ?? {}) as Record<string, unknown>;
    const a = readText(artist);
    const t = readText(title);
    const d = Number(duration);
    if (typeof id !== 'string' || !CATALOG_ID.test(id) || !a || !t || !Number.isFinite(d) || d <= 0 || d > MAX_TRACK_DURATION_SECONDS) {
      return { status: 400, body: { error: 'faixa inválida em lookup' } };
    }
    tracks.push({ id, query: { artist: a, title: t, duration: d } });
  }

  const noStore = 'private, no-store';
  if (!deps.admin) return { status: 200, body: { found: {} }, cacheControl: noStore };
  try {
    const keysByTrack = tracks.map((track) => cacheKeysFor(track.query, track.id));
    const cached = await deps.admin.getCachedMany([...new Set(keysByTrack.flat())]);
    const found: Record<string, string[]> = {};
    tracks.forEach((track, index) => {
      const hit = freshEntry(cached, keysByTrack[index], deps.now());
      if (hit && hit.videoIds.length > 0) found[track.id] = hit.videoIds;
    });
    return { status: 200, body: { found }, cacheControl: noStore };
  } catch (err) {
    deps.log(`[Resolve] consulta ao cache indisponível (${(err as Error).message})`);
    return { status: 200, body: { found: {} }, cacheControl: noStore };
  }
}

/** GET ?usage=1: how many new tracks the user has brought in today. */
export async function usageEndpoint(user: AuthUser | null, deps: ResolveDeps = defaultDeps()): Promise<EndpointResult> {
  if (!deps.admin || !user) return { status: 200, body: { enabled: false }, cacheControl: 'private, no-store' };
  try {
    const used = await deps.admin.usedToday(user.id, deps.now());
    return { status: 200, body: { enabled: true, used, limit: deps.dailyLimit }, cacheControl: 'private, no-store' };
  } catch {
    return { status: 200, body: { enabled: false }, cacheControl: 'private, no-store' };
  }
}

/** One entry for both hosts (Vercel and the Express server). */
export function resolveRoute(
  req: { method?: string; query: Record<string, unknown>; body?: unknown },
  user: AuthUser | null,
  deps?: ResolveDeps
): Promise<EndpointResult> {
  if (req.method === 'POST') {
    return (req.body as { lookup?: unknown } | null)?.lookup !== undefined ? lookupEndpoint(req.body, deps) : reportBadVideoEndpoint(req.body, deps);
  }
  if (req.query.usage !== undefined) return usageEndpoint(user, deps);
  return resolveEndpoint(req.query, user, deps);
}
