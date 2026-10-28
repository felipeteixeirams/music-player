import { expect, test } from '@playwright/test';
import { ACCESS_TOKEN } from './supabaseMock';

// No stubs here: these requests reach the real Express routes, so they only check what needs no third party.

test('a rota de saúde responde sem proteção', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect((await response.json()).status).toBe('ok');
});

test('rotas de dados recusam quem não vem de uma página do site', async ({ request }) => {
  expect((await request.get('/api/feed')).status()).toBe(403);
  expect((await request.get('/api/search?q=a', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status()).toBe(403);
});

test('de uma página do site mas sem login, as rotas de dados respondem 401', async ({ request }) => {
  const sameSite = { 'Sec-Fetch-Site': 'same-origin' };
  const noToken = await request.get('/api/feed', { headers: sameSite });
  expect(noToken.status()).toBe(401);
  // The answer says which kind of 401 it is, so the app (and a person reading the log) can tell
  expect((await noToken.json()).code).toBe('no_token');
  expect((await request.get('/api/resolve?artist=a&title=b&duration=100', { headers: sameSite })).status()).toBe(401);
  const bad = await request.get('/api/feed', { headers: { ...sameSite, Authorization: 'Bearer token-invalido' } });
  expect(bad.status()).toBe(401);
  expect((await bad.json()).code).toBe('invalid_session');
});

test('INV-OBS-02: o relatório de erro não exige login, devolve o id do pedido e recusa o que não é de uma página do site', async ({ request }) => {
  const sameSite = { 'Sec-Fetch-Site': 'same-origin', 'X-Request-Id': 'req-e2e-0001', 'X-Session-Id': 'sess-e2e-0001' };
  const ok = await request.post('/api/report', { headers: sameSite, data: { kind: 'error', message: 'falha no login', version: 'e2e', mode: 'browser' } });
  expect(ok.status()).toBe(204);
  expect(ok.headers()['x-request-id']).toBe('req-e2e-0001');
  expect((await request.post('/api/report', { headers: sameSite, data: { kind: 'nada' } })).status()).toBe(400);
  expect((await request.post('/api/report', { data: { kind: 'error', message: 'x' } })).status()).toBe(403);
  // The data routes still ask for the login, and say the request id in the refusal
  const refused = await request.get('/api/feed', { headers: sameSite });
  expect(refused.status()).toBe(401);
  expect(refused.headers()['x-request-id']).toBe('req-e2e-0001');
});

test('a rota de saúde informa que o login está ligado', async ({ request }) => {
  const health = await (await request.get('/api/health')).json();
  expect(health.login).toBe(true);
  expect(health.cache).toBe(false);
  // The check result is public, so it must carry ids and levels only: no variable names, no values
  expect(typeof health.config.ok).toBe('boolean');
  expect(JSON.stringify(health)).not.toMatch(/DATABASE_|e2e-anon-key|localhost:3115/);
});

test('/api/health?deep=1 também consulta os serviços e responde mesmo que eles não saibam responder', async ({ request }) => {
  const health = await (await request.get('/api/health?deep=1')).json();
  expect(health.services).toBeDefined();
  expect(Array.isArray(health.services.problems)).toBe(true);
});

test('logado e vindo de uma página do site, parâmetros inválidos dão 400 sem chamar terceiros', async ({ request }) => {
  const sameSite = { 'Sec-Fetch-Site': 'same-origin', Authorization: `Bearer ${ACCESS_TOKEN}` };
  expect((await request.get('/api/category?id=desconhecida', { headers: sameSite })).status()).toBe(400);
  expect((await request.get(`/api/search?q=${'a'.repeat(201)}`, { headers: sameSite })).status()).toBe(400);
  expect((await request.get('/api/resolve?artist=a&title=b&duration=99999', { headers: sameSite })).status()).toBe(400);
});

test('version.json existe, para o aviso de nova versão funcionar', async ({ request }) => {
  const response = await request.get('/version.json');
  expect(response.status()).toBe(200);
  expect(typeof (await response.json()).version).toBe('string');
});
