import { createRestCaller, type RestConfig } from './supabaseRest';
import { saoPauloDayOf } from './appDays';

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
  } catch {
    // the table may not exist yet (migration not applied) or the network is down: nothing to show, nothing to fix here
  }
}
