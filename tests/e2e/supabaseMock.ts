import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

/** A stand-in for the Supabase Auth and REST APIs, so the end-to-end tests never depend on a real project. */
export const MOCK_PORT = 3115;
export const MOCK_URL = `http://localhost:${MOCK_PORT}`;
export const TEST_ANON_KEY = 'e2e-anon-key';
/** Any address under this domain counts as invited; every other one is refused like a closed sign-up would. */
export const INVITED_DOMAIN = '@convidado.test';
export const VALID_CODE = '123456';
/** Like the real server: a code lives 90 s and the same address can ask for another only after 60 s. */
const CODE_TTL_MS = 90_000;
const COOLDOWN_MS = 60_000;
/** Addresses with these prefixes get special treatment, to test what would take too long in real time. */
export const NO_COOLDOWN_PREFIX = 'rapido';
export const EXPIRED_CODE_PREFIX = 'expirado';
/** The project's e-mails per hour are used up: every request is refused, whoever asks. */
export const HOURLY_LIMIT_PREFIX = 'limite';
/** The mail server of the project refuses to send (wrong SMTP settings): Supabase answers 500. */
export const SMTP_FAILURE_PREFIX = 'smtp';
const issued = new Map<string, number>();

const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const DEFAULT_USER_ID = '00000000-0000-0000-0000-0000000000e2';

/** A token the mock accepts: the user is read from it, and nothing else is checked but the "e2e" signature. */
export const tokenFor = (id: string, email: string) =>
  `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: id, email, role: 'authenticated', exp: 4102444800 })}.e2e`;

function readToken(header: string | undefined): { id: string; email: string } | null {
  const token = header?.replace(/^Bearer /, '');
  const [, payload, signature] = token?.split('.') ?? [];
  if (!payload || signature !== 'e2e') return null;
  try {
    const { sub, email } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof sub === 'string' ? { id: sub, email: String(email ?? '') } : null;
  } catch {
    return null;
  }
}

export const ACCESS_TOKEN = tokenFor(DEFAULT_USER_ID, `ana${INVITED_DOMAIN}`);

export const userFor = (email: string, id = DEFAULT_USER_ID) => ({
  id,
  aud: 'authenticated',
  role: 'authenticated',
  email,
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z'
});

export const sessionFor = (email: string, id = DEFAULT_USER_ID) => ({
  access_token: tokenFor(id, email),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: 'e2e-refresh',
  user: userFor(email, id)
});

/** A person of its own: a test that signs in as one never shares favorites or playlists with another test. */
export function testUser(name = 'ana') {
  const id = randomUUID();
  const email = `${name}-${id.slice(0, 8)}${INVITED_DOMAIN}`;
  return { id, email, session: sessionFor(email, id) };
}

/** The session of someone already signed in, as the app keeps it in localStorage. */
export const STORED_SESSION = sessionFor(`ana${INVITED_DOMAIN}`);
export const STORAGE_KEY = 'aurastream-auth';

type Row = Record<string, unknown>;
interface UserStore {
  favorites: Map<string, Row>;
  playlists: Map<string, Row>;
  playlist_tracks: Map<string, Row>;
  video_choices: Map<string, Row>;
  play_history: Map<string, Row>;
}
const KEYS: Record<keyof UserStore, string[]> = {
  favorites: ['track_id'],
  playlists: ['id'],
  playlist_tracks: ['playlist_id', 'track_id'],
  video_choices: ['track_id'],
  play_history: ['id']
};
let nextHistoryId = 1;
const stores = new Map<string, UserStore>();
const storeOf = (userId: string): UserStore => {
  let store = stores.get(userId);
  if (!store) {
    store = { favorites: new Map(), playlists: new Map(), playlist_tracks: new Map(), video_choices: new Map(), play_history: new Map() };
    stores.set(userId, store);
  }
  return store;
};

const SORTS: Record<keyof UserStore, string[]> = {
  favorites: ['created_at', 'track_id'],
  playlists: ['created_at', 'id'],
  playlist_tracks: ['playlist_id', 'position', 'track_id'],
  video_choices: ['track_id'],
  play_history: ['played_at', 'id']
};

function sortRows(table: keyof UserStore, rows: Row[]): Row[] {
  const sign = table === 'play_history' ? -1 : 1; // the history is read newest first
  return [...rows].sort((a, b) => {
    for (const column of SORTS[table]) {
      if (a[column]! < b[column]!) return -sign;
      if (a[column]! > b[column]!) return sign;
    }
    return 0;
  });
}

/** `col=eq.x` and `col=in.("a","b")` filters, the only ones the app sends. */
function matches(row: Row, params: URLSearchParams): boolean {
  for (const [column, filter] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(column)) continue;
    if (filter.startsWith('eq.')) {
      if (String(row[column]) !== filter.slice(3)) return false;
    } else if (filter.startsWith('in.(')) {
      const values = [...filter.slice(4, -1).matchAll(/"([^"]*)"|([^,]+)/g)].map((m) => m[1] ?? m[2]);
      if (!values.includes(String(row[column]))) return false;
    }
  }
  return true;
}

