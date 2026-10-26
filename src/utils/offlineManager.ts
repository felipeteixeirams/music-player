import { Track } from '../types/music';
import { apiFetch } from './apiFetch';
import { OFFLINE_META_KEY, OFFLINE_TRACKS_KEY } from './offlineKeys';
import { scopedStorage, type KeyValueStorage } from './scopedStorage';

/**
 * Offline Track Manager Utility
 * Manages saving audio streams and metadata locally using browser CacheStorage
 * for 100% online-focused players that allow offline downloads.
 */

const OFFLINE_CACHE_NAME = 'aurastream_offline_tracks_v1';

/**
 * The downloads are listed per user (the `storage` argument is the signed-in user's, from useAuth): two people on
 * one device each see only what they downloaded. The audio files themselves live in CacheStorage, shared by track id.
 * Without a `storage` the plain keys are used (login off, and the unit tests).
 */
const plainStorage = (): KeyValueStorage => scopedStorage(null);

function readOfflineMeta(storage: KeyValueStorage): Record<string, Track> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(OFFLINE_META_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, Track>) : {};
  } catch {
    return {};
  }
}

/**
 * The downloaded tracks, in download order. Downloads made before metadata was stored are listed only when
 * `known` (favorites, for instance) has the track.
 */
export function getOfflineTracks(known: Track[] = [], storage: KeyValueStorage = plainStorage()): Track[] {
  const meta = readOfflineMeta(storage);
  const byId = new Map(known.map((track) => [track.id, track]));
  return getOfflineTrackIds(storage)
    .map((id) => meta[id] ?? byId.get(id))
    .filter((track): track is Track => Boolean(track));
}

export function getOfflineTrackIds(storage: KeyValueStorage = plainStorage()): string[] {
  try {
    const saved = storage.getItem(OFFLINE_TRACKS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function isTrackOfflineAvailable(trackId: string, storage: KeyValueStorage = plainStorage()): boolean {
  const offlineIds = getOfflineTrackIds(storage);
  return offlineIds.includes(trackId);
}

/**
 * Downloads audio and cover image for a track and stores them in CacheStorage.
 */
export async function downloadTrackForOffline(
  track: Track,
  currentAudioStreamUrl?: string,
  storage: KeyValueStorage = plainStorage()
): Promise<{ success: boolean; error?: string; previewOnly?: boolean }> {
  if (!('caches' in window)) {
    return { success: false, error: 'O seu navegador não suporta armazenamento offline.' };
  }

  try {
    let resolvedAudioUrl = currentAudioStreamUrl || '';
    const previewUrl = track.sources.previewUrl;

    // Catalog previews: the CDN sends no CORS headers, so the copy goes through the same-origin proxy.
    // A full track playing from YouTube cannot be downloaded; only the 30s preview is stored.
    if (previewUrl) {
      resolvedAudioUrl = `/api/audio?url=${encodeURIComponent(previewUrl)}`;
    } else if (!resolvedAudioUrl || resolvedAudioUrl.includes('youtube.com/watch')) {
      if (track.sources.localUrl) {
        resolvedAudioUrl = track.sources.localUrl;
      }
    }

    // A YouTube watch page is a player, not an audio file
    if (resolvedAudioUrl.includes('youtube.com/watch')) resolvedAudioUrl = '';

    if (!resolvedAudioUrl) {
      return { success: false, error: 'Esta faixa não pode ser baixada: o áudio completo vem do YouTube.' };
    }

    const cache = await caches.open(OFFLINE_CACHE_NAME);

    // Fetch and cache audio stream response
    const audioRes = await (resolvedAudioUrl.startsWith('/api/') ? apiFetch(resolvedAudioUrl) : fetch(resolvedAudioUrl, { mode: 'cors' })).catch(() => null);
    if (!audioRes || !audioRes.ok) {
      return { success: false, error: 'Falha na conexão ao baixar o arquivo de áudio.' };
    }

    // Store response with custom offline URL key
    await cache.put(`/offline-audio/${track.id}`, audioRes);

    // Cache cover image if provided
    if (track.coverUrl && track.coverUrl.startsWith('http')) {
      const coverRes = await fetch(track.coverUrl, { mode: 'cors' }).catch(() => null);
      if (coverRes && coverRes.ok) {
        await cache.put(`/offline-cover/${track.id}`, coverRes);
      }
    }

    const offlineIds = getOfflineTrackIds(storage);
    if (!offlineIds.includes(track.id)) {
      offlineIds.push(track.id);
      storage.setItem(OFFLINE_TRACKS_KEY, JSON.stringify(offlineIds));
    }
    storage.setItem(OFFLINE_META_KEY, JSON.stringify({ ...readOfflineMeta(storage), [track.id]: track }));

    console.log(`[Offline Manager] ⬇️ Faixa ${track.id} baixada e armazenada para uso offline.`);
    return { success: true, previewOnly: Boolean(previewUrl) };
  } catch (err: any) {
    console.warn(`[Offline Manager] ⚠️ Não foi possível baixar a faixa ${track.id}:`, err);
    return { success: false, error: err?.message || 'Erro inesperado ao baixar faixa.' };
  }
}

/**
 * Retrieves a cached offline audio blob URL for playback.
 */
export async function getOfflineAudioUrl(trackId: string): Promise<string | null> {
  if (!('caches' in window)) return null;

  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    const response = await cache.match(`/offline-audio/${trackId}`);
    if (response && response.ok) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn(`[Offline Manager] ⚠️ Erro ao buscar áudio offline para faixa ${trackId}:`, err);
  }
  return null;
}

/**
 * How many users of this device (the signed-in one included) list the track as downloaded. The audio file is shared
 * by track id, so it may only be deleted when nobody else on the device still lists it.
 */
function listedByOthers(trackId: string, own: KeyValueStorage): boolean {
  try {
    const ownHas = getOfflineTrackIds(own).includes(trackId);
    let holders = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(OFFLINE_TRACKS_KEY)) continue;
      const ids: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (Array.isArray(ids) && ids.includes(trackId)) holders++;
    }
    return holders - (ownHas ? 1 : 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Removes the track from the user's downloads and, when no other user of the device has it, its audio and cover
 * from CacheStorage.
 */
export async function removeOfflineTrack(trackId: string, storage: KeyValueStorage = plainStorage()): Promise<boolean> {
  if (!('caches' in window)) return false;

  try {
    if (!listedByOthers(trackId, storage)) {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      await cache.delete(`/offline-audio/${trackId}`);
      await cache.delete(`/offline-cover/${trackId}`);
    }

    const offlineIds = getOfflineTrackIds(storage).filter((id) => id !== trackId);
    storage.setItem(OFFLINE_TRACKS_KEY, JSON.stringify(offlineIds));
    const { [trackId]: _removed, ...remainingMeta } = readOfflineMeta(storage);
    storage.setItem(OFFLINE_META_KEY, JSON.stringify(remainingMeta));

    console.log(`[Offline Manager] 🗑️ Faixa ${trackId} removida do armazenamento offline.`);
    return true;
  } catch (err) {
    console.warn(`[Offline Manager] ⚠️ Erro ao remover a faixa ${trackId}:`, err);
    return false;
  }
}
