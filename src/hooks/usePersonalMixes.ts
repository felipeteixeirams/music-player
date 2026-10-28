import { useEffect, useMemo, useState } from 'react';
import type { Track, TrackPage } from '../types/music';
import type { PlayEntry } from '../utils/playHistory';
import {
  buildDiscovery,
  buildFavorites,
  buildForYou,
  buildMood,
  buildRediscover,
  dayKey,
  normalizeName,
  rankArtists,
  type PersonalMix
} from '../utils/personalMixes';
import { fetchMixSources, loadMixSources, saveMixSources, type MixSources } from '../utils/personalMixSources';
import type { KeyValueStorage } from '../utils/scopedStorage';

interface Input {
  entries: PlayEntry[];
  liked: Track[];
  feed: Record<string, TrackPage> | undefined;
  storage: KeyValueStorage;
}

/**
 * The personal cards of the home. The ones made from the device's own data (favorites, rediscover, mood) are ready at
 * once; the two that need the artists' tracks from the catalog (mix and discovery) appear when those arrive, and are
 * kept for the day so opening the app again asks for nothing.
 */
export function usePersonalMixes({ entries, liked, feed, storage }: Input): PersonalMix[] {
  const now = Date.now();
  const day = dayKey(now);
  const hour = new Date(now).getHours();

  const ranked = useMemo(() => rankArtists(entries, now, 5), [entries, day]);
  // The same list of names is the same request: a play that does not change the top does not ask again
  const topKey = ranked.slice(0, 3).map((artist) => artist.name).join('|');
  const known = useMemo(() => new Set(entries.map((entry) => normalizeName(entry.track.artist.split(/\s*(?:,|&)\s*/)[0] ?? ''))), [entries]);

  const [sources, setSources] = useState<MixSources | null>(() => loadMixSources(storage, day, topKey ? topKey.split('|') : []));

  useEffect(() => {
    if (!topKey) {
      setSources(null);
      return;
    }
    const artists = topKey.split('|');
    const cached = loadMixSources(storage, day, artists);
    if (cached) {
      setSources(cached);
      return;
    }
    const controller = new AbortController();
    fetchMixSources(day, artists, known, controller.signal)
      .then((made) => {
        if (controller.signal.aborted) return;
        saveMixSources(storage, made);
        setSources(made);
      })
      // The cards that need the catalog just do not appear this time; the next opening tries again
      .catch(() => undefined);
    return () => controller.abort();
    // `known` follows the same entries as `topKey`; the request is keyed by the names
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topKey, day, storage]);

  return useMemo(() => {
    const played = new Set(entries.map((entry) => entry.track.id));
    const forYou = sources ? buildForYou(sources.forYou.names, sources.forYou.tops, day) : null;
    const discovery = sources ? buildDiscovery(sources.discovery.names, sources.discovery.tops, played, day) : null;
    const mixes = [
      forYou,
      buildMood(feed, hour, day),
      discovery,
      buildFavorites(liked, day),
      buildRediscover(entries, now, day)
    ];
    return mixes.filter((mix): mix is PersonalMix => mix !== null);
  }, [sources, entries, liked, feed, hour, day]);
}
