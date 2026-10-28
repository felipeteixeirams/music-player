import type { Track } from '../types/music';

/**
 * The queue when the daily allowance of new tracks is spent. A track nobody has played has no video and, with no
 * allowance left, would play as a 30 s preview in the middle of a list. The queue instead moves past it (a track the
 * person chose by tapping it is never skipped) and prefers the next one whose video is already known.
 */

/** Tracks in a row that may be skipped for having no video, before giving up and playing the preview of the current one. */
export const MAX_QUEUE_SKIPS = 8;
/** How far ahead the queue looks for a track whose video is known. */
export const KNOWN_LOOKAHEAD = 15;

/** The first track after `currentIndex` that `isPlayable`, within the lookahead; -1 when none. */
export function nextKnownIndex(queue: readonly Track[], currentIndex: number, isPlayable: (track: Track) => boolean, lookahead = KNOWN_LOOKAHEAD): number {
  const last = Math.min(queue.length - 1, currentIndex + lookahead);
  for (let index = currentIndex + 1; index <= last; index += 1) {
    if (isPlayable(queue[index])) return index;
  }
  return -1;
}

/** What the person is told after tracks were skipped (said once, when the next one starts). */
export function skipNotice(count: number, quotaSpent: boolean): string {
  const tracks = count === 1 ? '1 faixa' : `${count} faixas`;
  return quotaSpent
    ? `Puladas ${tracks} sem vídeo: você chegou ao limite de faixas novas de hoje. As já ouvidas seguem completas.`
    : `Puladas ${tracks} sem vídeo disponível.`;
}

/** São Paulo's calendar day: the day the allowance counts in. */
export const allowanceDay = (now: number = Date.now()): string => new Date(now).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
