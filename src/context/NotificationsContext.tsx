import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { getSession } from '../utils/authClient';
import { readSupabaseConfig } from '../utils/supabaseConfig';
import { countUnread, type AppNotification } from '../utils/notifications';
import { fetchNotifications, markNotificationsRead } from '../utils/notificationsRemote';

export type NotificationsStatus = 'loading' | 'ready' | 'unavailable';

interface NotificationsValue {
  notices: AppNotification[];
  unread: number;
  status: NotificationsStatus;
  /** Reads the box again (opening the app, coming back to the foreground). */
  refresh: () => Promise<void>;
  /** Marks every unread notice as read, on the screen and in the account (INV-NOT-02). */
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue>({
  notices: [],
  unread: 0,
  status: 'loading',
  refresh: async () => {},
  markAllRead: async () => {}
});

export const useNotifications = () => useContext(NotificationsContext);

/**
 * The person's notice box (INV-NOT-01). It reads the account when the app opens and when it comes back to the foreground,
 * the way the rest of the account data does. If the database has no table yet, it says "unavailable" and the app goes on.
 */
export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userId } = useAuth();
  const [notices, setNotices] = useState<AppNotification[]>([]);
  const [status, setStatus] = useState<NotificationsStatus>('loading');
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    const config = readSupabaseConfig();
    const session = await getSession().catch(() => null);
    if (!config || !session || !userId) {
      if (alive.current) setStatus('unavailable');
      return;
    }
    try {
      const next = await fetchNotifications(config, { id: session.user.id, token: session.access_token });
      if (alive.current) {
        setNotices(next);
        setStatus('ready');
      }
    } catch {
      if (alive.current) setStatus('unavailable');
    }
  }, [userId]);

  const markAllRead = useCallback(async () => {
    const config = readSupabaseConfig();
    const session = await getSession().catch(() => null);
    const now = new Date();
    const unreadIds = notices.filter((notice) => notice.readAt === null).map((notice) => notice.id);
    if (unreadIds.length === 0) return;
    setNotices((current) => current.map((notice) => (notice.readAt === null ? { ...notice, readAt: now.toISOString() } : notice)));
    if (!config || !session) return;
    try {
      await markNotificationsRead(config, { id: session.user.id, token: session.access_token }, unreadIds, now);
    } catch {
      // The next read of the account shows what really stayed unread
      void refresh();
    }
  }, [notices, refresh]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const onForeground = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('online', onForeground);
    return () => {
      alive.current = false;
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('online', onForeground);
    };
  }, [refresh]);

  const value = useMemo<NotificationsValue>(
    () => ({ notices, unread: countUnread(notices), status, refresh, markAllRead }),
    [notices, status, refresh, markAllRead]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};
