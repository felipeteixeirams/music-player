import { useEffect, useMemo, useState } from 'react';
import { findHistoricMatches, loadHistoricIndex, type HistoricEntry } from '../utils/historicCatalog';
import { baseTitle } from '../utils/historicNames';

/** The historic CDs a search names (possibly several volumes of one series). The index loads only when a search needs it. */
export function useHistoricMatches(query: string): HistoricEntry[] {
  const needed = baseTitle(query).length >= 4;
  const [entries, setEntries] = useState<HistoricEntry[] | null>(null);
  useEffect(() => {
    if (needed && entries === null) void loadHistoricIndex().then(setEntries);
  }, [needed, entries]);
  return useMemo(() => (needed && entries ? findHistoricMatches(query, entries) : []), [needed, entries, query]);
}
