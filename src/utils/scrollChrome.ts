/** Scroll position (px) above which the bottom bar may collapse. */
export const COLLAPSE_AFTER = 48;
/** Scroll distance (px) needed to count as a deliberate move, so a tremor does not flip the bar. */
const SCROLL_THRESHOLD = 8;
/** Horizontal distance (px) that turns a drag on the mini player into a track change. */
export const SWIPE_DISTANCE = 60;

/** Collapses the tab bar when scrolling down the page and brings it back when scrolling up or near the top. */
export function nextCompact(compact: boolean, y: number, previousY: number): boolean {
  if (y <= COLLAPSE_AFTER) return false;
  const delta = y - previousY;
  if (delta > SCROLL_THRESHOLD) return true;
  if (delta < -SCROLL_THRESHOLD) return false;
  return compact;
}

export type SwipeAction = 'next' | 'previous' | null;

/**
 * What a horizontal drag on the mini player does: left goes to the next track and right to the previous, as in
 * Apple Music. Mostly vertical or short drags do nothing.
 */
export function swipeAction(
  dx: number,
  dy: number,
  allowed: { next: boolean; previous: boolean }
): SwipeAction {
  if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  if (dx < 0) return allowed.next ? 'next' : null;
  return allowed.previous ? 'previous' : null;
}
