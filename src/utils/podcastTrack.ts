import type { PodcastEpisodeItem, PodcastShowSummary, Track } from '../types/music';

/** True for a podcast episode: it has a length and a position to resume, and the queue after it is the show's episodes. */
export function isPodcastTrack(track: Track | null | undefined): boolean {
  return Boolean(track?.podcast);
}

/** An episode as a `Track`, so the player, the queue and the media session treat it like anything playable. */
export function episodeToTrack(show: PodcastShowSummary, episode: PodcastEpisodeItem): Track {
  return {
    id: episode.id,
    title: episode.title,
    artist: show.author || show.title,
    album: show.title,
    duration: episode.durationSeconds,
    coverUrl: episode.coverUrl || show.coverUrl,
    style: 'Podcast',
    categoryId: 'podcast',
    sources: { localUrl: episode.audioUrl },
    podcast: { showId: show.id, showTitle: show.title, showAuthor: show.author, showCoverUrl: show.coverUrl, publishedAt: episode.publishedAt }
  };
}

/** What is kept of an episode next to where the person stopped, so "Continue ouvindo" can show and play it without opening the feed. */
export interface EpisodeRef {
  title: string;
  showId: string;
  showTitle: string;
  showAuthor: string;
  coverUrl: string;
  audioUrl: string;
  publishedAt: string;
}

export function episodeRefOf(track: Track): EpisodeRef | null {
  if (!track.podcast || !track.sources.localUrl) return null;
  return {
    title: track.title,
    showId: track.podcast.showId,
    showTitle: track.podcast.showTitle,
    showAuthor: track.podcast.showAuthor ?? track.artist,
    coverUrl: track.coverUrl,
    audioUrl: track.sources.localUrl,
    publishedAt: track.podcast.publishedAt
  };
}

/** The episode as a playable `Track` again (from what was kept of it). */
export function trackFromEpisodeRef(id: string, ref: EpisodeRef, durationSeconds: number): Track {
  return {
    id,
    title: ref.title,
    artist: ref.showAuthor || ref.showTitle,
    album: ref.showTitle,
    duration: durationSeconds,
    coverUrl: ref.coverUrl,
    style: 'Podcast',
    categoryId: 'podcast',
    sources: { localUrl: ref.audioUrl },
    podcast: { showId: ref.showId, showTitle: ref.showTitle, showAuthor: ref.showAuthor, showCoverUrl: ref.coverUrl, publishedAt: ref.publishedAt }
  };
}
