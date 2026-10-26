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
  expect((await request.get('/api/feed', { headers: sameSite })).status()).toBe(401);
  expect((await request.get('/api/resolve?artist=a&title=b&duration=100', { headers: sameSite })).status()).toBe(401);
  expect((await request.get('/api/feed', { headers: { ...sameSite, Authorization: 'Bearer token-invalido' } })).status()).toBe(401);
});

test('a rota de saúde informa que o login está ligado', async ({ request }) => {
  expect((await (await request.get('/api/health')).json()).login).toBe(true);
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
