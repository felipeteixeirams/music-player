import type { AuthUser } from './_auth.js';
import { cachedDeepConfig, checkStaticConfig, type Finding } from './_config.js';
import { breakerFor, DEFAULT_DAILY_NEW_TRACKS } from './_resolveEndpoint.js';
import { adminConfigFromEnv, createAdmin, saoPauloDay, type Admin } from './_supabaseAdmin.js';
import type { YoutubeBreaker } from './_youtubeBreaker.js';

type Env = Record<string, string | undefined>;

/** The administrators: the e-mails in `ADMIN_EMAILS` (comma separated, any case). The server decides; the app only hides the door. */
export function isAdminUser(user: AuthUser | null, env: Env = process.env): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  return (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

export interface AdminDeps {
  admin: Admin | null;
  breaker: YoutubeBreaker;
  findings: () => Promise<Finding[]>;
  dailyLimit: number;
  now: () => number;
  env: Env;
}

function defaultDeps(): AdminDeps {
  const config = adminConfigFromEnv();
  const admin = config ? createAdmin(config) : null;
  const limit = Number(process.env.DAILY_NEW_TRACKS);
  return {
    admin,
    breaker: breakerFor(admin),
    findings: async () => [...checkStaticConfig(), ...(await cachedDeepConfig())],
    dailyLimit: Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_DAILY_NEW_TRACKS,
    now: Date.now,
    env: process.env
  };
}

export interface AdminResult {
  status: number;
  body: unknown;
}

/**
 * GET /api/admin?me=1: whether the caller is an administrator (anyone may ask; the answer is for the app to show or hide the
 * entry). GET /api/admin: the panel's data, only for an administrator (403 for anyone else, with nothing in the body).
 * Accounts' e-mails appear only here, and never in a log.
 */
export async function adminEndpoint(query: Record<string, unknown>, user: AuthUser | null, deps: AdminDeps = defaultDeps()): Promise<AdminResult> {
  const admin = isAdminUser(user, deps.env);
  if (query.me !== undefined) return { status: 200, body: { admin } };
  if (!admin) return { status: 403, body: { error: 'Acesso restrito' } };

  const now = deps.now();
  const day = saoPauloDay(now);
  const [breaker, findings, usage, users, cached] = await Promise.all([
    deps.breaker.check().catch(() => null),
    deps.findings().catch(() => [] as Finding[]),
    deps.admin?.usageByDay(day).catch(() => null) ?? null,
    deps.admin?.listUsers().catch(() => null) ?? null,
    deps.admin?.cacheCount().catch(() => null) ?? null
  ]);
  const perPerson = Object.entries(usage ?? {})
    .map(([id, used]) => ({ email: users?.[id] || 'conta sem e-mail', used }))
    .sort((a, b) => b.used - a.used);
  const searchesToday = perPerson.reduce((total, person) => total + person.used, 0);

  return {
    status: 200,
    body: {
      day,
      youtube: {
        search: breaker ? 'suspended' : 'normal',
        ...(breaker ? { reason: breaker.reason, until: breaker.until } : {}),
        // Each new track costs one allowance unit; an official search costs 100 of the 10,000 daily units (some went to the web search)
        searchesToday,
        unitsUpperBound: searchesToday * 100
      },
      limits: { dailyNewTracks: deps.dailyLimit },
      people: { counted: perPerson.length, accounts: users ? Object.keys(users).length : null, perPerson },
      cache: { tracks: cached },
      config: findings.map(({ id, level, message }) => ({ id, level, message })),
      database: deps.admin ? 'ok' : 'off'
    }
  };
}
