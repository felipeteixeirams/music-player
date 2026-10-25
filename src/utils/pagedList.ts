import type { Track, TrackPage } from '../types/music';

export interface PagedListState {
  tracks: Track[];
  total: number;
  /** Where the next page starts; null once everything was loaded. */
  nextIndex: number | null;
}

export const EMPTY_PAGED_LIST: PagedListState = { tracks: [], total: 0, nextIndex: null };

/** Adds a page to the list. Tracks already shown are skipped, so a repeated item never appears twice. */
export function appendPage(state: PagedListState, page: TrackPage): PagedListState {
  const known = new Set(state.tracks.map((track) => track.id));
  const fresh = page.tracks.filter((track) => {
    if (known.has(track.id)) return false;
    known.add(track.id);
    return true;
  });
  return { tracks: [...state.tracks, ...fresh], total: page.total, nextIndex: page.nextIndex };
}

/** A list that starts from a page already in hand (for example the first page of the home feed). */
export function fromPage(page: TrackPage): PagedListState {
  return appendPage(EMPTY_PAGED_LIST, page);
}
