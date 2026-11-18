import { useMemo } from 'react';
import { usePlayHistory } from './usePlayHistory';
import { computePlayStats, type PlayStats } from '../utils/playStats';

/**
 * Hook providing computed listening statistics and top played tracks/artists
 * derived from the authenticated user's play history.
 */
export function usePlayStats(): PlayStats {
  const { entries } = usePlayHistory();
  return useMemo(() => computePlayStats(entries), [entries]);
}
