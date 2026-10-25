export interface AudioSource {
  localUrl: string;
  youtubeId?: string;
  previewUrl?: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  coverUrl: string;
  style: string;
  categoryId: string;
  sources: AudioSource;
  lyrics?: string[];
  releaseYear?: number;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  gradient: string;
  accentColor: string;
}

export type AudioEngineType = 'native' | 'piped' | 'fallback';

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  activeEngine: AudioEngineType;
  isBuffering: boolean;
  error: string | null;
}

export interface PipedAudioStream {
  url: string;
  bitrate: number;
  format: string;
  quality: string;
  mimeType: string;
}

/** One page of a paginated track list. `nextIndex` is null when there is nothing left to load. */
export interface TrackPage {
  tracks: Track[];
  total: number;
  nextIndex: number | null;
}

/** Home feed: the first page of every category, keyed by category id. */
export interface FeedResponse {
  categories: Record<string, TrackPage>;
  featured: Track | null;
}
