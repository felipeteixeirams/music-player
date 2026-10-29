import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { PodcastShowSummary } from '../types/music';
import { isFollowing, loadFollows, saveFollows, toggleFollowIn } from '../utils/podcastFollows';
import { emitUserDataChanged, onUserDataApplied } from '../utils/userDataEvents';

const SAME_TAB = 'aurastream-podcast-follows';

/** The shows this person follows (the account's list), and the toggle: every screen that shows it stays in step. */
export function usePodcastFollows() {
  const { storage } = useAuth();
  const [shows, setShows] = useState<PodcastShowSummary[]>(() => loadFollows(storage));

  useEffect(() => {
    const read = () => setShows(loadFollows(storage));
    read();
    const stopApplied = onUserDataApplied(read);
    window.addEventListener(SAME_TAB, read);
    return () => {
      stopApplied();
      window.removeEventListener(SAME_TAB, read);
    };
  }, [storage]);

  const toggle = useCallback(
    (show: PodcastShowSummary) => {
      const next = toggleFollowIn(loadFollows(storage), show);
      saveFollows(storage, next);
      setShows(next);
      window.dispatchEvent(new Event(SAME_TAB));
      emitUserDataChanged();
    },
    [storage]
  );

  return { shows, isFollowing: (showId: string) => isFollowing(shows, showId), toggle };
}
