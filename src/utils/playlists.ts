import type { Track } from '../types/music';
import { isStoredTrack } from './likedTracks';

export const PLAYLISTS_KEY = 'aurastream_playlists';
export const MAX_PLAYLISTS = 100;
export const MAX_TRACKS_PER_PLAYLIST = 500;
export const MAX_NAME_LENGTH = 60;

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  /** Whole tracks, so a playlist plays even when a track no longer shows up in any feed. */
  tracks: Track[];
}

/** A name as typed: trimmed, inner spaces collapsed, cut at the limit. */
export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

const isPlaylist = (value: unknown): value is { id: string; name: string; createdAt?: unknown; tracks: unknown[] } => {
  const p = value as { id?: unknown; name?: unknown; tracks?: unknown } | null;
  return Boolean(p && typeof p.id === 'string' && p.id && typeof p.name === 'string' && cleanName(p.name) && Array.isArray(p.tracks));
};

/** The saved playlists, dropping anything malformed (and tracks of integrations that no longer exist). */
export function loadPlaylists(storage: Pick<Storage, 'getItem'>): Playlist[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PLAYLISTS_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPlaylist).slice(0, MAX_PLAYLISTS).map((p) => ({
      id: p.id,
      name: cleanName(p.name),
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : 0,
      tracks: p.tracks.filter(isStoredTrack).slice(0, MAX_TRACKS_PER_PLAYLIST)
    }));
  } catch {
    return [];
  }
}

/** Storage that refuses (private mode, full) is not an error: the playlists then last for this session. */
export function savePlaylists(storage: Pick<Storage, 'setItem'>, playlists: Playlist[]): void {
  try {
    storage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  } catch {
    // keep going
  }
}

/** A new empty playlist at the end of the list; an empty name becomes "Playlist N". Null at the limit. */
export function createPlaylist(playlists: Playlist[], name: string, id: string, now: number): Playlist[] | null {
  if (playlists.length >= MAX_PLAYLISTS) return null;
  return [...playlists, { id, name: cleanName(name) || `Playlist ${playlists.length + 1}`, createdAt: now, tracks: [] }];
}

export function renamePlaylist(playlists: Playlist[], id: string, name: string): Playlist[] {
  const cleaned = cleanName(name);
  if (!cleaned) return playlists;
  return playlists.map((p) => (p.id === id ? { ...p, name: cleaned } : p));
}

export function deletePlaylist(playlists: Playlist[], id: string): Playlist[] {
  return playlists.filter((p) => p.id !== id);
}

export function playlistHasTrack(playlist: Playlist | undefined, trackId: string): boolean {
  return Boolean(playlist?.tracks.some((t) => t.id === trackId));
}

/** Adds at the end; a track already there, or a full playlist, leaves it as it was. */
export function addTrackToPlaylist(playlists: Playlist[], id: string, track: Track): Playlist[] {
  return playlists.map((p) =>
    p.id !== id || playlistHasTrack(p, track.id) || p.tracks.length >= MAX_TRACKS_PER_PLAYLIST
      ? p
      : { ...p, tracks: [...p.tracks, track] }
  );
}

export function removeTrackFromPlaylist(playlists: Playlist[], id: string, trackId: string): Playlist[] {
  return playlists.map((p) => (p.id === id ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p));
}
