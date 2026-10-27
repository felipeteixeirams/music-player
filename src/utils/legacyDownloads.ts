import { OFFLINE_META_KEY, OFFLINE_TRACKS_KEY } from './offlineKeys';

/**
 * The app used to save the 30 s preview of a track "for offline listening". A preview is not the music, so the feature
 * was withdrawn (2026-10-28): this removes what it left on the device, once: the saved audio in CacheStorage and the
 * lists of downloaded tracks (of every user of the device). Nothing here is the user's music: favorites, playlists and
 * history are untouched.
 */

const OFFLINE_CACHE_NAME = 'aurastream_offline_tracks_v1';
export const PURGED_FLAG = 'aurastream_downloads_purged_v1';
const LIST_PREFIXES = [OFFLINE_TRACKS_KEY, OFFLINE_META_KEY];

export async function purgeLegacyDownloads(): Promise<void> {
  try {
    if (localStorage.getItem(PURGED_FLAG)) return;

    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && LIST_PREFIXES.some((prefix) => key.startsWith(prefix))) stale.push(key);
    }
    stale.forEach((key) => localStorage.removeItem(key));

    if (typeof caches !== 'undefined') await caches.delete(OFFLINE_CACHE_NAME);
    localStorage.setItem(PURGED_FLAG, '1');
  } catch {
    // storage or cache that refuses: tried again next time the app opens
  }
}
