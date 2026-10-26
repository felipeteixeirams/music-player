import { Track } from '../types/music';
import { apiFetch } from './apiFetch';

/**
 * Offline Track Manager Utility
 * Manages saving audio streams and metadata locally using browser CacheStorage
 * for 100% online-focused players that allow offline downloads.
 */

const OFFLINE_CACHE_NAME = 'aurastream_offline_tracks_v1';
const OFFLINE_TRACKS_KEY = 'aurastream_offline_track_ids';
/** Metadata of downloaded tracks (id -> Track), so the Downloads screen can list them. */
const OFFLINE_META_KEY = 'aurastream_offline_track_meta';

function readOfflineMeta(): Record<string, Track> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(OFFLINE_META_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, Track>) : {};
  } catch {
    return {};
  }
}

/**
 * The downloaded tracks, in download order. Downloads made before metadata was stored are listed only when
 * `known` (favorites, for instance) has the track.
 */
export function getOfflineTracks(known: Track[] = []): Track[] {
  const meta = readOfflineMeta();
  const byId = new Map(known.map((track) => [track.id, track]));
  return getOfflineTrackIds()
    .map((id) => meta[id] ?? byId.get(id))
    .filter((track): track is Track => Boolean(track));
}

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

/**
 * Downloads audio and cover image for a track and stores them in CacheStorage.
 */
export async function downloadTrackForOffline(
  track: Track,
  currentAudioStreamUrl?: string
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

    const offlineIds = getOfflineTrackIds();
    if (!offlineIds.includes(track.id)) {
      offlineIds.push(track.id);
      localStorage.setItem(OFFLINE_TRACKS_KEY, JSON.stringify(offlineIds));
    }
    localStorage.setItem(OFFLINE_META_KEY, JSON.stringify({ ...readOfflineMeta(), [track.id]: track }));

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
 * Removes track and its cover from offline CacheStorage and localStorage list.
 */
export async function removeOfflineTrack(trackId: string): Promise<boolean> {
  if (!('caches' in window)) return false;

  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    await cache.delete(`/offline-audio/${trackId}`);
    await cache.delete(`/offline-cover/${trackId}`);

    const offlineIds = getOfflineTrackIds().filter((id) => id !== trackId);
    localStorage.setItem(OFFLINE_TRACKS_KEY, JSON.stringify(offlineIds));
    const { [trackId]: _removed, ...remainingMeta } = readOfflineMeta();
    localStorage.setItem(OFFLINE_META_KEY, JSON.stringify(remainingMeta));

    console.log(`[Offline Manager] 🗑️ Faixa ${trackId} removida do armazenamento offline.`);
    return true;
  } catch (err) {
    console.warn(`[Offline Manager] ⚠️ Erro ao remover a faixa ${trackId}:`, err);
    return false;
  }
}
