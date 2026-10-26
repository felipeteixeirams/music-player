import type { Track } from '../types/music';

export const LIKED_IDS_KEY = 'aurastream_liked_tracks';
export const LIKED_TRACKS_KEY = 'aurastream_liked_track_objects';

export interface LikedLibrary {
  /** Favorites with their metadata, shown in the library whatever the current feed holds. */
  tracks: Track[];
  /** Favorite ids saved before metadata was stored; they gain metadata when the track shows up again. */
  pendingIds: string[];
}

// Catalog ids still resolvable today; ids of the removed YouTube Music/Piped integrations are not.
const CATALOG_ID = /^(deezer|itunes)-\d+$/;

function parseArray(raw: string | null): unknown[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isStoredTrack(value: unknown): value is Track {
  const track = value as Partial<Track> | null;
  return Boolean(
    track
    && typeof track.id === 'string' && CATALOG_ID.test(track.id)
    && typeof track.title === 'string'
    && typeof track.artist === 'string'
    && typeof track.duration === 'number'
    && track.sources && typeof track.sources === 'object'
  );
}

export function loadLikedLibrary(storage: Pick<Storage, 'getItem'>): LikedLibrary {
  const tracks = parseArray(storage.getItem(LIKED_TRACKS_KEY)).filter(isStoredTrack);
  const known = new Set(tracks.map((track) => track.id));
  const pendingIds = parseArray(storage.getItem(LIKED_IDS_KEY)).filter(
    (id): id is string => typeof id === 'string' && CATALOG_ID.test(id) && !known.has(id)
  );
  return { tracks, pendingIds };
}

export function toggleLikedTrack(library: LikedLibrary, track: Track): LikedLibrary {
  const liked = library.tracks.some((t) => t.id === track.id) || library.pendingIds.includes(track.id);
  if (liked) {
    return {
      tracks: library.tracks.filter((t) => t.id !== track.id),
      pendingIds: library.pendingIds.filter((id) => id !== track.id)
    };
  }
  return { tracks: [...library.tracks, track], pendingIds: library.pendingIds };
}

/** Gives metadata to pending favorites found among `seen`; returns the same object when nothing changes. */
export function hydrateLikedLibrary(library: LikedLibrary, seen: Track[]): LikedLibrary {
  if (library.pendingIds.length === 0) return library;
  const found = seen.filter((track) => library.pendingIds.includes(track.id));
  if (found.length === 0) return library;

  const foundIds = new Set(found.map((track) => track.id));
  return {
    tracks: [...library.tracks, ...found.filter((track, index) => found.findIndex((t) => t.id === track.id) === index)],
    pendingIds: library.pendingIds.filter((id) => !foundIds.has(id))
  };
}

export function likedIds(library: LikedLibrary): string[] {
  return [...library.tracks.map((track) => track.id), ...library.pendingIds];
}
