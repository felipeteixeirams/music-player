import type { PodcastShowSummary } from '../types/music';
import type { KeyValueStorage } from './scopedStorage';

/** The shows this person follows, oldest first. Part of the account: it follows them between devices. */
export const PODCAST_FOLLOWS_KEY = 'aurastream_podcast_follows';
export const MAX_FOLLOWS = 200;

function isShow(value: unknown): value is PodcastShowSummary {
  const show = value as Partial<PodcastShowSummary> | null;
  return Boolean(show && typeof show.id === 'string' && /^\d{1,12}$/.test(show.id) && typeof show.title === 'string' && typeof show.author === 'string' && typeof show.coverUrl === 'string');
}

/** What the account stores of a show: no description (it can be long and it is on the show's page anyway). */
export function compactShow(show: PodcastShowSummary): PodcastShowSummary {
  return { id: show.id, title: show.title, author: show.author, coverUrl: show.coverUrl };
}

export function loadFollows(storage: Pick<KeyValueStorage, 'getItem'>): PodcastShowSummary[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PODCAST_FOLLOWS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isShow).map(compactShow) : [];
  } catch {
    return [];
  }
}

export function saveFollows(storage: Pick<KeyValueStorage, 'setItem'>, shows: PodcastShowSummary[]): void {
  try {
    storage.setItem(PODCAST_FOLLOWS_KEY, JSON.stringify(shows));
  } catch {
    // storage that refuses (private mode, full): the account still has the data
  }
}

export const isFollowing = (shows: PodcastShowSummary[], showId: string): boolean => shows.some((show) => show.id === showId);

/** The list after following (at the end) or unfollowing the show. Following past the limit changes nothing. */
export function toggleFollowIn(shows: PodcastShowSummary[], show: PodcastShowSummary): PodcastShowSummary[] {
  if (isFollowing(shows, show.id)) return shows.filter((item) => item.id !== show.id);
  return shows.length >= MAX_FOLLOWS ? shows : [...shows, compactShow(show)];
}
