/**
 * Offline Track Manager Utility
 * Manages saving audio streams and metadata locally using browser CacheStorage
 * for 100% online-focused players that allow offline downloads.
 */

const OFFLINE_CACHE_NAME = 'aurastream_offline_tracks_v1';
const OFFLINE_TRACKS_KEY = 'aurastream_offline_track_ids';

export function getOfflineTrackIds(): string[] {
  try {
    const saved = localStorage.getItem(OFFLINE_TRACKS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function isTrackOfflineAvailable(trackId: string): boolean {
  const offlineIds = getOfflineTrackIds();
  return offlineIds.includes(trackId);
}

export async function downloadTrackForOffline(
  trackId: string,
  audioUrl: string,
  coverUrl?: string
): Promise<boolean> {
  if (!('caches' in window)) return false;

  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);

    // Cache audio stream response
    if (audioUrl) {
      const audioRes = await fetch(audioUrl, { mode: 'cors' }).catch(() => null);
      if (audioRes && audioRes.ok) {
        await cache.put(`/offline-audio/${trackId}`, audioRes);
      }
    }

    // Cache cover image if provided
    if (coverUrl && coverUrl.startsWith('http')) {
      const coverRes = await fetch(coverUrl, { mode: 'cors' }).catch(() => null);
      if (coverRes && coverRes.ok) {
        await cache.put(`/offline-cover/${trackId}`, coverRes);
      }
    }

    const offlineIds = getOfflineTrackIds();
    if (!offlineIds.includes(trackId)) {
      offlineIds.push(trackId);
      localStorage.setItem(OFFLINE_TRACKS_KEY, JSON.stringify(offlineIds));
    }

    console.log(`[Offline Manager] ⬇️ Faixa ${trackId} baixada e armazenada para uso offline.`);
    return true;
  } catch (err) {
    console.warn(`[Offline Manager] ⚠️ Não foi possível baixar a faixa ${trackId}:`, err);
    return false;
  }
}

export async function removeOfflineTrack(trackId: string): Promise<boolean> {
  if (!('caches' in window)) return false;

  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    await cache.delete(`/offline-audio/${trackId}`);
    await cache.delete(`/offline-cover/${trackId}`);

    const offlineIds = getOfflineTrackIds().filter((id) => id !== trackId);
    localStorage.setItem(OFFLINE_TRACKS_KEY, JSON.stringify(offlineIds));

    console.log(`[Offline Manager] 🗑️ Faixa ${trackId} removida do armazenamento offline.`);
    return true;
  } catch (err) {
    console.warn(`[Offline Manager] ⚠️ Erro ao remover a faixa ${trackId}:`, err);
    return false;
  }
}
