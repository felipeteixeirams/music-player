import { AudioEngineType, RepeatMode, Track } from '../types/music';
import { apiFetch } from './apiFetch';

/**
 * Formats a duration in seconds into MM:SS format (e.g. 214 -> "03:34")
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Formats remaining time (e.g. -02:15)
 */
export function formatRemainingTime(currentTime: number, duration: number): string {
  if (isNaN(duration) || duration <= 0) return '-00:00';
  const remaining = Math.max(0, duration - currentTime);
  return `-${formatTime(remaining)}`;
}

/**
 * Calculates current playback progress as a percentage between 0 and 100.
 */
export function calculateProgress(currentTime: number, duration: number): number {
  if (isNaN(currentTime) || isNaN(duration) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}

/**
 * Converts a percentage (0 to 100) back into seconds.
 */
export function progressToSeconds(percentage: number, duration: number): number {
  if (isNaN(percentage) || isNaN(duration) || duration <= 0) return 0;
  return (Math.max(0, Math.min(100, percentage)) / 100) * duration;
}

/**
 * Computes the next track index given queue length, repeat mode, and shuffle status.
 */
export function getNextTrackIndex(
  currentIndex: number,
  totalTracks: number,
  isShuffle: boolean,
  repeatMode: RepeatMode
): number {
  if (totalTracks <= 0) return -1;
  if (totalTracks === 1) return 0;

  if (repeatMode === 'one') {
    return currentIndex;
  }

  if (isShuffle) {
    // Pick random index different from current
    let nextIndex = Math.floor(Math.random() * totalTracks);
    if (nextIndex === currentIndex) {
      nextIndex = (currentIndex + 1) % totalTracks;
    }
    return nextIndex;
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex >= totalTracks) {
    return repeatMode === 'all' ? 0 : -1;
  }
  return nextIndex;
}

/**
 * Computes the previous track index.
 */
export function getPreviousTrackIndex(currentIndex: number, totalTracks: number): number {
  if (totalTracks <= 0) return -1;
  if (totalTracks === 1) return 0;
  return (currentIndex - 1 + totalTracks) % totalTracks;
}

/**
 * Resolves optimal audio stream URL and engine for a given track and user preference.
 */
export function resolveAudioDetails(
  track: Track,
  preferredEngine: AudioEngineType
): { engine: AudioEngineType; url: string; fallbackAvailable: boolean } {
  if (preferredEngine === 'native' && track.sources.localUrl) {
    return {
      engine: 'native',
      url: track.sources.localUrl,
      fallbackAvailable: Boolean(track.sources.youtubeId)
    };
  }

  if (preferredEngine === 'fallback' && track.sources.youtubeId) {
    return {
      engine: 'fallback',
      url: `https://www.youtube.com/watch?v=${track.sources.youtubeId}`,
      fallbackAvailable: Boolean(track.sources.localUrl)
    };
  }

  // Default to native stream for immediate ultra-fast response
  if (track.sources.localUrl) {
    return {
      engine: 'native',
      url: track.sources.localUrl,
      fallbackAvailable: Boolean(track.sources.youtubeId)
    };
  }

  return {
    engine: 'fallback',
    url: track.sources.youtubeId ? `https://www.youtube.com/watch?v=${track.sources.youtubeId}` : '',
    fallbackAvailable: false
  };
}

const resolvedVideoIds = new Map<string, string[]>();

/**
 * Finds the YouTube videos that play the full recording of a catalog track (Deezer), best first.
 * Answers, including empty ones, are cached for the session to spare the daily search quota;
 * failures are not cached.
 */
export async function resolveFullTrackVideoIds(track: Track, timeoutMs = 6000): Promise<string[]> {
  const cached = resolvedVideoIds.get(track.id);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      artist: track.artist,
      title: track.title,
      duration: String(track.duration)
    });
    const response = await apiFetch(`/api/resolve?${params}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return [];

    const data: unknown = await response.json();
    const videoIds = (data as { videoIds?: unknown } | null)?.videoIds;
    const resolved = Array.isArray(videoIds)
      ? videoIds.filter((id): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id))
      : [];
    resolvedVideoIds.set(track.id, resolved);
    return resolved;
  } catch {
    return [];
  }
}
