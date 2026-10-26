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

/**
 * Why a request was refused, for the answer (`code`, so the app can tell a stale session from a broken server) and
 * for the log. 401 means "sign in again"; 503 means the server cannot tell, which must never sign anybody out.
 */
export type AuthFailureCode =
  | 'no_token'
  | 'invalid_session'
  | 'login_not_configured'
  | 'server_key_rejected'
  | 'auth_unavailable';

export type AuthResult =
  | { ok: true; user: AuthUser | null }
  | { ok: false; status: 401 | 503; message: string; code: AuthFailureCode; detail?: string };

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

export const URL_VARS = ['DATABASE_SUPABASE_URL', 'SUPABASE_URL', 'DATABASE_VITE_SUPABASE_URL', 'VITE_SUPABASE_URL'];
export const KEY_VARS = [
  'DATABASE_VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'DATABASE_VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY'
];

/** Which variables are in use (names only, never values), for the log: a wrong project or key is then easy to spot. */
export function describeAuthConfig(env: Env = process.env): string {
  const urlVar = URL_VARS.find((name) => env[name]);
  const keyVar = KEY_VARS.find((name) => env[name]);
  if (!urlVar || !keyVar) {
    const missing = [!urlVar && 'URL do projeto', !keyVar && 'chave pública'].filter(Boolean).join(' e ');
    return `login NÃO configurado (falta: ${missing})`;
  }
  let host = 'URL inválida';
  try {
    host = new URL(env[urlVar] as string).host;
  } catch {
    // keep the placeholder
  }
  return `login ligado: projeto ${host} (URL de ${urlVar}, chave de ${keyVar})`;
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
  /** Where the one-line description of the configuration goes, once per instance (default: the console). */
  log?: (line: string) => void;
  /** On a managed host a missing configuration refuses everything instead of silently opening the API. */
  failClosed?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

function failure(status: 401 | 503, code: AuthFailureCode, message: string, detail?: string): AuthResult {
  return { ok: false, status, code, message, ...(detail ? { detail } : {}) };
}

/** What Supabase says when it refuses (no secrets in it): the error code, or the start of the message. */
async function refusalDetail(response: Response): Promise<{ detail: string; keyRejected: boolean }> {
  const body = (await response.json().catch(() => null)) as { error_code?: unknown; code?: unknown; msg?: unknown; message?: unknown } | null;
  const text = String(body?.msg ?? body?.message ?? '');
  const code = String(body?.error_code ?? (typeof body?.code === 'string' ? body.code : '') ?? '');
  // A bad or missing project key looks like a bad token to the caller, but it is the server's mistake
  const keyRejected = /api key|apikey/i.test(text) || code === 'invalid_api_key';
  return { detail: `HTTP ${response.status}${code ? ` ${code}` : ''}${text ? `: ${text.slice(0, 120)}` : ''}`, keyRejected };
}

export function createAuthenticator(options: AuthenticatorOptions = {}): Authenticator {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const log = options.log ?? ((line: string) => console.log(line));
  const verified = new Map<string, { user: AuthUser; expiresAt: number }>();
  let announced = false;

  return async (headers) => {
    const config = options.config === undefined ? authConfigFromEnv() : options.config;
    if (!announced) {
      announced = true;
      log(`[Auth] ${describeAuthConfig()}`);
    }
    if (!config) {
      const closed = options.failClosed ?? Boolean(process.env.VERCEL);
      return closed
        ? failure(503, 'login_not_configured', 'Login não configurado no servidor', describeAuthConfig())
        : { ok: true, user: null };
    }

    const token = bearerToken(headers);
    if (!token) return failure(401, 'no_token', 'Entre para continuar');

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
    } catch (err) {
      return failure(503, 'auth_unavailable', 'Não foi possível verificar o login agora', `sem resposta do Supabase (${(err as Error)?.name ?? 'erro'})`);
    }

    if (response.status === 401 || response.status === 403) {
      const { detail, keyRejected } = await refusalDetail(response);
      if (keyRejected) {
        return failure(503, 'server_key_rejected', 'Login mal configurado no servidor', `o Supabase recusou a chave pública do servidor (${detail})`);
      }
      return failure(401, 'invalid_session', 'Sessão expirada. Entre de novo.', detail);
    }
    if (!response.ok) {
      const { detail } = await refusalDetail(response);
      return failure(503, 'auth_unavailable', 'Não foi possível verificar o login agora', detail);
    }

    const body = (await response.json().catch(() => null)) as { id?: unknown; email?: unknown } | null;
    if (typeof body?.id !== 'string') {
      return failure(503, 'auth_unavailable', 'Não foi possível verificar o login agora', 'resposta do Supabase sem id de usuário');
    }

    const user: AuthUser = { id: body.id, email: typeof body.email === 'string' ? body.email : null };
    if (verified.size >= MAX_VERIFIED) verified.clear();
    verified.set(key, { user, expiresAt: now() + VERIFIED_TTL_MS });
    return { ok: true, user };
  };
}

export const authenticate: Authenticator = createAuthenticator();
