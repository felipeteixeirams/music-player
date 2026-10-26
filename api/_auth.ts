import { createHash } from 'node:crypto';

type Headers = Record<string, string | string[] | undefined>;
type Env = Record<string, string | undefined>;

export interface AuthUser {
  id: string;
  email: string | null;
}

/** Where to ask who a token belongs to. `apiKey` is the project's public (anon/publishable) key. */
export interface AuthConfig {
  url: string;
  apiKey: string;
}

export type AuthResult =
  | { ok: true; user: AuthUser | null }
  | { ok: false; status: 401 | 503; message: string };

/**
 * The Vercel integration prefixes the Supabase variables with DATABASE_ (the prefix chosen when the database was
 * connected); the unprefixed names work for local runs and other hosts. Without them, login is off.
 */
export function authConfigFromEnv(env: Env = process.env): AuthConfig | null {
  const url = env.DATABASE_SUPABASE_URL || env.SUPABASE_URL || env.DATABASE_VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
  const apiKey =
    env.DATABASE_VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.DATABASE_VITE_SUPABASE_PUBLISHABLE_KEY
    || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  return url && apiKey ? { url: url.replace(/\/+$/, ''), apiKey } : null;
}

function bearerToken(headers: Headers): string | null {
  const raw = headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = value?.match(/^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i);
  return match && match[1].length <= 4096 ? match[1] : null;
}

/** A verified token is remembered briefly: each request would otherwise cost a round trip to Supabase. */
const VERIFIED_TTL_MS = 60_000;
const MAX_VERIFIED = 500;

export interface Authenticator {
  (headers: Headers): Promise<AuthResult>;
}

export interface AuthenticatorOptions {
  config?: AuthConfig | null;
  /** On a managed host a missing configuration refuses everything instead of silently opening the API. */
  failClosed?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export function createAuthenticator(options: AuthenticatorOptions = {}): Authenticator {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const verified = new Map<string, { user: AuthUser; expiresAt: number }>();

  return async (headers) => {
    const config = options.config === undefined ? authConfigFromEnv() : options.config;
    if (!config) {
      const failClosed = options.failClosed ?? Boolean(process.env.VERCEL);
      return failClosed
        ? { ok: false, status: 503, message: 'Login não configurado no servidor' }
        : { ok: true, user: null };
    }

    const token = bearerToken(headers);
    if (!token) return { ok: false, status: 401, message: 'Entre para continuar' };

    const key = createHash('sha256').update(token).digest('hex');
    const hit = verified.get(key);
    if (hit && hit.expiresAt > now()) return { ok: true, user: hit.user };
    verified.delete(key);

    let response: Response;
    try {
      response = await fetchImpl(`${config.url}/auth/v1/user`, {
        headers: { apikey: config.apiKey, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000)
      });
    } catch {
      return { ok: false, status: 503, message: 'Não foi possível verificar o login agora' };
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: 401, message: 'Sessão expirada. Entre de novo.' };
    }
    if (!response.ok) return { ok: false, status: 503, message: 'Não foi possível verificar o login agora' };

    const body = (await response.json().catch(() => null)) as { id?: unknown; email?: unknown } | null;
    if (typeof body?.id !== 'string') return { ok: false, status: 503, message: 'Não foi possível verificar o login agora' };

    const user: AuthUser = { id: body.id, email: typeof body.email === 'string' ? body.email : null };
    if (verified.size >= MAX_VERIFIED) verified.clear();
    verified.set(key, { user, expiresAt: now() + VERIFIED_TTL_MS });
    return { ok: true, user };
  };
}

export const authenticate: Authenticator = createAuthenticator();
