import { useEffect } from 'react';
import { getSession } from '../utils/authClient';
import { readSupabaseConfig } from '../utils/supabaseConfig';
import type { KeyValueStorage } from '../utils/scopedStorage';
import { emitHistoryApplied, emitUserDataApplied, onHistoryChanged, onUserDataChanged } from '../utils/userDataEvents';
import { createHistoryRemote } from '../utils/playHistoryRemote';
import { PlayHistorySync } from '../utils/playHistorySync';
import { createProgressRemote } from '../utils/podcastProgressRemote';
import { PodcastProgressSync } from '../utils/podcastProgressSync';
import { subscribeProgress } from '../utils/podcastProgress';
import { createRemote } from '../utils/userDataRemote';
import { UserDataSync } from '../utils/userDataSync';
import { recordAppOpen } from '../utils/appDaysRemote';
import { saoPauloDayOf } from '../utils/appDays';

/** Keeps this device's favorites, playlists, picks and play history in step with the signed-in user's account. Renders nothing. */
export const SyncAgent: React.FC<{ userId: string; storage: KeyValueStorage }> = ({ userId, storage }) => {
  useEffect(() => {
    const config = readSupabaseConfig();
    if (!config) return;

    // The id must be the one the token belongs to: the database checks the row's user_id against it (INV-ADMIN-03).
    // A stale id from the stored account made the daily-use write fail with a row-level-security refusal (production, 2026-11-16).
    const getUser = async () => {
      const session = await getSession();
      return session ? { id: session.user.id, token: session.access_token } : null;
    };
    // One row per day the app is in use (INV-ADMIN-03). Recorded when the app starts and again when it comes back to the
    // front: an iPhone app that wakes from the background does not start again, so a day could otherwise go unrecorded.
    // A day is recorded once; a failed record is tried again on the next wake-up.
    let recordedDay = '';
    const recordOpen = () => {
      const today = saoPauloDayOf(Date.now());
      if (today === recordedDay) return;
      void recordAppOpen(config, getUser).then((ok) => {
        if (ok) recordedDay = today;
      });
    };
    recordOpen();
    const sync = new UserDataSync({ storage, remote: createRemote(config, getUser), onApplied: emitUserDataApplied });
    const history = new PlayHistorySync({ storage, remote: createHistoryRemote(config, getUser), onApplied: emitHistoryApplied });
    const progress = new PodcastProgressSync({ storage, remote: createProgressRemote(config, getUser) });

    const stopListening = onUserDataChanged(() => sync.notifyChanged());
    const stopHistory = onHistoryChanged(() => history.notifyChanged());
    const stopProgress = subscribeProgress(() => progress.notifyChanged());
    let lastRefresh = Date.now();
    const refresh = () => {
      // Waking the app up several times in a row is one refresh
      if (Date.now() - lastRefresh < 30_000) return;
      lastRefresh = Date.now();
      sync.refresh();
      history.refresh();
      progress.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refresh();
        recordOpen();
      }
      // Leaving the app: what was listened to goes to the account now, not after the wait
      else progress.flush();
    };
    const onOnline = () => {
      lastRefresh = 0;
      refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    sync.start();
    history.start();
    progress.start();

    return () => {
      sync.dispose();
      history.dispose();
      progress.dispose();
      stopListening();
      stopHistory();
      stopProgress();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [userId, storage]);

  return null;
};
