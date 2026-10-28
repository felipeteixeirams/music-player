import { authConfigFromEnv } from './_auth.js';
import { cachedDeepConfig, checkStaticConfig, publicReport, reportStartupOnce } from './_config.js';
import { adminConfigFromEnv, createAdmin } from './_supabaseAdmin.js';
import { breakerFor } from './_resolveEndpoint.js';

/**
 * The public health answer. `login` and `cache` say whether the server has what it needs for each; `config` lists
 * which checks failed (ids only, never variable names or values). With `deep`, the services are asked too (the
 * answer is remembered for a few minutes): the pipeline uses that after each deploy.
 */
export async function healthBody(deep: boolean, extra: Record<string, unknown> = {}) {
  reportStartupOnce();
  const config = publicReport(checkStaticConfig());
  const services = deep ? publicReport(await cachedDeepConfig()) : undefined;
  // With `deep`: whether the official YouTube search is on ("normal") or off because the day's quota is spent ("suspended")
  const adminConfig = adminConfigFromEnv();
  const youtubeSearch = deep ? ((await breakerFor(adminConfig ? createAdmin(adminConfig) : null).check().catch(() => null)) ? 'suspended' : 'normal') : undefined;
  return {
    status: 'ok',
    login: authConfigFromEnv() !== null,
    cache: adminConfigFromEnv() !== null,
    config,
    ...(services ? { services } : {}),
    ...(youtubeSearch ? { youtubeSearch } : {}),
    ...extra
  };
}
