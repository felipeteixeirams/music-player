/**
 * A video that really is the catalog track is at most about 15 s away from the catalog length (the search refuses
 * anything farther), so a much shorter length from the YouTube player is not the track's: report of 2026-10-29, the bar
 * showed 0:08 of 0:08 on a 9:25 track after a pause and resume (hypothesis: the player answered the length played so far).
 * Longer is accepted (an intro, a longer cut); the catalog length stays on screen when the player's is not believed.
 */
export const MAX_SHORTFALL_SECONDS = 20;

export function plausiblePlayerLength(catalogSeconds: number, reportedSeconds: number): boolean {
  if (!Number.isFinite(reportedSeconds) || reportedSeconds <= 0) return false;
  return !(catalogSeconds > 0) || reportedSeconds >= catalogSeconds - MAX_SHORTFALL_SECONDS;
}
