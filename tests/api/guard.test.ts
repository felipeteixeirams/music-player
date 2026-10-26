import assert from 'node:assert/strict';
import test from 'node:test';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import audioHandler from '../../api/audio';
import { clientKey, evaluateRequest, guard, isSameOriginRequest, RateLimiter } from '../../api/_guard';
import { readPageParams, MAX_PAGE_INDEX } from '../../api/_categories';
import { searchEndpoint } from '../../api/_endpoints';

test('RateLimiter permite o limite, recusa o excesso e libera na janela seguinte', () => {
  let now = 1_000;
  const limiter = new RateLimiter(3, 60_000, 5000, () => now);
  assert.deepEqual([1, 2, 3].map(() => limiter.check('a').allowed), [true, true, true]);
  const refused = limiter.check('a');
  assert.equal(refused.allowed, false);
  assert.equal(refused.retryAfterSeconds, 60);
  assert.equal(limiter.check('b').allowed, true, 'outro endereço tem a própria conta');
  now += 60_001;
  assert.equal(limiter.check('a').allowed, true);
});

test('RateLimiter limita a memória: acima do teto descarta janelas vencidas e depois as mais antigas', () => {
  let now = 0;
  const limiter = new RateLimiter(1, 1000, 3, () => now);
  ['a', 'b', 'c'].forEach((k) => limiter.check(k));
  now = 1500;
  limiter.check('d');
  assert.equal(limiter.check('a').allowed, true, 'a janela vencida de "a" já tinha saído');
  now = 1600;
  ['e', 'f', 'g', 'h'].forEach((k) => limiter.check(k));
  assert.ok((limiter as unknown as { windows: Map<string, unknown> }).windows.size <= 3 + 1);
});

test('clientKey usa o primeiro endereço de x-forwarded-for', () => {
  assert.equal(clientKey({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }), '203.0.113.9');
  assert.equal(clientKey({ 'x-real-ip': '198.51.100.2' }), '198.51.100.2');
  assert.equal(clientKey({}), 'unknown');
});

test('isSameOriginRequest aceita só páginas do próprio site', () => {
  assert.equal(isSameOriginRequest({ 'sec-fetch-site': 'same-origin' }), true);
  assert.equal(isSameOriginRequest({ 'sec-fetch-site': 'cross-site' }), false);
  assert.equal(isSameOriginRequest({ 'sec-fetch-site': 'same-site' }), false);
  assert.equal(isSameOriginRequest({ 'sec-fetch-site': 'none' }), false);
  // sem Sec-Fetch-Site: compara Origin ou Referer com o host
  assert.equal(isSameOriginRequest({ host: 'app.example', origin: 'https://app.example' }), true);
  assert.equal(isSameOriginRequest({ host: 'app.example', referer: 'https://app.example/radio' }), true);
  assert.equal(isSameOriginRequest({ host: 'app.example', origin: 'https://evil.example' }), false);
  assert.equal(isSameOriginRequest({ host: 'app.example', origin: 'null' }), false);
  assert.equal(isSameOriginRequest({ 'x-forwarded-host': 'app.example', host: 'internal', referer: 'https://app.example/' }), true);
  assert.equal(isSameOriginRequest({ host: 'app.example' }), false, 'sem nenhum sinal não é uma página nossa');
});

test('evaluateRequest responde 403 para origem estranha e 429 acima do limite', () => {
  const policy = { limiter: new RateLimiter(2, 60_000), requireSameOrigin: true };
  const same = { 'sec-fetch-site': 'same-origin', 'x-forwarded-for': '203.0.113.9' };
  assert.deepEqual(evaluateRequest(same, policy), { ok: true });
  assert.deepEqual(evaluateRequest(same, policy), { ok: true });
  const limited = evaluateRequest(same, policy);
  assert.equal(limited.ok, false);
  assert.equal(!limited.ok && limited.status, 429);
  const foreign = evaluateRequest({ 'sec-fetch-site': 'cross-site', 'x-forwarded-for': '198.51.100.1' }, policy);
  assert.equal(!foreign.ok && foreign.status, 403);
});

function fakeResponse() {
  const res = { statusCode: 200, body: undefined as unknown, headers: {} as Record<string, string> } as {
    statusCode: number; body: unknown; headers: Record<string, string>;
    setHeader(n: string, v: string): void; status(c: number): { json(b: unknown): void };
  };
  res.setHeader = (n, v) => { res.headers[n] = v; };
  res.status = (c) => { res.statusCode = c; return { json: (b) => { res.body = b; } }; };
  return res;
}

test('guard ignora chamadas sem headers (internas) e responde 403 e Retry-After quando recusa', async () => {
  const policy = { limiter: new RateLimiter(1, 60_000), requireSameOrigin: true };
  assert.equal(await guard({}, fakeResponse(), policy), true);

  const res = fakeResponse();
  assert.equal(await guard({ headers: { host: 'app.example' } }, res, policy), false);
  assert.equal(res.statusCode, 403);

  const ok = { headers: { 'sec-fetch-site': 'same-origin', 'x-forwarded-for': '203.0.113.50' } };
  assert.equal(await guard(ok, fakeResponse(), policy), true);
  const limited = fakeResponse();
  assert.equal(await guard(ok, limited, policy), false);
  assert.equal(limited.statusCode, 429);
  assert.ok(Number(limited.headers['Retry-After']) >= 1);
});

test('a rota de áudio recusa requisição de outro site antes de buscar qualquer coisa', async () => {
  const res = fakeResponse();
  await audioHandler(
    { query: { url: 'https://cdn-preview.dzcdn.net/x.mp3' }, headers: { 'sec-fetch-site': 'cross-site' } } as unknown as VercelRequest,
    res as unknown as VercelResponse
  );
  assert.equal(res.statusCode, 403);
});

test('a busca recusa texto longo demais e o index é limitado', async () => {
  const result = await searchEndpoint({ q: 'a'.repeat(201) });
  assert.equal(result.status, 400);
  assert.equal(readPageParams({ index: '999999' }).index, MAX_PAGE_INDEX);
  assert.equal(readPageParams({ index: '40' }).index, 40);
});