function handleRest(
  method: string,
  table: keyof UserStore,
  params: URLSearchParams,
  userId: string,
  body: unknown
): { status: number; body?: unknown } {
  const store = storeOf(userId);
  const rows = store[table];
  const keyOf = (row: Row) => KEYS[table].map((column) => String(row[column])).join('|');

  if (method === 'GET') {
    const all = sortRows(table, [...rows.values()]).filter((row) => matches(row, params));
    const offset = Number(params.get('offset') ?? 0);
    const limit = Number(params.get('limit') ?? all.length);
    return { status: 200, body: all.slice(offset, offset + limit) };
  }
  if (method === 'POST' && table === 'play_history') {
    for (const row of body as Row[]) {
      const id = nextHistoryId++;
      rows.set(String(id), { id, ...row });
    }
    return { status: 201 };
  }
  if (method === 'POST') {
    for (const row of body as Row[]) {
      if (table === 'playlist_tracks' && !store.playlists.has(String(row.playlist_id))) return { status: 409, body: { msg: 'no playlist' } };
      const key = keyOf(row);
      rows.set(key, { created_at: new Date().toISOString(), ...(rows.get(key) ?? {}), ...row });
    }
    return { status: 201 };
  }
  if (method === 'DELETE') {
    for (const [key, row] of [...rows]) {
      if (matches(row, params)) {
        rows.delete(key);
        if (table === 'playlists') {
          for (const [trackKey, track] of [...store.playlist_tracks]) if (track.playlist_id === row.id) store.playlist_tracks.delete(trackKey);
        }
      }
    }
    return { status: 204 };
  }
  return { status: 405 };
}

export function startMockSupabase(port = MOCK_PORT) {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', MOCK_URL);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    const send = (status: number, body: unknown = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(status === 204 ? undefined : JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return send(204);
    if (url.pathname === '/health') return send(200, { ok: true });

    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      const caller = readToken(req.headers.authorization);

      // What the account holds, for the tests to check: GET /__state/<user id>
      if (url.pathname.startsWith('/__state/')) {
        const store = storeOf(url.pathname.slice('/__state/'.length));
        return send(200, Object.fromEntries(Object.entries(store).map(([table, rows]) => [table, sortRows(table as keyof UserStore, [...rows.values()])])));
      }
      if (url.pathname.startsWith('/rest/v1/')) {
        const table = url.pathname.slice('/rest/v1/'.length) as keyof UserStore;
        if (!caller) return send(401, { msg: 'invalid JWT' });
        if (!(table in KEYS)) return send(404, { msg: 'unknown table' });
        const result = handleRest(req.method ?? 'GET', table, url.searchParams, caller.id, body);
        return send(result.status, result.body);
      }
      if (url.pathname === '/auth/v1/otp') {
        const email = String(body.email).toLowerCase();
        if (!email.endsWith(INVITED_DOMAIN)) {
          return send(422, { code: 'otp_disabled', error_code: 'otp_disabled', msg: 'Signups not allowed for otp' });
        }
        if (email.startsWith(SMTP_FAILURE_PREFIX)) {
          return send(500, { code: 'unexpected_failure', error_code: 'unexpected_failure', msg: 'Error sending magic link email' });
        }
        if (email.startsWith(HOURLY_LIMIT_PREFIX)) {
          return send(429, { code: 'over_email_send_rate_limit', error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' });
        }
        const last = issued.get(email);
        const cooldown = email.startsWith(NO_COOLDOWN_PREFIX) ? 0 : COOLDOWN_MS;
        if (last !== undefined && Date.now() - last < cooldown) {
          const wait = Math.ceil((cooldown - (Date.now() - last)) / 1000);
          return send(429, {
            code: 'over_email_send_rate_limit',
            error_code: 'over_email_send_rate_limit',
            msg: `For security purposes, you can only request this after ${wait} seconds.`
          });
        }
        // An address that starts with "expirado" gets a code that is already expired
        issued.set(email, email.startsWith(EXPIRED_CODE_PREFIX) ? Date.now() - CODE_TTL_MS - 1 : Date.now());
        return send(200);
      }
      if (url.pathname === '/auth/v1/verify') {
        const issuedAt = issued.get(String(body.email).toLowerCase());
        const alive = issuedAt !== undefined && Date.now() - issuedAt <= CODE_TTL_MS;
        return alive && body.token === VALID_CODE
          ? send(200, sessionFor(String(body.email)))
          : send(403, { code: 'otp_expired', error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      }
      if (url.pathname === '/auth/v1/user') {
        return caller ? send(200, userFor(caller.email, caller.id)) : send(401, { code: 401, msg: 'invalid JWT' });
      }
      if (url.pathname === '/auth/v1/token') return send(200, caller ? sessionFor(caller.email, caller.id) : STORED_SESSION);
      if (url.pathname === '/auth/v1/logout') return send(204);
      return send(404, { msg: 'not found' });
    });
  }).listen(port);
}
