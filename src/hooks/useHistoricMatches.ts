import { useEffect, useState } from 'react';
import { findHistoricMatches, type HistoricEntry, type HistoricIndex } from '../utils/historicCatalog';

let cachedIndex: HistoricIndex | null = null;
let indexFetchPromise: Promise<HistoricIndex | null> | null = null;

async function getHistoricIndex(): Promise<HistoricIndex | null> {
  if (cachedIndex) return cachedIndex;
  if (!indexFetchPromise) {
    indexFetchPromise = fetch('/historic/index.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HistoricIndex>;
      })
      .then((index) => {
        cachedIndex = index;
        return index;
      })
      .catch((err) => {
        indexFetchPromise = null;
        return null;
      });
  }
  return indexFetchPromise;
}

/**
 * Returns matching historic CD compilations for the current search query,
 * enforcing series-only match rules (INV-CAT-03).
 */
export function useHistoricMatches(query: string): HistoricEntry[] {
  const [matches, setMatches] = useState<HistoricEntry[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 3) {
      setMatches([]);
      return;
    }

    let isSubscribed = true;

    getHistoricIndex().then((index) => {
      if (!isSubscribed) return;
      const found = findHistoricMatches(trimmed, index);
      setMatches(found);
    });

    return () => {
      isSubscribed = false;
    };
  }, [query]);

  return matches;
}
