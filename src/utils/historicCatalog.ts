import type { AlbumPage, AlbumSummary, Track } from '../types/music';
import { baseTitle, SERIES_ALIASES } from './historicNames';

/** One compilation (one CD) of the historic catalog, as listed in public/historic/index.json. */
export interface HistoricEntry {
  /** `m<id>` for a master, `r<id>` for a release on Discogs (the two number spaces are separate). */
  id: string;
  title: string;
  base: string;
  year: number | null;
  catno: string | null;
  tracks: number;
  matched: number;
}

/** A track as the generator wrote it: `deezerId` is null when the Deezer catalog has no exact match. */
interface HistoricTrackRecord {
  position: string;
  title: string;
  artist: string | null;
  duration: string | null;
  deezerId: number | null;
}

export interface HistoricRecord extends Omit<HistoricEntry, 'tracks'> {
  label: string;
  country: string | null;
  tracks: HistoricTrackRecord[];
}

const MIN_QUERY = 4;
let indexRequest: Promise<HistoricEntry[]> | null = null;

/** The index, loaded once per session the first time a search needs it. A failure is an empty catalog, not an error. */
export function loadHistoricIndex(): Promise<HistoricEntry[]> {
  indexRequest ??= fetch('/historic/index.json')
    .then((response) => (response.ok ? (response.json() as Promise<{ compilations: HistoricEntry[] }>) : null))
    .then((data) => data?.compilations ?? [])
    .catch(() => []);
  return indexRequest;
}

/**
 * The compilations a search names, and only those. The whole search term must be the series name (with a volume, an
 * edition or a year allowed around it): "good times" and "classic metal 2" match, "good times bee gees" and
 * "metallica classic metal" do not, so an artist search never turns into a CD.
 */
export function findHistoricMatches(query: string, entries: HistoricEntry[]): HistoricEntry[] {
  const wanted = baseTitle(query);
  if (wanted.length < MIN_QUERY) return [];
  const series = SERIES_ALIASES[wanted] ?? wanted;
  return entries.filter((entry) => entry.base === series).sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
}

const loadedRecords = new Map<string, Promise<HistoricRecord | null>>();

/** One compilation's tracks, loaded when its card is shown. */
export function loadHistoricRecord(id: string): Promise<HistoricRecord | null> {
  let request = loadedRecords.get(id);
  if (!request) {
    request = fetch(`/historic/t/${id}.json`)
      .then((response) => (response.ok ? (response.json() as Promise<HistoricRecord>) : null))
      .catch(() => null);
    loadedRecords.set(id, request);
  }
  return request;
}

/** "5:41" to seconds; 0 when the release does not say (the player then uses what it finds). */
export function durationSeconds(text: string | null): number {
  const match = /^(\d+):(\d{1,2})$/.exec(text ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

/**
 * The app's track for one line of a compilation. A track with a Deezer id is the catalog's track (preview and
 * playback work as for any track); the others keep a local id and play by title and artist, as before.
 */
export function historicTrack(record: HistoricRecord, line: HistoricTrackRecord): Track {
  const id = line.deezerId ? `deezer-${line.deezerId}` : `historic-${record.id}-${line.position}`;
  return {
    id,
    title: line.title,
    artist: line.artist ?? 'Vários artistas',
    album: `${record.title} (${record.label})`,
    duration: durationSeconds(line.duration),
    coverUrl: '',
    style: 'Coletânea Histórica',
    categoryId: 'rock',
    sources: { localUrl: '', previewUrl: '' },
    releaseYear: record.year ?? undefined
  };
}

/** A CD as the album screen shows it: the same page as an album (cover, tracks, play, shuffle). */
export const HISTORIC_ALBUM_PREFIX = 'historic-';

export function historicAlbumSummary(entry: HistoricEntry): AlbumSummary {
  return {
    id: `${HISTORIC_ALBUM_PREFIX}${entry.id}`,
    title: entry.title,
    artist: 'Som Livre',
    coverUrl: '',
    year: entry.year ?? 0,
    kind: 'album',
    trackCount: entry.tracks
  };
}

/** The album page of a CD: its tracks from the catalog file. Throws when the file cannot be read (the page says so). */
export async function loadHistoricAlbumPage(albumId: string): Promise<AlbumPage> {
  const record = await loadHistoricRecord(albumId.slice(HISTORIC_ALBUM_PREFIX.length));
  if (!record) throw new Error('Não foi possível carregar este CD agora.');
  const tracks = record.tracks.map((line) => historicTrack(record, line));
  return {
    album: historicAlbumSummary({ id: record.id, title: record.title, base: record.base, year: record.year, catno: record.catno, tracks: record.tracks.length, matched: record.matched }),
    tracks: { tracks, total: tracks.length, nextIndex: null }
  };
}
