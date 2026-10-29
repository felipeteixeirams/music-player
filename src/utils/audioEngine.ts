import { AudioEngineType, RepeatMode, Track } from '../types/music';
import { apiFetch } from './apiFetch';
import { ResolvedStore } from './resolvedStore';
import { createLookupQueue } from './resolvePrefetch';
import { logPlayback } from './playbackDiagnostics';
import { createWarmQueue, type WarmResult } from './warmResolve';

/**
 * Formats a duration in seconds into MM:SS format (e.g. 214 -> "03:34")
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Formats remaining time (e.g. -02:15)
 */
export function formatRemainingTime(currentTime: number, duration: number): string {
  if (isNaN(duration) || duration <= 0) return '-00:00';
  const remaining = Math.max(0, duration - currentTime);
  return `-${formatTime(remaining)}`;
}

/**
 * Calculates current playback progress as a percentage between 0 and 100.
 */
export function calculateProgress(currentTime: number, duration: number): number {
  if (isNaN(currentTime) || isNaN(duration) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}

/**
 * Converts a percentage (0 to 100) back into seconds.
 */
export function progressToSeconds(percentage: number, duration: number): number {
  if (isNaN(percentage) || isNaN(duration) || duration <= 0) return 0;
  return (Math.max(0, Math.min(100, percentage)) / 100) * duration;
}

/**
 * Computes the next track index given queue length, repeat mode, and shuffle status.
 */
export function getNextTrackIndex(
  currentIndex: number,
  totalTracks: number,
  isShuffle: boolean,
  repeatMode: RepeatMode
): number {
  if (totalTracks <= 0) return -1;
  if (totalTracks === 1) return 0;

  if (repeatMode === 'one') {
    return currentIndex;
  }

  if (isShuffle) {
    // Pick random index different from current
    let nextIndex = Math.floor(Math.random() * totalTracks);
    if (nextIndex === currentIndex) {
      nextIndex = (currentIndex + 1) % totalTracks;
    }
    return nextIndex;
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex >= totalTracks) {
    return repeatMode === 'all' ? 0 : -1;
  }
  return nextIndex;
}

/**
 * Computes the previous track index.
 */
export function getPreviousTrackIndex(currentIndex: number, totalTracks: number): number {
  if (totalTracks <= 0) return -1;
  if (totalTracks === 1) return 0;
  return (currentIndex - 1 + totalTracks) % totalTracks;
}

/**
 * Resolves optimal audio stream URL and engine for a given track and user preference.
 */
export function resolveAudioDetails(
  track: Track,
  preferredEngine: AudioEngineType
): { engine: AudioEngineType; url: string; fallbackAvailable: boolean } {
  if (preferredEngine === 'native' && track.sources.localUrl) {
    return {
      engine: 'native',
      url: track.sources.localUrl,
      fallbackAvailable: Boolean(track.sources.youtubeId)
    };
  }

  if (preferredEngine === 'fallback' && track.sources.youtubeId) {
    return {
      engine: 'fallback',
      url: `https://www.youtube.com/watch?v=${track.sources.youtubeId}`,
      fallbackAvailable: Boolean(track.sources.localUrl)
    };
  }

  // Default to native stream for immediate ultra-fast response
  if (track.sources.localUrl) {
    return {
      engine: 'native',
      url: track.sources.localUrl,
      fallbackAvailable: Boolean(track.sources.youtubeId)
    };
  }

  return {
    engine: 'fallback',
    url: track.sources.youtubeId ? `https://www.youtube.com/watch?v=${track.sources.youtubeId}` : '',
    fallbackAvailable: false
  };
}

/** The videos already known for a track: on this device (lasting), from the shared cache via `prefetchResolved`, or from a search. */
const resolved = new ResolvedStore(typeof localStorage !== 'undefined' ? localStorage : null);
/** Tracks the server answered "no video" for in this session: not asked again until the app restarts. */
const noVideoThisSession = new Set<string>();
/** A track being resolved right now: a second tap on it waits for the same answer instead of making another search. */
const resolving = new Map<string, Promise<FullTrackResolution>>();

export interface FullTrackResolution {
  videoIds: string[];
  /** The user's daily allowance of tracks nobody has played before is used up: no search was made. */
  quotaExceeded: boolean;
  /** Only for a warming request: what the server did. `skipped` means nothing was looked up (the answer says nothing about the track). */
  warm?: WarmResult;
}

/** The videos known without asking anyone; undefined when the track has to be asked about. */
export function knownVideoIds(trackId: string): string[] | undefined {
  return resolved.get(trackId);
}

/**
 * Finds the YouTube videos that play the full recording of a catalog track (Deezer), best first.
 * What is known on the device answers at once; otherwise the server answers from the shared cache or, for a track
 * nobody has played, from a search that counts against the user's daily allowance. Failures and "limit reached" are
 * not remembered.
 */
export function resolveFullTrack(track: Track, timeoutMs = 6000): Promise<FullTrackResolution> {
  const known = resolved.get(track.id);
  if (known) return Promise.resolve({ videoIds: known, quotaExceeded: false });
  if (noVideoThisSession.has(track.id)) return Promise.resolve({ videoIds: [], quotaExceeded: false });

  const inFlight = resolving.get(track.id);
  // A tap that meets a warming request still on its way waits for it; if warming was refused (it said nothing about the
  // track), the tap asks for itself
  if (inFlight) return inFlight.then((result) => (result.warm === 'skipped' || result.warm === 'failed' ? resolveFullTrack(track, timeoutMs) : result));

  const request = fetchResolution(track, timeoutMs).finally(() => resolving.delete(track.id));
  resolving.set(track.id, request);
  return request;
}

async function fetchResolution(track: Track, timeoutMs: number, warm = false): Promise<FullTrackResolution> {
  try {
    const params = new URLSearchParams({
      id: track.id,
      artist: track.artist,
      title: track.title,
      duration: String(track.duration)
    });
    if (warm) params.set('warm', '1');
    const response = await apiFetch(`/api/resolve?${params}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { videoIds: [], quotaExceeded: false, ...(warm ? { warm: 'failed' as const } : {}) };

    const data = (await response.json()) as { videoIds?: unknown; quota?: { exceeded?: unknown }; warm?: unknown } | null;
    if (warm && data?.warm === 'skipped') return { videoIds: [], quotaExceeded: false, warm: 'skipped' };
    if (data?.quota?.exceeded === true) return { videoIds: [], quotaExceeded: true };
    const ids = Array.isArray(data?.videoIds)
      ? data.videoIds.filter((id): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id))
      : [];
    if (ids.length > 0) resolved.set(track.id, ids);
    else noVideoThisSession.add(track.id);
    return { videoIds: ids, quotaExceeded: false, ...(warm ? { warm: data?.warm === 'cached' ? ('cached' as const) : ('searched' as const) } : {}) };
  } catch {
    return { videoIds: [], quotaExceeded: false, ...(warm ? { warm: 'failed' as const } : {}) };
  }
}

export async function resolveFullTrackVideoIds(track: Track, timeoutMs = 6000): Promise<string[]> {
  return (await resolveFullTrack(track, timeoutMs)).videoIds;
}

const lookupQueue = createLookupQueue({
  isKnown: (id) => resolved.get(id) !== undefined,
  onFound: (id, ids) => resolved.set(id, ids),
  send: async (items) => {
    const response = await apiFetch('/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lookup: items })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as { found?: Record<string, unknown> } | null;
    const found: Record<string, string[]> = {};
    for (const [id, ids] of Object.entries(data?.found ?? {})) {
      if (Array.isArray(ids)) found[id] = ids.filter((v): v is string => typeof v === 'string');
    }
    return found;
  }
});

/**
 * Asks, for the tracks about to be shown or played next, which already have a video in the shared cache, and keeps
 * what comes back. Tapping one of them then starts at once, with no wait for the network (which is what lets iOS
 * accept the start). It never searches and never counts against the quota.
 */
export function prefetchResolved(tracks: Track[]): void {
  lookupQueue.enqueue(
    tracks
      .filter((track) => /^(deezer|itunes)-\d+$/.test(track.id) && !track.sources.youtubeId && !track.sources.localUrl)
      .map((track) => ({ id: track.id, artist: track.artist, title: track.title, duration: track.duration }))
  );
}

const WARM_STOP_KEY = 'aurastream_warm_stop';
const warmQueue = createWarmQueue<Track>({
  isKnown: (id) => resolved.get(id) !== undefined || noVideoThisSession.has(id) || resolving.has(id),
  warm: async (track) => {
    const request = fetchResolution(track, 8000, true).finally(() => resolving.delete(track.id));
    resolving.set(track.id, request);
    const result = await request;
    logPlayback(`pré-resolução de "${track.title}": ${result.warm ?? 'falhou'}${result.videoIds.length > 0 ? ' (vídeo conhecido antes do toque)' : ''}`);
    return result.warm ?? 'failed';
  },
  canRun: () =>
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible' &&
    navigator.onLine !== false &&
    !(navigator as { connection?: { saveData?: boolean } }).connection?.saveData,
  today: () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }),
  stoppedDay: {
    get: () => {
      try {
        return localStorage.getItem(WARM_STOP_KEY);
      } catch {
        return null;
      }
    },
    set: (day) => {
      try {
        localStorage.setItem(WARM_STOP_KEY, day);
      } catch {
        // the server says it again
      }
    }
  }
});

/**
 * Looks up, ahead of the tap and in idle time, the videos of tracks the person is likely to play (see `warmResolve.ts`):
 * the next ones in the queue (`first`) and the first of each personal card. One at a time, a few per session; the server
 * keeps part of the daily allowance for taps and refuses warming beyond it. Off unless the build sets
 * `VITE_WARM_RESOLVE=1` (decision of 2026-10-29: it spent searches on tracks nobody tapped).
 */
export function warmResolve(tracks: Track[], first = false): void {
  if (import.meta.env.VITE_WARM_RESOLVE !== '1') return;
  warmQueue.enqueue(
    tracks.filter((track) => /^(deezer|itunes)-\d+$/.test(track.id) && !track.sources.youtubeId && !track.sources.localUrl),
    first
  );
}

/**
 * Tells the server that a video it handed out would not play (blocked, removed), so the shared cache drops it and
 * the next play searches again. Fire and forget: a failed report only means the bad id lives a little longer.
 */
export function reportBrokenVideo(track: Track, videoId: string): void {
  resolved.delete(track.id);
  void apiFetch('/api/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: track.id, videoId, artist: track.artist, title: track.title, duration: track.duration })
  }).catch(() => undefined);
}
