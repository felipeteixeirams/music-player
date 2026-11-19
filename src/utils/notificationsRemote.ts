import { createRestCaller, RemoteError, type RestConfig } from './supabaseRest';
import { parseNotifications, type AppNotification } from './notifications';

export const NOTIFICATIONS_LIMIT = 50;

export interface NotificationsUser {
  id: string;
  token: string;
}

/**
 * The person's latest notices (INV-NOT-01), read with their own token: the row-level security policy only returns
 * their rows. Throws a RemoteError when the table is missing or the database refuses.
 */
export async function fetchNotifications(config: RestConfig, user: NotificationsUser, fetchImpl: typeof fetch = fetch): Promise<AppNotification[]> {
  const call = createRestCaller(config, async () => user, fetchImpl);
  const response = await call(
    `/user_notifications?select=id,kind,payload,created_at,read_at&order=created_at.desc&limit=${NOTIFICATIONS_LIMIT}`
  );
  const rows: unknown = await response.json().catch(() => null);
  if (!Array.isArray(rows)) throw new RemoteError('Resposta inesperada ao ler os avisos', response.status);
  return parseNotifications(rows);
}

/**
 * Marks the given notices as read (INV-NOT-02). Only `read_at` can change: the column grant and the policy refuse
 * anything else. Notices already read are left as they are.
 */
export async function markNotificationsRead(
  config: RestConfig,
  user: NotificationsUser,
  ids: string[],
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const safe = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
  if (safe.length === 0) return;
  const call = createRestCaller(config, async () => user, fetchImpl);
  await call(`/user_notifications?id=in.(${safe.join(',')})&read_at=is.null`, {
    method: 'PATCH',
    body: JSON.stringify({ read_at: now.toISOString() }),
    prefer: 'return=minimal'
  });
}
