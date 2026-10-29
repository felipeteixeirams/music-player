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
    podcast: { showId: show.id, showTitle: show.title, publishedAt: episode.publishedAt }
  };
}
