export interface AudioSource {
  localUrl: string;
  youtubeId?: string;
  previewUrl?: string;
  /** `localUrl` is a live broadcast: no length, nothing to seek, never ends. */
  isLive?: boolean;
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
  /** Present for a podcast episode: it plays from `sources.localUrl` (the feed's audio file), never from YouTube. */
  podcast?: PodcastInfo;
}

export interface PodcastInfo {
  showId: string;
  showTitle: string;
  /** ISO date, "" when the feed gave none. */
  publishedAt: string;
}

/** A podcast show, as the search finds it. `id` is the iTunes collection id. */
export interface PodcastShowSummary {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  description?: string;
  language?: string;
}

/** One episode of a show's feed, newest first. */
export interface PodcastEpisodeItem {
  id: string;
  title: string;
  publishedAt: string;
  durationSeconds: number;
  audioUrl: string;
  description: string;
  coverUrl: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  gradient: string;
  accentColor: string;
}

export type AudioEngineType = 'native' | 'fallback';

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

export interface RadioStation {
  id: number;
  name: string;
  /** Cover from Deezer; null when it has none. */
  picture: string | null;
}

export interface RadioGenre {
  id: string;
  name: string;
  stations: RadioStation[];
}

export interface LiveStation {
  id: string;
  name: string;
  location: string;
  streamUrl: string;
}

export interface LiveRadioGroup {
  id: string;
  name: string;
  stations: LiveStation[];
}

/** An artist of the online catalog: what the search lists and the artist page opens with. */
export interface ArtistSummary {
  id: string;
  name: string;
  pictureUrl: string;
  /** Followers on Deezer; 0 when unknown. */
  fans: number;
}

/** Artist page: the artist and the most played tracks, one page at a time. */
export interface ArtistPage {
  artist: ArtistSummary;
  top: TrackPage;
  /** Albums, newest first. Absent from servers that predate them. */
  albums?: AlbumSummary[];
  /** Artists a listener of this one tends to like. Absent from servers that predate them. */
  related?: ArtistSummary[];
}

/** An album of the online catalog. */
export interface AlbumSummary {
  id: string;
  title: string;
  coverUrl: string;
  /** Release year; 0 when unknown. */
  year: number;
  artist: string;
}

/** Album page: the album and its tracks in album order. */
export interface AlbumPage {
  album: AlbumSummary;
  tracks: TrackPage;
}
