import type { Track } from '../types/music';
import { fetchArtistPage, fetchArtistSearch } from './catalogClient';
import { normalizeName } from './personalMixes';
import type { KeyValueStorage } from './scopedStorage';

/** The artists' tracks behind the two mixes that need the catalog: where they come from and how they are kept for the day. */

export interface MixSources {
  /** The day these were made. */
  day: string;
  /** Artists played most, in order: the key of this set (when the favorites change, it is made again). */
  artists: string[];
  forYou: { names: string[]; tops: Track[][] };
  discovery: { names: string[]; tops: Track[][] };
}

const KEY = 'aurastream_mix_sources';
const TOP_ARTISTS = 3;
const DISCOVERY_ARTISTS = 3;
const DISCOVERY_TRACKS_PER_ARTIST = 8;

type Deps = {
  searchArtists: typeof fetchArtistSearch;
  artistPage: typeof fetchArtistPage;
};

const DEFAULT_DEPS: Deps = { searchArtists: fetchArtistSearch, artistPage: fetchArtistPage };

export function loadMixSources(storage: Pick<KeyValueStorage, 'getItem'>, day: string, artists: string[]): MixSources | null {
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? 'null') as MixSources | null;
    if (!parsed || parsed.day !== day || parsed.artists.join('|') !== artists.join('|')) return null;
    if (!Array.isArray(parsed.forYou?.tops) || !Array.isArray(parsed.discovery?.tops)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveMixSources(storage: Pick<KeyValueStorage, 'setItem'>, sources: MixSources): void {
  try {
    storage.setItem(KEY, JSON.stringify(sources));
  } catch {
    // full or private: it is made again next time
  }
}

/**
 * The top tracks of the person's most played artists and of artists like them. The catalog is asked about names (the
 * history keeps names, not ids): the first match is taken only when its name is the same, so a stranger who shares a
 * few letters never ends up in "Mix para você". Nothing here touches the YouTube quota: videos are only looked up
 * when a track is tapped.
 */
export async function fetchMixSources(
  day: string,
  artists: string[],
  knownArtists: ReadonlySet<string>,
  signal?: AbortSignal,
  deps: Deps = DEFAULT_DEPS
): Promise<MixSources> {
  const forYou: MixSources['forYou'] = { names: [], tops: [] };
  const discovery: MixSources['discovery'] = { names: [], tops: [] };
  const relatedIds = new Map<string, string>();

  await Promise.all(
    artists.slice(0, TOP_ARTISTS).map(async (name, index) => {
      const found = (await deps.searchArtists(name, signal)).find((artist) => normalizeName(artist.name) === normalizeName(name));
      if (!found) return;
      const page = await deps.artistPage(found.id, 0, signal);
      forYou.names[index] = found.name;
      forYou.tops[index] = page.top.tracks;
      // Artists like this one that the person has not played yet, most similar first
      if (index < 2) {
        for (const related of page.related ?? []) {
          if (knownArtists.has(normalizeName(related.name)) || relatedIds.has(related.id)) continue;
          relatedIds.set(related.id, related.name);
        }
      }
    })
  );
  forYou.names = forYou.names.filter(Boolean);
  forYou.tops = forYou.tops.filter(Boolean);

  const picked = [...relatedIds.entries()].slice(0, DISCOVERY_ARTISTS);
  await Promise.all(
    picked.map(async ([id, name], index) => {
      const page = await deps.artistPage(id, 0, signal);
      discovery.names[index] = name;
      discovery.tops[index] = page.top.tracks.slice(0, DISCOVERY_TRACKS_PER_ARTIST);
    })
  );
  discovery.names = discovery.names.filter(Boolean);
  discovery.tops = discovery.tops.filter(Boolean);

  return { day, artists, forYou, discovery };
}
