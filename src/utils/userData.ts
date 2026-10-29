import type { PodcastShowSummary, Track } from '../types/music';
import type { KeyValueStorage } from './scopedStorage';
import { LIKED_IDS_KEY, LIKED_TRACKS_KEY, loadLikedLibrary } from './likedTracks';
import { loadPlaylists, PLAYLISTS_KEY, savePlaylists, type Playlist } from './playlists';
import { loadChoices, VIDEO_CHOICE_KEY } from './videoChoice';
import { loadFollows, saveFollows } from './podcastFollows';

/** What belongs to the account: the favorites, the playlists, the "Outra versão" picks and the podcasts followed. */
export interface UserDataSnapshot {
  favorites: Track[];
  playlists: Playlist[];
  choices: Record<string, string>;
  podcasts: PodcastShowSummary[];
}

/** Set while this device holds changes the account does not have yet: 'local' (send them) or 'merge' (first sign-in with old data). */
export const SYNC_FLAG_KEY = 'aurastream_sync_pending';
export type SyncFlag = 'local' | 'merge';

export const EMPTY_SNAPSHOT: UserDataSnapshot = { favorites: [], playlists: [], choices: {}, podcasts: [] };

export function readSnapshot(storage: Pick<KeyValueStorage, 'getItem'>): UserDataSnapshot {
  return {
    favorites: loadLikedLibrary(storage).tracks,
    playlists: loadPlaylists(storage),
    choices: loadChoices(storage),
    podcasts: loadFollows(storage)
  };
}

export function writeSnapshot(storage: Pick<KeyValueStorage, 'setItem'>, snapshot: UserDataSnapshot): void {
  try {
    storage.setItem(LIKED_TRACKS_KEY, JSON.stringify(snapshot.favorites));
    storage.setItem(VIDEO_CHOICE_KEY, JSON.stringify(snapshot.choices));
  } catch {
    // storage that refuses (private mode, full): the account still has the data
  }
  savePlaylists(storage, snapshot.playlists);
  saveFollows(storage, snapshot.podcasts);
}

/** Equal keys mean nothing for the account differs (track details apart: only ids, names, order and picks count). */
export function snapshotKey(snapshot: UserDataSnapshot): string {
  return JSON.stringify([
    snapshot.favorites.map((track) => track.id),
    snapshot.playlists.map((p) => [p.id, p.name, p.createdAt, p.tracks.map((t) => t.id)]),
    Object.entries(snapshot.choices).sort(([a], [b]) => (a < b ? -1 : 1)),
    snapshot.podcasts.map((show) => show.id)
  ]);
}

export function readSyncFlag(storage: Pick<KeyValueStorage, 'getItem'>): SyncFlag | null {
  try {
    const value = storage.getItem(SYNC_FLAG_KEY);
    return value === 'local' || value === 'merge' ? value : null;
  } catch {
    return null;
  }
}

export function writeSyncFlag(storage: Pick<KeyValueStorage, 'setItem' | 'removeItem'>, flag: SyncFlag | null): void {
  try {
    if (flag) storage.setItem(SYNC_FLAG_KEY, flag);
    else storage.removeItem(SYNC_FLAG_KEY);
  } catch {
    // keep going
  }
}

export interface SnapshotDiff {
  favoriteUpserts: Track[];
  favoriteRemovals: string[];
  playlistUpserts: { id: string; name: string; createdAt: number }[];
  playlistRemovals: string[];
  playlistTrackUpserts: { playlistId: string; track: Track; position: number }[];
  playlistTrackRemovals: { playlistId: string; trackIds: string[] }[];
  choiceUpserts: { trackId: string; videoId: string }[];
  choiceRemovals: string[];
  podcastUpserts: PodcastShowSummary[];
  podcastRemovals: string[];
}

