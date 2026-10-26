import { useEffect } from 'react';
import { getSession } from '../utils/authClient';
import { readSupabaseConfig } from '../utils/supabaseConfig';
import type { KeyValueStorage } from '../utils/scopedStorage';
import { emitUserDataApplied, onUserDataChanged } from '../utils/userDataEvents';
import { createRemote } from '../utils/userDataRemote';
import { UserDataSync } from '../utils/userDataSync';

/** Keeps this device's favorites, playlists and picks in step with the signed-in user's account. Renders nothing. */
export const SyncAgent: React.FC<{ userId: string; storage: KeyValueStorage }> = ({ userId, storage }) => {
  useEffect(() => {
    const config = readSupabaseConfig();
    if (!config) return;

    const remote = createRemote(config, async () => {
      const session = await getSession();
      return session ? { id: userId, token: session.access_token } : null;
    });
    const sync = new UserDataSync({ storage, remote, onApplied: emitUserDataApplied });

    const stopListening = onUserDataChanged(() => sync.notifyChanged());
    let lastRefresh = Date.now();
    const refresh = () => {
      // Waking the app up several times in a row is one refresh
      if (Date.now() - lastRefresh < 30_000) return;
      lastRefresh = Date.now();
      sync.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onOnline = () => {
      lastRefresh = 0;
      refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    sync.start();

    return () => {
      sync.dispose();
      stopListening();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [userId, storage]);

  return null;
};
