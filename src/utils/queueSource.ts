import type { Track, TrackPage } from '../types/music';

/** Where the rest of a queue comes from: the list the track was played from, one page at a time. */
export interface QueueSource {
  /** Start of the next page, or null when the list has no more. */
  nextIndex: number | null;
  load: (index: number) => Promise<TrackPage>;
}

/** More tracks are fetched when this many or fewer are left after the one playing. */
export const QUEUE_MORE_THRESHOLD = 3;

/** How many pages in a row may bring nothing new (all repeats) before giving up on the moment. */
export const MAX_EMPTY_PAGES = 3;

export function needsMoreTracks(queueLength: number, currentIndex: number, nextIndex: number | null): boolean {
  return nextIndex !== null && queueLength > 0 && queueLength - 1 - currentIndex <= QUEUE_MORE_THRESHOLD;
}

/** The tracks of a page that are not in the queue yet, without repeats among themselves. */
export function newTracks(queue: Track[], incoming: Track[]): Track[] {
  const known = new Set(queue.map((track) => track.id));
  return incoming.filter((track) => {
    if (known.has(track.id)) return false;
    known.add(track.id);
    return true;
  });
}
