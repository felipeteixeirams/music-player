import { authenticate, type AuthUser } from './_auth.js';

type Headers = Record<string, string | string[] | undefined>;

function header(headers: Headers, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Fixed-window counter per key, in the memory of one function instance. On a serverless platform each warm
 * instance counts on its own, so this blunts a script hammering one instance and the ordinary runaway client,
 * but is not a global quota: a distributed attack needs the platform firewall or a shared store.
 */
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 5000,
    private readonly now: () => number = Date.now
  ) {}

  check(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = this.now();
    let entry = this.windows.get(key);
    if (!entry || entry.resetAt <= now) {
      this.prune(now);
      entry = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, entry);
    }
    entry.count += 1;
    return { allowed: entry.count <= this.limit, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }

  /** Bounds memory: drops expired windows and, if still over the cap, the oldest ones. */
  private prune(now: number): void {
    if (this.windows.size < this.maxKeys) return;
    for (const [key, entry] of this.windows) if (entry.resetAt <= now) this.windows.delete(key);
    for (const key of this.windows.keys()) {
      if (this.windows.size < this.maxKeys) break;
      this.windows.delete(key);
    }
  }
}

/** The caller's address as the platform proxy reports it. */
export function clientKey(headers: Headers): string {
  const forwarded = header(headers, 'x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || header(headers, 'x-real-ip') || 'unknown';
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Whether the request comes from this site's own pages. Browsers label every request with `Sec-Fetch-Site`;
 * without it (older browsers) the `Origin` or `Referer` host is compared with the request's host. A request
 * with none of these signals is not a page of ours. Anyone can forge the headers with a script: this only
 * stops other websites and naive scripts from using the API (and its quotas) as their own.
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const site = header(headers, 'sec-fetch-site');
  if (site) return site === 'same-origin';

  const host = header(headers, 'x-forwarded-host') ?? header(headers, 'host');
  const origin = header(headers, 'origin');
  const referer = header(headers, 'referer');
  const from = origin && origin !== 'null' ? hostOf(origin) : referer ? hostOf(referer) : null;
  return Boolean(host && from && from === host);
}

export interface GuardPolicy {
  limiter: RateLimiter;
  requireSameOrigin: boolean;
}

export type GuardDecision =
  | { ok: true; user?: AuthUser | null }
  | { ok: false; status: 401 | 403 | 429 | 503; message: string; code?: string; retryAfterSeconds?: number };

export function evaluateRequest(headers: Headers, policy: GuardPolicy): GuardDecision {
  if (policy.requireSameOrigin && !isSameOriginRequest(headers)) {
    return { ok: false, status: 403, message: 'Requisição de origem não permitida' };
  }
  const { allowed, retryAfterSeconds } = policy.limiter.check(clientKey(headers));
  if (!allowed) {
    return { ok: false, status: 429, message: 'Muitas requisições. Tente de novo em instantes.', retryAfterSeconds };
  }
  return { ok: true };
}

/**
 * The origin and rate checks, then who is calling: the login the app sends with every request. The cheap checks
 * come first so a flood never reaches Supabase. Health aside, no route answers anonymously.
 */
export async function authorizeRequest(
  headers: Headers,
  policy: GuardPolicy,
  request: { method?: string; url?: string } = {}
): Promise<GuardDecision> {
  const decision = evaluateRequest(headers, policy);
  if (!decision.ok) return decision;
  const auth = await authenticate(headers);
  if (auth.ok) return { ok: true, user: auth.user };
  // Say why in the log (no tokens or keys in it): a 401 on its own cannot be told from a misconfigured server
  const where = `${request.method ?? 'GET'} ${(request.url ?? '').split('?')[0]}`.trim();
  console.warn(`[Auth] ${auth.status} ${auth.code}${auth.detail ? ` (${auth.detail})` : ''} ${where}`);
  return { ok: false, status: auth.status, message: auth.message, code: auth.code };
}

/** Per-instance policies: the YouTube search and the audio copy cost the most, so they get the tightest limits. */
export const POLICIES = {
  resolve: { limiter: new RateLimiter(40, 60_000), requireSameOrigin: true },
  audio: { limiter: new RateLimiter(30, 60_000), requireSameOrigin: true },
  catalog: { limiter: new RateLimiter(120, 60_000), requireSameOrigin: true }
} satisfies Record<string, GuardPolicy>;

interface HttpRequestLike {
  headers?: Headers;
  method?: string;
  url?: string;
}
interface HttpResponseLike {
  setHeader(name: string, value: string): unknown;
  status(code: number): { json(body: unknown): unknown };
}

/**
 * Applies a policy to a Vercel handler's request; when it refuses, the answer has already been sent and this
 * returns false. A call without a headers object is not an HTTP request (internal calls and unit tests).
 */
export async function guard(req: HttpRequestLike, res: HttpResponseLike, policy: GuardPolicy): Promise<boolean> {
  return (await guardUser(req, res, policy)) !== null;
}

/** Like `guard`, for routes that need to know who is calling: the user (null when login is off), or null when refused. */
export async function guardUser(
  req: HttpRequestLike,
  res: HttpResponseLike,
  policy: GuardPolicy
): Promise<{ user: AuthUser | null } | null> {
  if (!req.headers) return { user: null };
  const decision = await authorizeRequest(req.headers, policy, { method: req.method, url: req.url });
  if (decision.ok) return { user: decision.user ?? null };
  if (decision.retryAfterSeconds) res.setHeader('Retry-After', String(decision.retryAfterSeconds));
  res.status(decision.status).json({ error: decision.message, ...(decision.code ? { code: decision.code } : {}) });
  return null;
}
