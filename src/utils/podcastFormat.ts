/** "1 h 10 min" / "57 min" / "9 min": the length of an episode as shown in a list. */
export function formatEpisodeLength(seconds: number): string {
  if (!(seconds > 0)) return '';
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`;
}

/** "faltam 38 min" for an episode in progress. */
export function formatTimeLeft(totalSeconds: number, share: number): string {
  const left = formatEpisodeLength(totalSeconds * (1 - share));
  return left ? `faltam ${left}` : '';
}

/** "25 mai 2020" from an ISO date; "" when it has none. */
export function formatEpisodeDate(iso: string): string {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Date(time).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(/\./g, '') : '';
}
