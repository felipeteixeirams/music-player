import { fetchPipedAudioStream } from './audioEngine';
import { Track } from '../types/music';

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

/**
 * Downloads audio and cover image for a track and stores them in CacheStorage.
 * Resolves Piped stream URL if audioUrl is not directly available.
 */
export async function downloadTrackForOffline(
  track: Track,
  currentAudioStreamUrl?: string
): Promise<{ success: boolean; error?: string }> {
  if (!('caches' in window)) {
    return { success: false, error: 'O seu navegador não suporta armazenamento offline.' };
  }

  try {
    let resolvedAudioUrl = currentAudioStreamUrl || '';

    // If audio URL is not available or is a YouTube watch URL, resolve stream URL from Piped
    if (!resolvedAudioUrl || resolvedAudioUrl.includes('youtube.com/watch')) {
      if (track.sources.localUrl) {
        resolvedAudioUrl = track.sources.localUrl;
      } else if (track.sources.youtubeId) {
        const streamInfo = await fetchPipedAudioStream(track.sources.youtubeId, 5000);
        if (streamInfo.audioUrl) {
          resolvedAudioUrl = streamInfo.audioUrl;
        }
      }
    }

    if (!resolvedAudioUrl) {
      return { success: false, error: 'Não foi possível obter o fluxo de áudio para download.' };
    }

    const cache = await caches.open(OFFLINE_CACHE_NAME);

    // Fetch and cache audio stream response
    const audioRes = await fetch(resolvedAudioUrl, { mode: 'cors' }).catch(() => null);
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

    console.log(`[Offline Manager] ⬇️ Faixa ${track.id} baixada e armazenada para uso offline.`);
    return { success: true };
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

    console.log(`[Offline Manager] 🗑️ Faixa ${trackId} removida do armazenamento offline.`);
    return true;
  } catch (err) {
    console.warn(`[Offline Manager] ⚠️ Erro ao remover a faixa ${trackId}:`, err);
    return false;
  }
}
