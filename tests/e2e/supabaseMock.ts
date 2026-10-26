import { createServer } from 'node:http';

/** A stand-in for the Supabase Auth API, so the end-to-end tests never depend on a real project. */
export const MOCK_PORT = 3115;
export const MOCK_URL = `http://localhost:${MOCK_PORT}`;
export const TEST_ANON_KEY = 'e2e-anon-key';
/** Any address under this domain counts as invited; every other one is refused like a closed sign-up would. */
export const INVITED_DOMAIN = '@convidado.test';
export const VALID_CODE = '123456';

const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const USER_ID = '00000000-0000-0000-0000-0000000000e2';
export const ACCESS_TOKEN = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: USER_ID, role: 'authenticated', exp: 4102444800 })}.e2e`;

export const userFor = (email: string) => ({
  id: USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email,
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z'
});

export const sessionFor = (email: string) => ({
  access_token: ACCESS_TOKEN,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: 'e2e-refresh',
  user: userFor(email)
});

/** The session of someone already signed in, as the app keeps it in localStorage. */
export const STORED_SESSION = sessionFor(`ana${INVITED_DOMAIN}`);
export const STORAGE_KEY = 'aurastream-auth';

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
      if (url.pathname === '/auth/v1/otp') {
        return String(body.email).endsWith(INVITED_DOMAIN)
          ? send(200)
          : send(422, { code: 'otp_disabled', error_code: 'otp_disabled', msg: 'Signups not allowed for otp' });
      }
      if (url.pathname === '/auth/v1/verify') {
        return body.token === VALID_CODE
          ? send(200, sessionFor(String(body.email)))
          : send(403, { code: 'otp_expired', error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      }
      if (url.pathname === '/auth/v1/user') {
        return req.headers.authorization === `Bearer ${ACCESS_TOKEN}`
          ? send(200, userFor(`ana${INVITED_DOMAIN}`))
          : send(401, { code: 401, msg: 'invalid JWT' });
      }
      if (url.pathname === '/auth/v1/token') return send(200, STORED_SESSION);
      if (url.pathname === '/auth/v1/logout') return send(204);
      return send(404, { msg: 'not found' });
    });
  }).listen(port);
}
