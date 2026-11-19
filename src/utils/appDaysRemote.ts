import { createRestCaller, type RestConfig } from './supabaseRest';
import { saoPauloDayOf } from './appDays';
import { reportClientError } from './errorReporter';
import { RemoteError } from './supabaseRest';

/**
 * What the server's log gets when the daily-use write is refused: the status, the start of the database's answer, and the
 * account id the device sent (the same id the token belongs to). Compared with the token's owner in the logs, it shows
 * whether the device and the token disagree (INV-ADMIN-03). Never the token.
 */
export function dailyUseFailureMessage(error: unknown, userId: string): string {
  const reason =
    error instanceof RemoteError
      ? `${error.status} ${error.detail ?? error.message}`
      : error instanceof Error
        ? error.message
        : 'erro';
  return `uso diário: ${reason} (conta ${userId})`;
}

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
): Promise<boolean> {
  const user = await getUser().catch(() => null);
  if (!user) return false;
  const call = createRestCaller(config, async () => user, fetchImpl);
  try {
    await call('/app_days?on_conflict=user_id,day', {
      method: 'POST',
      body: JSON.stringify([{ user_id: user.id, day: saoPauloDayOf(now) }]),
      prefer: 'resolution=ignore-duplicates,return=minimal'
    });
    return true;
  } catch (error) {
    // Nothing for the person to see, but the reason goes to the server's log (as [Client]): a row that never lands is
    // otherwise invisible. The reason is the status and the start of the database's answer, never a token.
    void reportClientError('error', dailyUseFailureMessage(error, user.id));
    return false;
  }
}
