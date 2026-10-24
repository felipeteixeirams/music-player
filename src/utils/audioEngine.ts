import { AudioEngineType, RepeatMode, Track } from '../types/music';
import { logPipedAudioExtraction } from './audioLogger';

/**
 * Public Piped API instances that offer CORS-friendly endpoints for pure audio extraction.
 * Endpoints: GET /streams/{id}
 */
export const PIPED_INSTANCES: string[] = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.private.coffee',
  'https://piped-api.lunar.icu',
  'https://pipedapi.tokhmi.xyz',
  'https://api.piped.projectsegfau.lt'
];

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
 * Parses raw Piped API response stream data to extract the highest quality pure audio stream URL.
 */
export function extractAudioStreamFromPipedData(data: any): { url: string; quality: string; bitrate: number } | null {
  if (!data || !Array.isArray(data.audioStreams) || data.audioStreams.length === 0) {
    return null;
  }

  // Filter valid audio streams with URLs
  const streams = data.audioStreams.filter((s: any) => s && typeof s.url === 'string' && s.url.length > 0);
  if (streams.length === 0) return null;

  // Prefer higher bitrate audio stream (e.g. 160kbps opus or m4a)
  streams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

  const best = streams[0];
  return {
    url: best.url,
    quality: best.quality || `${Math.round((best.bitrate || 128000) / 1000)}kbps`,
    bitrate: best.bitrate || 128000
  };
}

/**
 * Queries Piped API public instances to obtain pure audio stream URL for a YouTube ID.
 * Returns null if network or instance fails, allowing seamless fallback.
 */
export async function fetchPipedAudioStream(
  youtubeId: string,
  timeoutMs = 4000
): Promise<{ audioUrl: string | null; quality?: string; instanceUsed?: string; error?: string }> {
  if (!youtubeId) {
    return { audioUrl: null, error: 'No YouTube ID provided' };
  }

  // 1. Try Local Proxy Route first (Zero CORS, In-Memory Cached, Ultra-Fast)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const localRes = await fetch(`/api/streams/${encodeURIComponent(youtubeId)}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (localRes.ok) {
      const localData = await localRes.json();
      if (localData && localData.audioUrl) {
        logPipedAudioExtraction({
          context: 'stream_extraction',
          youtubeId,
          audioUrl: localData.audioUrl,
          quality: localData.quality,
          instanceUsed: localData.cached ? 'Piped Local (Cache 0ms)' : (localData.instanceUsed || 'Piped Local Proxy'),
          cached: localData.cached,
          sourceType: 'Piped Direct Audio Stream'
        });
        return {
          audioUrl: localData.audioUrl,
          quality: localData.quality,
          instanceUsed: localData.cached ? 'Piped Local (Cache 0ms)' : 'Piped Local Proxy'
        };
      }
      // If server verified direct streams are unavailable, log and immediately return
      logPipedAudioExtraction({
        context: 'stream_extraction',
        youtubeId,
        audioUrl: null,
        quality: 'Original YouTube Stream',
        instanceUsed: 'YouTube Engine',
        sourceType: 'YouTube Headless Stream'
      });
      return {
        audioUrl: null,
        error: localData?.message || 'Direct stream unavailable',
        instanceUsed: 'YouTube Engine'
      };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn('Local proxy stream resolution timed out');
    }
  }

  return {
    audioUrl: null,
    error: 'Direct stream not available; authentic YouTube engine active'
  };
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
