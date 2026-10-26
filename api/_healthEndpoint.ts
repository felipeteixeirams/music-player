import { authConfigFromEnv } from './_auth.js';
import { cachedDeepConfig, checkStaticConfig, publicReport, reportStartupOnce } from './_config.js';
import { adminConfigFromEnv } from './_supabaseAdmin.js';

/**
 * The public health answer. `login` and `cache` say whether the server has what it needs for each; `config` lists
 * which checks failed (ids only, never variable names or values). With `deep`, the services are asked too (the
 * answer is remembered for a few minutes): the pipeline uses that after each deploy.
 */
export async function healthBody(deep: boolean, extra: Record<string, unknown> = {}) {
  reportStartupOnce();
  const config = publicReport(checkStaticConfig());
  const services = deep ? publicReport(await cachedDeepConfig()) : undefined;
  return {
    status: 'ok',
    login: authConfigFromEnv() !== null,
    cache: adminConfigFromEnv() !== null,
    config,
    ...(services ? { services } : {}),
    ...extra
  };
}
