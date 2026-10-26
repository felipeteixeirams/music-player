import assert from 'node:assert/strict';
import test from 'node:test';
import { authConfigFromEnv, createAuthenticator } from '../../api/_auth';
import { authorizeRequest, RateLimiter } from '../../api/_guard';
import { readSupabaseConfig } from '../../src/utils/supabaseConfig';

const CONFIG = { url: 'https://proj.supabase.co', apiKey: 'anon' };
const withToken = (token: string) => ({ authorization: `Bearer ${token}` });

function fakeSupabase(handler: (token: string) => { status: number; body?: unknown } | 'network-error') {
  const calls: string[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    const token = headers.Authorization.replace('Bearer ', '');
    calls.push(token);
    assert.equal(url, 'https://proj.supabase.co/auth/v1/user');
    assert.equal(headers.apikey, 'anon');
    const result = handler(token);
    if (result === 'network-error') throw new Error('offline');
    return new Response(JSON.stringify(result.body ?? {}), { status: result.status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

test('authConfigFromEnv aceita os nomes com o prefixo da integração da Vercel e os sem prefixo', () => {
  assert.deepEqual(
    authConfigFromEnv({ DATABASE_SUPABASE_URL: 'https://a.supabase.co/', DATABASE_VITE_SUPABASE_ANON_KEY: 'k1' }),
    { url: 'https://a.supabase.co', apiKey: 'k1' }
  );
  assert.deepEqual(
    authConfigFromEnv({ SUPABASE_URL: 'https://b.supabase.co', SUPABASE_ANON_KEY: 'k2' }),
    { url: 'https://b.supabase.co', apiKey: 'k2' }
  );
  assert.deepEqual(
    authConfigFromEnv({ DATABASE_VITE_SUPABASE_URL: 'https://c.supabase.co', DATABASE_VITE_SUPABASE_PUBLISHABLE_KEY: 'k3' }),
    { url: 'https://c.supabase.co', apiKey: 'k3' }
  );
  assert.equal(authConfigFromEnv({ DATABASE_SUPABASE_URL: 'https://a.supabase.co' }), null, 'sem chave pública não há login');
  assert.equal(authConfigFromEnv({}), null);
});

test('readSupabaseConfig do cliente aceita VITE_ e DATABASE_VITE_', () => {
  assert.deepEqual(readSupabaseConfig({ DATABASE_VITE_SUPABASE_URL: 'https://a.supabase.co/', DATABASE_VITE_SUPABASE_ANON_KEY: 'k' }), {
    url: 'https://a.supabase.co',
    key: 'k'
  });
  assert.deepEqual(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://b.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'p' }), {
    url: 'https://b.supabase.co',
    key: 'p'
  });
  assert.equal(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://b.supabase.co' }), null);
});

test('sem configuração o login fica desligado, a não ser em host gerenciado, onde recusa tudo', async () => {
  const open = createAuthenticator({ config: null, failClosed: false });
  assert.deepEqual(await open({}), { ok: true, user: null });
  const closed = createAuthenticator({ config: null, failClosed: true });
  const refused = await closed({});
  assert.equal(!refused.ok && refused.status, 503);
});

test('sem token ou com cabeçalho malformado responde 401 sem consultar o Supabase', async () => {
  const { fetchImpl, calls } = fakeSupabase(() => ({ status: 200 }));
  const authenticate = createAuthenticator({ config: CONFIG, fetchImpl });
  for (const headers of [{}, { authorization: 'Basic abc' }, { authorization: 'Bearer ' }, { authorization: 'Bearer a b' }]) {
    const result = await authenticate(headers);
    assert.equal(!result.ok && result.status, 401);
  }
  assert.equal(calls.length, 0);
});

test('token válido devolve o usuário e a confirmação é lembrada por um minuto', async () => {
  let now = 0;
  const { fetchImpl, calls } = fakeSupabase(() => ({ status: 200, body: { id: 'u1', email: 'ana@x.com' } }));
  const authenticate = createAuthenticator({ config: CONFIG, fetchImpl, now: () => now });
  assert.deepEqual(await authenticate(withToken('t1')), { ok: true, user: { id: 'u1', email: 'ana@x.com' } });
  assert.deepEqual(await authenticate(withToken('t1')), { ok: true, user: { id: 'u1', email: 'ana@x.com' } });
  assert.equal(calls.length, 1);
  now += 60_001;
  await authenticate(withToken('t1'));
  assert.equal(calls.length, 2);
});

test('token recusado dá 401 (e não é lembrado); falha do Supabase dá 503', async () => {
  let status = 401;
  const { fetchImpl, calls } = fakeSupabase(() => ({ status, body: { id: 'u1' } }));
  const authenticate = createAuthenticator({ config: CONFIG, fetchImpl });
  assert.equal((await authenticate(withToken('t'))).ok, false);
  assert.equal((await authenticate(withToken('t'))).ok, false);
  assert.equal(calls.length, 2, 'uma recusa não fica em cache');

  status = 500;
  const down = await authenticate(withToken('t'));
  assert.equal(!down.ok && down.status, 503);

  const offline = createAuthenticator({ config: CONFIG, fetchImpl: fakeSupabase(() => 'network-error').fetchImpl });
  const result = await offline(withToken('t'));
  assert.equal(!result.ok && result.status, 503);
});

test('authorizeRequest checa origem e limite antes de consultar o login', async () => {
  const policy = { limiter: new RateLimiter(5, 60_000), requireSameOrigin: true };
  // Sem Sec-Fetch-Site nem Origin: 403 sem chegar ao login
  const foreign = await authorizeRequest({ 'x-forwarded-for': '203.0.113.7' }, policy);
  assert.equal(!foreign.ok && foreign.status, 403);
});
