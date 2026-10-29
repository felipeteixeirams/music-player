import type { EpisodeRef } from './podcastTrack';

/** Where the person stopped in each podcast episode, so the episode resumes there. Kept per account on the device. */
export const PODCAST_PROGRESS_KEY = 'aurastream_podcast_progress';

export interface EpisodeProgress {
  /** Seconds listened up to. */
  position: number;
  /** The episode's length when it was last known (0 when unknown). */
  duration: number;
  updatedAt: number;
  /** Listened to the end (or to the last moments): shown as played, and playing it again starts over. */
  done?: boolean;
  /** The episode itself (title, cover, audio file), for "Continue ouvindo". */
  episode?: EpisodeRef;
}

export type ProgressMap = Record<string, EpisodeProgress>;
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

/** Below this the episode starts from the beginning instead of "resuming" at a few seconds. */
export const MIN_RESUME_SECONDS = 10;
/** Within this much of the end (or a tenth of a very short episode) an episode counts as listened to. */
export const DONE_WITHIN_SECONDS = 20;
const doneWithin = (duration: number): number => Math.min(DONE_WITHIN_SECONDS, duration * 0.1);
const MAX_ENTRIES = 300;

export function isEpisodeRef(value: unknown): value is EpisodeRef {
  const ref = value as Partial<EpisodeRef> | null;
  return Boolean(ref && typeof ref.title === 'string' && typeof ref.showId === 'string' && typeof ref.audioUrl === 'string' && typeof ref.showTitle === 'string');
}

export function readProgress(storage: Storage | null): ProgressMap {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(PODCAST_PROGRESS_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: ProgressMap = {};
    for (const [id, value] of Object.entries(parsed as Record<string, Partial<EpisodeProgress>>)) {
      if (typeof value?.position === 'number' && value.position >= 0 && typeof value.updatedAt === 'number') {
        result[id] = {
          position: value.position,
          duration: typeof value.duration === 'number' ? value.duration : 0,
          updatedAt: value.updatedAt,
          ...(value.done ? { done: true } : {}),
          ...(isEpisodeRef(value.episode) ? { episode: value.episode } : {})
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Remembers where an episode stands; one that reached its end is marked done. Returns the new map. */
export function saveProgress(storage: Storage | null, id: string, position: number, duration: number, now: number = Date.now(), episode?: EpisodeRef | null): ProgressMap {
  const map = readProgress(storage);
  const keep = episode ?? map[id]?.episode;
  const done = duration > 0 && position >= duration - doneWithin(duration);
  map[id] = { position: done ? 0 : Math.max(0, Math.round(position)), duration: Math.max(0, Math.round(duration)), updatedAt: now, ...(done ? { done: true } : {}), ...(keep ? { episode: keep } : {}) };
  dirty.add(id);
  const entries = Object.entries(map);
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
    return write(storage, Object.fromEntries(entries.slice(0, MAX_ENTRIES)));
  }
  return write(storage, map);
}

const listeners = new Set<() => void>();
let version = 0;
/** Episodes saved here since the account last got them (for the sync). */
const dirty = new Set<string>();

/** The episodes to send to the account, and forgets them. */
export function takeDirty(): string[] {
  const ids = [...dirty];
  dirty.clear();
  return ids;
}

/** Gives the ids back (the send failed), to be tried again. */
export function markDirty(ids: string[]): void {
  ids.forEach((id) => dirty.add(id));
}

/** The account's entries: each one newer than what is here replaces it. Returns the ids that changed. */
export function applyRemoteProgress(storage: Storage | null, remote: ProgressMap): string[] {
  const map = readProgress(storage);
  const changed: string[] = [];
  for (const [id, entry] of Object.entries(remote)) {
    if (!map[id] || entry.updatedAt > map[id].updatedAt) {
      map[id] = entry;
      changed.push(id);
    }
  }
  if (changed.length === 0) return changed;
  const entries = Object.entries(map);
  const kept = entries.length > MAX_ENTRIES ? Object.fromEntries(entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, MAX_ENTRIES)) : map;
  write(storage, kept);
  return changed;
}

/** For screens that show the progress: told after every save. */
export function subscribeProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Changes after every save, so a screen can tell when to read the map again. */
export const progressVersion = (): number => version;

function write(storage: Storage | null, map: ProgressMap): ProgressMap {
  try {
    storage?.setItem(PODCAST_PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // storage that refuses (private mode, full): the progress lasts for this session only
  }
  version += 1;
  listeners.forEach((listener) => listener());
  return map;
}

/** Where to start an episode: its saved position, or 0 when none, too early to matter or already listened to. */
export function resumePosition(progress: EpisodeProgress | undefined): number {
  if (!progress || progress.done || progress.position < MIN_RESUME_SECONDS) return 0;
  return progress.position;
}

/** The share of the episode listened to, 0..1 (1 when done). */
export function progressShare(progress: EpisodeProgress | undefined, fallbackDuration = 0): number {
  if (!progress) return 0;
  if (progress.done) return 1;
  const length = progress.duration || fallbackDuration;
  return length > 0 ? Math.min(1, progress.position / length) : 0;
}
