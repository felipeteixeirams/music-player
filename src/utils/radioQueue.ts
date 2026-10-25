import type { Track } from '../types/music';

/** The radio asks for more tracks when this many or fewer are left after the one playing. */
export const RADIO_REFILL_THRESHOLD = 5;

/** Tracks heard within this many plays are skipped when more are added, unless there is not enough else. */
const RECENT_WINDOW = 40;
/** Never added again this soon, even when the station's pool is small. */
const NEVER_REPEAT_WINDOW = 15;
/** Fewer new tracks than this and the recently heard ones (outside the hard window) are allowed back. */
const MIN_FRESH_TRACKS = 10;

export function needsRadioRefill(queueLength: number, currentIndex: number): boolean {
  return queueLength > 0 && queueLength - 1 - currentIndex <= RADIO_REFILL_THRESHOLD;
}

/**
 * Which tracks of a new batch to add to the radio queue. Deezer shuffles a fixed pool of 50 to 120 tracks on
 * every call, so most of a batch was already heard: prefer tracks outside the last 40 plays, bring back older
 * ones only when fewer than 10 are new, and never repeat any of the last 15. Returns nothing only when the
 * batch has nothing but those.
 */
export function pickRadioRefill(queue: Track[], incoming: Track[]): Track[] {
  const unique = incoming.filter((track, index) => incoming.findIndex((t) => t.id === track.id) === index);

  const recent = new Set(queue.slice(-RECENT_WINDOW).map((track) => track.id));
  const neverRepeat = new Set(queue.slice(-NEVER_REPEAT_WINDOW).map((track) => track.id));

  const fresh = unique.filter((track) => !recent.has(track.id));
  if (fresh.length >= MIN_FRESH_TRACKS) return fresh;

  return unique.filter((track) => !recent.has(track.id) || !neverRepeat.has(track.id));
}
