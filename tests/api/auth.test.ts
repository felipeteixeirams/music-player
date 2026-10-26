import assert from 'node:assert/strict';
import test from 'node:test';
import { authConfigFromEnv, createAuthenticator, describeAuthConfig } from '../../api/_auth';
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
  const open = createAuthenticator({ config: null, failClosed: false, log: () => undefined });
  assert.deepEqual(await open({}), { ok: true, user: null });
  const closed = createAuthenticator({ config: null, failClosed: true, log: () => undefined });
  const refused = await closed({});
  assert.equal(!refused.ok && refused.status, 503);
});

test('sem token ou com cabeçalho malformado responde 401 sem consultar o Supabase', async () => {
  const { fetchImpl, calls } = fakeSupabase(() => ({ status: 200 }));
  const authenticate = createAuthenticator({ config: CONFIG, fetchImpl, log: () => undefined });
  for (const headers of [{}, { authorization: 'Basic abc' }, { authorization: 'Bearer ' }, { authorization: 'Bearer a b' }]) {
    const result = await authenticate(headers);
    assert.equal(!result.ok && result.status, 401);
  }
  assert.equal(calls.length, 0);
});

test('token válido devolve o usuário e a confirmação é lembrada por um minuto', async () => {
  let now = 0;
  const { fetchImpl, calls } = fakeSupabase(() => ({ status: 200, body: { id: 'u1', email: 'ana@x.com' } }));
  const authenticate = createAuthenticator({ config: CONFIG, fetchImpl, now: () => now, log: () => undefined });
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
  const authenticate = createAuthenticator({ config: CONFIG, fetchImpl, log: () => undefined });
  assert.equal((await authenticate(withToken('t'))).ok, false);
  assert.equal((await authenticate(withToken('t'))).ok, false);
  assert.equal(calls.length, 2, 'uma recusa não fica em cache');

  status = 500;
  const down = await authenticate(withToken('t'));
  assert.equal(!down.ok && down.status, 503);

  const offline = createAuthenticator({ config: CONFIG, fetchImpl: fakeSupabase(() => 'network-error').fetchImpl, log: () => undefined });
  const result = await offline(withToken('t'));
  assert.equal(!result.ok && result.status, 503);
});

test('authorizeRequest checa origem e limite antes de consultar o login', async () => {
  const policy = { limiter: new RateLimiter(5, 60_000), requireSameOrigin: true };
  // Sem Sec-Fetch-Site nem Origin: 403 sem chegar ao login
  const foreign = await authorizeRequest({ 'x-forwarded-for': '203.0.113.7' }, policy);
  assert.equal(!foreign.ok && foreign.status, 403);
});

test('cada recusa tem um código e um motivo: sem token, sessão inválida, chave do servidor recusada, Supabase fora', async () => {
  const quiet = (handler: Parameters<typeof fakeSupabase>[0]) =>
    createAuthenticator({ config: CONFIG, fetchImpl: fakeSupabase(handler).fetchImpl, log: () => undefined });

  const none = await quiet(() => ({ status: 200 }))({});
  assert.deepEqual(!none.ok && [none.status, none.code], [401, 'no_token']);

  const expired = await quiet(() => ({ status: 403, body: { error_code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' } }))(withToken('t'));
  assert.deepEqual(!expired.ok && [expired.status, expired.code], [401, 'invalid_session']);
  assert.match(!expired.ok ? expired.detail ?? '' : '', /session_not_found/);

  // Erro do servidor, não do usuário: não pode virar 401, senão o app desloga todo mundo
  const badKey = await quiet(() => ({ status: 401, body: { message: 'Invalid API key', hint: 'Double check your Supabase `anon` or `service_role` API key.' } }))(withToken('t'));
  assert.deepEqual(!badKey.ok && [badKey.status, badKey.code], [503, 'server_key_rejected']);

  const down = await quiet(() => ({ status: 500, body: { msg: 'boom' } }))(withToken('t'));
  assert.deepEqual(!down.ok && [down.status, down.code], [503, 'auth_unavailable']);

  const offline = await quiet(() => 'network-error')(withToken('t'));
  assert.deepEqual(!offline.ok && [offline.status, offline.code], [503, 'auth_unavailable']);
});

test('sem configuração num host gerenciado a recusa diz o que falta', async () => {
  const authenticate = createAuthenticator({ config: null, failClosed: true, log: () => undefined });
  const result = await authenticate({});
  assert.equal(!result.ok && result.code, 'login_not_configured');
  assert.match(!result.ok ? result.detail ?? '' : '', /falta/);
});

test('describeAuthConfig diz quais variáveis estão em uso, sem mostrar valores', () => {
  const text = describeAuthConfig({
    DATABASE_SUPABASE_URL: 'https://abc123.supabase.co',
    DATABASE_VITE_SUPABASE_ANON_KEY: 'chave-secreta-xyz'
  });
  assert.match(text, /abc123\.supabase\.co/);
  assert.match(text, /DATABASE_VITE_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(text, /chave-secreta-xyz/);
  assert.match(describeAuthConfig({ SUPABASE_URL: 'https://x.supabase.co' }), /NÃO configurado \(falta: chave pública\)/);
  assert.match(describeAuthConfig({}), /falta: URL do projeto e chave pública/);
});

test('a configuração é descrita no log uma vez por instância', async () => {
  const lines: string[] = [];
  const { fetchImpl } = fakeSupabase(() => ({ status: 200, body: { id: 'u1' } }));
  const authenticate = createAuthenticator({ config: CONFIG, fetchImpl, log: (line) => lines.push(line) });
  await authenticate(withToken('a'));
  await authenticate(withToken('b'));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[Auth\]/);
});

test('authorizeRequest registra o motivo da recusa com o caminho, sem token nem chave', async () => {
  const originalWarn = console.warn;
  const lines: string[] = [];
  console.warn = (line: string) => void lines.push(String(line));
  try {
    const policy = { limiter: new RateLimiter(50, 60_000), requireSameOrigin: true };
    process.env.DATABASE_SUPABASE_URL = 'https://p.supabase.co';
    process.env.DATABASE_VITE_SUPABASE_ANON_KEY = 'anon';
    const headers = { 'sec-fetch-site': 'same-origin', 'x-forwarded-for': '203.0.113.77' };
    const decision = await authorizeRequest(headers, policy, { method: 'GET', url: '/api/feed?x=segredo' });
    assert.equal(!decision.ok && decision.code, 'no_token');
    assert.equal(lines.length, 1);
    assert.match(lines[0], /\[Auth\] 401 no_token GET \/api\/feed$/);
  } finally {
    console.warn = originalWarn;
    delete process.env.DATABASE_SUPABASE_URL;
    delete process.env.DATABASE_VITE_SUPABASE_ANON_KEY;
  }
});
