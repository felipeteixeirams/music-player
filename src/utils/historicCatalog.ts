import type { AlbumPage, AlbumSummary, Track } from '../types/music';

/** The ids that the app already stores for a CD (favorites, playlists, history): changing them would lose them. */
export const HISTORIC_ALBUM_PREFIX = 'historic-';

/** The front cover at 250 px from the Cover Art Archive, for a CD whose MusicBrainz release is known (499 of 2,569). */
export const historicCoverUrl = (mbid: string | null | undefined): string =>
  mbid ? `https://coverartarchive.org/release/${mbid}/front-250` : '';

export interface HistoricEntry {
  id: string;
  title: string;
  base: string;
  year: number;
  catno?: string;
  tracks: number;
  matched?: number;
  mbid?: string | null;
  coverUrl?: string;
  label?: string;
}

export interface HistoricIndex {
  generatedAt?: string;
  source?: string;
  coversAt?: string;
  compilations: HistoricEntry[];
}

export interface HistoricTrack {
  position?: string;
  title: string;
  artist: string;
  duration?: string | number;
  deezerId?: number | null;
}

export interface HistoricRecord {
  id: string;
  title: string;
  base?: string;
  year?: number;
  label?: string;
  catno?: string;
  country?: string;
  coverUrl?: string;
  tracks?: HistoricTrack[];
  trackList?: HistoricTrack[];
  matched?: number;
  mbid?: string | null;
}

const EXCLUDED_QUERIES = new Set([
  'som livre',
  'cd',
  'cds',
  'coletanea',
  'coletaneas',
  'album',
  'albuns',
  'musica',
  'musicas'
]);

/**
 * Normalizes text for resilient matching: lowercases, strips accents and extra punctuation.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips volume indicators (vol 1, volume 2, v1), CD numbers, and 2-to-4 digit years.
 */
function stripVolumeAndYear(text: string): string {
  return text
    .replace(/\b(vol(ume)?\.?\s*\d+|v\d+|\b\d{1,4}\b|parte\s*\d+|cd\s*\d+|edicao\s*\d+)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses track duration string (e.g. "3:45" or "1:15:30") or number into seconds.
 */
function parseDuration(d?: string | number): number {
  if (typeof d === 'number') return d;
  if (!d) return 0;
  const parts = d.split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

/**
 * Enforces INV-CAT-03: returns compilations only when the full search query represents
 * the series name (optionally with volume/edition/year). Searches that include an artist
 * name (e.g. "love metal iron maiden" or "good times bee gees") or generic terms return [].
 */
export function findHistoricMatches(query: string, index: HistoricIndex | null): HistoricEntry[] {
  if (!query || !index || !Array.isArray(index.compilations)) return [];

  const rawNorm = normalizeText(query);
  if (rawNorm.length < 3 || EXCLUDED_QUERIES.has(rawNorm)) return [];

  const queryBase = stripVolumeAndYear(rawNorm);
  if (!queryBase || EXCLUDED_QUERIES.has(queryBase)) return [];

  const matches: HistoricEntry[] = [];
  const seenIds = new Set<string>();

  for (const item of index.compilations) {
    if (!item || !item.id || seenIds.has(item.id)) continue;

    const itemBase = normalizeText(item.base || '');
    const itemTitle = normalizeText(item.title || '');
    const itemTitleBase = stripVolumeAndYear(itemTitle);

    // Exact series match or title base match
    const isBaseMatch = itemBase && (itemBase === queryBase || itemBase === rawNorm);
    const isTitleBaseMatch = itemTitleBase && (itemTitleBase === queryBase || itemTitle === rawNorm);

    if (isBaseMatch || isTitleBaseMatch) {
      seenIds.add(item.id);
      matches.push(item);
    }
  }

  // Sort by year (ascending) then title
  return matches.sort((a, b) => (a.year || 0) - (b.year || 0) || a.title.localeCompare(b.title));
}

// One request per compilation for the whole session: opening the same CD again (from the home, a search or a list)
// reads the same record. Only successes are kept, so a failed read is tried again the next time.
const loadedRecords = new Map<string, Promise<HistoricRecord>>();

function loadRecord(cleanId: string): Promise<HistoricRecord> {
  let request = loadedRecords.get(cleanId);
  if (!request) {
    request = fetch(`/historic/t/${cleanId}.json`).then(async (res) => {
      if (!res.ok) {
        throw new Error(`Não foi possível carregar a coletânea (${res.status})`);
      }
      return (await res.json()) as HistoricRecord;
    });
    loadedRecords.set(cleanId, request);
    request.catch(() => loadedRecords.delete(cleanId));
  }
  return request;
}

/**
 * Loads a historic compilation album from public/historic/t/<id>.json and formats it as an AlbumPage.
 */
export async function loadHistoricAlbumPage(albumId: string, signal?: AbortSignal): Promise<AlbumPage> {
  const cleanId = albumId.startsWith(HISTORIC_ALBUM_PREFIX) ? albumId.slice(HISTORIC_ALBUM_PREFIX.length) : albumId;

  // The request is shared, so it is not tied to this caller's signal: a caller that left just stops here
  const record = await loadRecord(cleanId);
  if (signal?.aborted) throw new DOMException('Carregamento cancelado', 'AbortError');
  const rawTracks = record.tracks || record.trackList || [];
  const cover = record.coverUrl || historicCoverUrl(record.mbid);

  const tracks: Track[] = rawTracks.map((t, index) => {
    // Same ids as before: a track without a Deezer id keeps `historic-<cd>-<position>`
    const trackId = t.deezerId ? `deezer-${t.deezerId}` : `${HISTORIC_ALBUM_PREFIX}${cleanId}-${t.position || index + 1}`;
    return {
      id: trackId,
      title: t.title,
      artist: t.artist,
      album: record.label ? `${record.title} (${record.label})` : record.title,
      duration: parseDuration(t.duration),
      coverUrl: cover,
      style: 'Coletânea Histórica',
      categoryId: 'rock',
      sources: {
        localUrl: '',
        previewUrl: ''
      },
      releaseYear: record.year || undefined
    };
  });

  const album: AlbumSummary = {
    id: albumId.startsWith(HISTORIC_ALBUM_PREFIX) ? albumId : `${HISTORIC_ALBUM_PREFIX}${cleanId}`,
    title: record.title,
    // The CD's own label (Som Livre, Camelô...): the old fixed "Som Livre" was wrong for the newer CDs
    artist: record.label || 'Som Livre',
    year: record.year || 0,
    coverUrl: cover,
    kind: 'album',
    trackCount: tracks.length
  };

  return {
    album,
    tracks: {
      tracks,
      total: tracks.length,
      nextIndex: null
    }
  };
}
