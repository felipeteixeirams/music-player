import type { Track } from '../types/music';
import type { KeyValueStorage } from './scopedStorage';
import { isStoredTrack } from './likedTracks';

export const HISTORY_KEY = 'aurastream_play_history';
export const HISTORY_OUTBOX_KEY = 'aurastream_play_history_outbox';
export const HISTORY_CLEAR_KEY = 'aurastream_play_history_clear';

/** The account keeps this many plays (a database trigger trims the oldest); the device mirrors them. */
export const MAX_HISTORY = 500;
/** Plays that could not be sent yet are kept up to this many. */
const MAX_OUTBOX = 200;

export interface PlayEntry {
  track: Track;
  /** When it was played, in ms since the epoch. */
  playedAt: number;
}

type ReadStorage = Pick<KeyValueStorage, 'getItem'>;
type WriteStorage = Pick<KeyValueStorage, 'getItem' | 'setItem' | 'removeItem'>;

function readEntries(storage: ReadStorage, key: string): PlayEntry[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is PlayEntry => Boolean(entry) && typeof entry.playedAt === 'number' && isStoredTrack(entry.track)
    );
  } catch {
    return [];
  }
}

function writeEntries(storage: Pick<KeyValueStorage, 'setItem'>, key: string, entries: PlayEntry[]): void {
  try {
    storage.setItem(key, JSON.stringify(entries));
  } catch {
    // storage that refuses (private mode, full): the account still has them
  }
}

/** Plays as last known, newest first: what the account sent plus what this device played since. */
export const loadHistory = (storage: ReadStorage): PlayEntry[] => readEntries(storage, HISTORY_KEY);
export const loadOutbox = (storage: ReadStorage): PlayEntry[] => readEntries(storage, HISTORY_OUTBOX_KEY);

/** A play just happened: it shows up at once and waits to be sent. */
export function recordPlay(storage: WriteStorage, track: Track, playedAt: number): void {
  // Only catalog tracks have a place in the history (not live stations)
  if (!isStoredTrack(track)) return;
  const entry: PlayEntry = { track, playedAt };
  writeEntries(storage, HISTORY_KEY, [entry, ...loadHistory(storage)].slice(0, MAX_HISTORY));
  writeEntries(storage, HISTORY_OUTBOX_KEY, [...loadOutbox(storage), entry].slice(-MAX_OUTBOX));
}

/** The account's list replaces the device's, keeping on top what has not been sent yet. */
export function applyRemoteHistory(storage: WriteStorage, remote: PlayEntry[]): void {
  const pending = loadOutbox(storage);
  const merged = [...pending.slice().reverse(), ...remote].sort((a, b) => b.playedAt - a.playedAt);
  writeEntries(storage, HISTORY_KEY, merged.slice(0, MAX_HISTORY));
}

/** Drops from the outbox the plays that were sent (matched by track and time). */
export function markSent(storage: WriteStorage, sent: PlayEntry[]): void {
  const sentKeys = new Set(sent.map((e) => `${e.track.id}@${e.playedAt}`));
  writeEntries(storage, HISTORY_OUTBOX_KEY, loadOutbox(storage).filter((e) => !sentKeys.has(`${e.track.id}@${e.playedAt}`)));
}

export function requestClear(storage: WriteStorage): void {
  try {
    storage.removeItem(HISTORY_KEY);
    storage.removeItem(HISTORY_OUTBOX_KEY);
    storage.setItem(HISTORY_CLEAR_KEY, '1');
  } catch {
    // keep going
  }
}

export const isClearPending = (storage: ReadStorage): boolean => {
  try {
    return storage.getItem(HISTORY_CLEAR_KEY) === '1';
  } catch {
    return false;
  }
};

export function clearDone(storage: Pick<KeyValueStorage, 'removeItem'>): void {
  try {
    storage.removeItem(HISTORY_CLEAR_KEY);
  } catch {
    // keep going
  }
}

/** One row per track, the latest play of each, newest first: what "Reproduzidas recentemente" lists. */
export function distinctRecent(entries: PlayEntry[], limit = 100): Track[] {
  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const entry of entries) {
    if (seen.has(entry.track.id)) continue;
    seen.add(entry.track.id);
    tracks.push(entry.track);
    if (tracks.length >= limit) break;
  }
  return tracks;
}
