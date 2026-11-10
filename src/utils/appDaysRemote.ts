import { createRestCaller, type RestConfig } from './supabaseRest';
import { saoPauloDayOf } from './appDays';
import { reportClientError } from './errorReporter';
import { RemoteError } from './supabaseRest';

/**
 * Records that the signed-in person opened the app today (INV-ADMIN-03): one row per person and day, written with the
 * person's own token, so the database accepts only their own rows. Repeating the call on the same day changes nothing.
 * Never throws: the record is a count for the administrator, not something the app needs to work.
 */
export async function recordAppOpen(
  config: RestConfig,
  getUser: () => Promise<{ id: string; token: string } | null>,
  now: number = Date.now(),
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const user = await getUser().catch(() => null);
  if (!user) return;
  const call = createRestCaller(config, async () => user, fetchImpl);
  try {
    await call('/app_days?on_conflict=user_id,day', {
      method: 'POST',
      body: JSON.stringify([{ user_id: user.id, day: saoPauloDayOf(now) }]),
      prefer: 'resolution=ignore-duplicates,return=minimal'
    });
  } catch (error) {
    // Nothing for the person to see, but the reason goes to the server's log (as [Client]): a row that never lands is
    // otherwise invisible. The reason is the status and the start of the database's answer, never a token.
    if (error instanceof RemoteError) {
      void reportClientError('error', `uso diário: ${error.status} ${error.detail ?? error.message}`);
    } else {
      void reportClientError('error', `uso diário: ${error instanceof Error ? error.message : 'erro'}`);
    }
  }
}