/** What it takes to turn `from` (what the account holds) into `to` (what the device holds). */
export function diffSnapshots(from: UserDataSnapshot, to: UserDataSnapshot): SnapshotDiff {
  const diff: SnapshotDiff = {
    favoriteUpserts: [],
    favoriteRemovals: [],
    playlistUpserts: [],
    playlistRemovals: [],
    playlistTrackUpserts: [],
    playlistTrackRemovals: [],
    choiceUpserts: [],
    choiceRemovals: [],
    podcastUpserts: [],
    podcastRemovals: []
  };

  const fromFavorites = new Set(from.favorites.map((t) => t.id));
  const toFavorites = new Set(to.favorites.map((t) => t.id));
  diff.favoriteUpserts = to.favorites.filter((t) => !fromFavorites.has(t.id));
  diff.favoriteRemovals = from.favorites.filter((t) => !toFavorites.has(t.id)).map((t) => t.id);

  const fromPlaylists = new Map(from.playlists.map((p) => [p.id, p]));
  const toIds = new Set(to.playlists.map((p) => p.id));
  diff.playlistRemovals = from.playlists.filter((p) => !toIds.has(p.id)).map((p) => p.id);
  for (const playlist of to.playlists) {
    const before = fromPlaylists.get(playlist.id);
    if (!before || before.name !== playlist.name) {
      diff.playlistUpserts.push({ id: playlist.id, name: playlist.name, createdAt: playlist.createdAt });
    }
    const beforePositions = new Map((before?.tracks ?? []).map((t, index) => [t.id, index]));
    playlist.tracks.forEach((track, position) => {
      if (beforePositions.get(track.id) !== position) diff.playlistTrackUpserts.push({ playlistId: playlist.id, track, position });
    });
    if (before) {
      const nowIds = new Set(playlist.tracks.map((t) => t.id));
      const gone = before.tracks.filter((t) => !nowIds.has(t.id)).map((t) => t.id);
      if (gone.length > 0) diff.playlistTrackRemovals.push({ playlistId: playlist.id, trackIds: gone });
    }
  }

  for (const [trackId, videoId] of Object.entries(to.choices)) {
    if (from.choices[trackId] !== videoId) diff.choiceUpserts.push({ trackId, videoId });
  }
  diff.choiceRemovals = Object.keys(from.choices).filter((trackId) => !(trackId in to.choices));

  const fromShows = new Set(from.podcasts.map((show) => show.id));
  const toShows = new Set(to.podcasts.map((show) => show.id));
  diff.podcastUpserts = to.podcasts.filter((show) => !fromShows.has(show.id));
  diff.podcastRemovals = from.podcasts.filter((show) => !toShows.has(show.id)).map((show) => show.id);
  return diff;
}

export function isEmptyDiff(diff: SnapshotDiff): boolean {
  return Object.values(diff).every((part) => part.length === 0);
}

/** Everything from both, the account's order first; used once, when a device with old data signs in. */
export function mergeSnapshots(local: UserDataSnapshot, remote: UserDataSnapshot): UserDataSnapshot {
  const favoriteIds = new Set(remote.favorites.map((t) => t.id));
  const favorites = [...remote.favorites, ...local.favorites.filter((t) => !favoriteIds.has(t.id))];

  const playlists = remote.playlists.map((playlist) => {
    const mine = local.playlists.find((p) => p.id === playlist.id);
    if (!mine) return playlist;
    const ids = new Set(playlist.tracks.map((t) => t.id));
    return { ...playlist, tracks: [...playlist.tracks, ...mine.tracks.filter((t) => !ids.has(t.id))] };
  });
  const remoteIds = new Set(remote.playlists.map((p) => p.id));
  playlists.push(...local.playlists.filter((p) => !remoteIds.has(p.id)));

  const showIds = new Set(remote.podcasts.map((show) => show.id));
  const podcasts = [...remote.podcasts, ...local.podcasts.filter((show) => !showIds.has(show.id))];

  return { favorites, playlists, choices: { ...remote.choices, ...local.choices }, podcasts };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function randomUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Podcast follows did not exist before the accounts: there is nothing legacy to adopt
const LEGACY_KEYS = [LIKED_IDS_KEY, LIKED_TRACKS_KEY, PLAYLISTS_KEY, VIDEO_CHOICE_KEY];

/**
 * Before accounts the data lived under plain keys. The first person to sign in on the device takes it over (it
 * is theirs: they used the app before), and the plain keys go away so nobody else inherits it. Returns whether
 * anything was taken, in which case it will be merged into the account on the first sync.
 */
export function adoptLegacyData(legacy: KeyValueStorage, scoped: KeyValueStorage): boolean {
  try {
    if (!LEGACY_KEYS.some((key) => legacy.getItem(key) !== null)) return false;
    if (LEGACY_KEYS.some((key) => scoped.getItem(key) !== null)) return false;

    const snapshot = readSnapshot(legacy);
    // Playlist ids are uuids in the account; very old ones were not
    snapshot.playlists = snapshot.playlists.map((p) => (UUID.test(p.id) ? p : { ...p, id: randomUuid() }));
    writeSnapshot(scoped, snapshot);
    const pending = legacy.getItem(LIKED_IDS_KEY);
    if (pending !== null) scoped.setItem(LIKED_IDS_KEY, pending);
    LEGACY_KEYS.forEach((key) => legacy.removeItem(key));

    const hasData = snapshot.favorites.length > 0 || snapshot.playlists.length > 0 || Object.keys(snapshot.choices).length > 0;
    if (hasData) writeSyncFlag(scoped, 'merge');
    return hasData;
  } catch {
    return false;
  }
}

