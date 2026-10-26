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

/** The track's catalog id; clients from before it was sent are keyed by a hash of what they do send. */
export function cacheKeyFor(query: TrackQuery, id: unknown): string {
  if (typeof id === 'string' && CATALOG_ID.test(id)) return id;
  const text = `${query.artist.toLowerCase()}|${query.title.toLowerCase()}|${Math.round(query.duration / 5)}`;
  return `h-${createHash('sha1').update(text).digest('hex').slice(0, 24)}`;
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
  const key = cacheKeyFor(track, query.id);
  const { admin, now } = deps;
  const noStore = 'private, no-store';

  if (admin) {
    try {
      const cached = await admin.getCached(key);
      if (cached) {
        const age = now() - cached.resolvedAt;
        if (age < (cached.videoIds.length > 0 ? FOUND_TTL_MS : MISS_TTL_MS)) {
          return { status: 200, body: { videoIds: cached.videoIds }, cacheControl: noStore };
        }
      }
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
    await admin.putCached(key, result.videoIds, now()).catch((err: Error) => deps.log(`[Resolve] cache não gravado: ${err.message}`));
  }
  return { status: 200, body: { videoIds: result.videoIds, ...(quota ? { quota } : {}) }, cacheControl: noStore };
}

/** POST: the player could not play a video that came from the cache; drop it so the next play searches again. */
export async function reportBadVideoEndpoint(body: unknown, deps: ResolveDeps = defaultDeps()): Promise<EndpointResult> {
  const { id, videoId } = (body ?? {}) as { id?: unknown; videoId?: unknown };
  if (typeof id !== 'string' || !CATALOG_ID.test(id) || typeof videoId !== 'string' || !VIDEO_ID.test(videoId)) {
    return { status: 400, body: { error: 'id e videoId inválidos' } };
  }
  const { admin } = deps;
  if (!admin) return { status: 200, body: { ok: true } };
  try {
    const cached = await admin.getCached(id);
    if (cached?.videoIds.includes(videoId)) {
      const rest = cached.videoIds.filter((v) => v !== videoId);
      if (rest.length > 0) await admin.putCached(id, rest, cached.resolvedAt);
      else await admin.deleteCached(id);
    }
  } catch (err) {
    deps.log(`[Resolve] denúncia não aplicada: ${(err as Error).message}`);
  }
  return { status: 200, body: { ok: true } };
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
  if (req.method === 'POST') return reportBadVideoEndpoint(req.body, deps);
  if (req.query.usage !== undefined) return usageEndpoint(user, deps);
  return resolveEndpoint(req.query, user, deps);
}
