import type { Track } from '../types/music';

/** Where the user is inside the Library tab; null is the menu of sections. */
export type LibraryView =
  | { kind: 'songs' }
  | { kind: 'downloads' }
  | { kind: 'artists' }
  | { kind: 'albums' }
  | { kind: 'artist'; name: string }
  | { kind: 'album'; name: string; artist: string };

export interface LibraryGroup {
  name: string;
  /** Second line of the row: the artist of an album. */
  detail?: string;
  coverUrl: string;
  tracks: Track[];
}

const byName = (a: LibraryGroup, b: LibraryGroup) => a.name.localeCompare(b.name, 'pt-BR');

function group(tracks: Track[], keyOf: (track: Track) => string, build: (track: Track) => Omit<LibraryGroup, 'tracks'>): LibraryGroup[] {
  const groups = new Map<string, LibraryGroup>();
  for (const track of tracks) {
    const key = keyOf(track);
    const existing = groups.get(key);
    if (existing) existing.tracks.push(track);
    else groups.set(key, { ...build(track), tracks: [track] });
  }
  return [...groups.values()].sort(byName);
}

export function groupByArtist(tracks: Track[]): LibraryGroup[] {
  return group(tracks, (t) => t.artist.toLowerCase(), (t) => ({ name: t.artist, coverUrl: t.coverUrl }));
}

export function groupByAlbum(tracks: Track[]): LibraryGroup[] {
  return group(
    tracks,
    (t) => `${t.album.toLowerCase()}\u0000${t.artist.toLowerCase()}`,
    (t) => ({ name: t.album, detail: t.artist, coverUrl: t.coverUrl })
  );
}

export function libraryTitle(view: LibraryView | null): string {
  switch (view?.kind) {
    case 'songs': return 'Favoritas';
    case 'downloads': return 'Downloads';
    case 'artists': return 'Artistas';
    case 'albums': return 'Álbuns';
    case 'artist': return view.name;
    case 'album': return view.name;
    default: return 'Biblioteca';
  }
}

/** The screen one level up: artists and albums open from their lists, the rest from the menu. */
export function libraryParent(view: LibraryView): LibraryView | null {
  if (view.kind === 'artist') return { kind: 'artists' };
  if (view.kind === 'album') return { kind: 'albums' };
  return null;
}

export function tracksOf(view: LibraryView, liked: Track[], downloads: Track[]): Track[] {
  switch (view.kind) {
    case 'songs': return liked;
    case 'downloads': return downloads;
    case 'artist': return liked.filter((t) => t.artist.toLowerCase() === view.name.toLowerCase());
    case 'album':
      return liked.filter(
        (t) => t.album.toLowerCase() === view.name.toLowerCase() && t.artist.toLowerCase() === view.artist.toLowerCase()
      );
    default: return [];
  }
}
