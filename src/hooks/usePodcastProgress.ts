import { useMemo, useSyncExternalStore } from 'react';
import { progressVersion, readProgress, subscribeProgress, type ProgressMap } from '../utils/podcastProgress';

/** The saved position of every episode, read again whenever one is saved. */
export function usePodcastProgress(storage: Pick<Storage, 'getItem' | 'setItem'> | null): ProgressMap {
  const version = useSyncExternalStore(subscribeProgress, progressVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readProgress(storage), [storage, version]);
}
