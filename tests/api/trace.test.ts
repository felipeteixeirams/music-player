import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorizeReport, authorizeRequest, POLICIES, RateLimiter, type GuardDecision } from '../../api/_guard';
import { formatClientReport, reportEndpoint } from '../../api/_reportEndpoint';
import { currentTrace, routeOf, scrub, startTrace, traceTag } from '../../api/_trace';

const SAME_ORIGIN = { 'sec-fetch-site': 'same-origin' };
const USER_ID = '0b9f3a52-1c44-4c1e-9d0a-5a7d3b1e2f10';

test('INV-OBS-01: os ids do app viram a etiqueta de todo registro do pedido; ids de formato estranho são trocados', () => {
  const context = startTrace({ 'x-request-id': 'req-abc123', 'x-session-id': 'sess9f8e7d6c' }, '/api/search?q=creed');
  assert.deepEqual({ rid: context.rid, sid: context.sid, uid: context.uid, route: context.route }, { rid: 'req-abc123', sid: 'sess9f8e7d6c', uid: null, route: 'search' });
  assert.equal(traceTag(), 'rid=req-abc123 sid=sess9f8e7d6c route=search ');

  const forged = startTrace({ 'x-request-id': 'x y\nz', 'x-session-id': '<script>' }, '/api/resolve');
  assert.match(forged.rid, /^[0-9a-f]{10}$/);
  assert.equal(forged.sid, null);
  assert.equal(currentTrace(), forged);
  assert.equal(routeOf('/qualquer'), 'unknown');
});

test('INV-OBS-01: depois do login o registro leva o id da conta, e a resposta devolve o id do pedido', async () => {
  const policy = { limiter: new RateLimiter(10, 60_000), requireSameOrigin: true };
  // No Supabase configured and not on Vercel: login is off, so no account; the id still comes back
  const decision = await authorizeRequest({ ...SAME_ORIGIN, 'x-request-id': 'req-feed01' }, policy, { method: 'GET', url: '/api/feed' });
  assert.equal(decision.ok, true);
  assert.equal(decision.requestId, 'req-feed01');

  const refused = await authorizeRequest({ 'sec-fetch-site': 'cross-site', 'x-request-id': 'req-nope01' }, policy, { method: 'GET', url: '/api/feed' });
  assert.equal(refused.ok, false);
  assert.equal(refused.requestId, 'req-nope01', 'a recusa também diz o id do pedido');

  // What the console really writes: the tag is added by the logger installed with the guard
  const lines: string[] = [];
  const original = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    lines.push(String(chunk).trimEnd());
    return true;
  }) as typeof process.stdout.write;
  try {
    const decisionWithUser = await authorizeReport(
      { ...SAME_ORIGIN, authorization: 'Bearer abc', 'x-request-id': 'req-user01', 'x-session-id': 'sess-user-01' },
      { method: 'POST', url: '/api/report' },
      async () => ({ ok: true, user: { id: USER_ID, email: 'pessoa@example.com' } })
    );
    assert.equal(decisionWithUser.ok, true);
    console.log('[Teste] linha do pedido');
  } finally {
    process.stdout.write = original;
  }
  assert.equal(lines.length, 1);
  assert.match(lines[0], new RegExp(`^rid=req-user01 sid=sess-user-01 uid=${USER_ID} route=report \\[Teste\\]`));
  assert.ok(!lines[0].includes('pessoa@example.com'), 'o e-mail nunca entra na etiqueta');
});

test('INV-OBS-02: o relatório do app aceita só tipos conhecidos, vira uma linha e nunca leva e-mail, token ou chave', () => {
  const line = formatClientReport({
    kind: 'react',
    message: 'falha para pessoa@example.com com Bearer eyJhbGciOi.eyJzdWIiOi.abcdef e chave sb_publishable_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    stack: 'Error: x\n    at a (app.js:1:2)\n    at b (app.js:3:4)',
    version: '86104349e387',
    mode: 'pwa',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Redmi) Chrome/120',
    path: '/',
    recent: ['player do YouTube criado no toque', 'player do YouTube pronto']
  });
  assert.ok(line);
  assert.ok(!line.includes('\n'), 'uma linha só');
  assert.ok(!/pessoa@example\.com|eyJhbGci|sb_publishable_AAAA/.test(line), line);
  assert.match(line, /^\[Client\] kind=react v=86104349e387 mode=pwa /);
  assert.match(line, /recent="player do YouTube criado no toque \| player do YouTube pronto"/);

  assert.equal(formatClientReport({ kind: 'qualquer-coisa', message: 'x' }), null);
  assert.equal(formatClientReport('texto'), null);
  assert.equal(formatClientReport({ kind: 'error', message: 'x'.repeat(9000) }), null, 'relatório grande demais é recusado');
});

test('INV-OBS-02: POST /api/report responde 204 e registra; relatório inválido é 400 e não registra', () => {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => lines.push(args.join(' '));
  try {
    assert.equal(reportEndpoint({ kind: 'error', message: 'boom', version: 'v1' }).status, 204);
    assert.equal(reportEndpoint({ kind: 'nope' }).status, 400);
  } finally {
    console.error = original;
  }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /\[Client\] kind=error v=v1 .*msg="boom"/);
});

test('INV-OBS-02: o relatório não exige login mas respeita origem e limite por endereço', async () => {
  const same = await authorizeReport({ ...SAME_ORIGIN });
  assert.equal(same.ok, true, 'sem login o relatório é aceito (o erro pode estar na tela de login)');
  const foreign = await authorizeReport({ 'sec-fetch-site': 'cross-site' });
  assert.equal(foreign.ok, false);
  assert.equal(foreign.ok === false && foreign.status, 403);

  let last: GuardDecision = same;
  for (let i = 0; i < 25; i += 1) last = await authorizeReport({ ...SAME_ORIGIN, 'x-forwarded-for': '203.0.113.9' });
  assert.equal(last.ok === false && last.status, 429);
});

test('scrub põe uma linha só, corta e esconde e-mail, token e segredo', () => {
  assert.equal(scrub('a\r\nb', 20), 'a ⏎ b');
  assert.equal(scrub('palavra '.repeat(10), 10).length, 10);
  assert.equal(scrub('x'.repeat(50), 40), '[segredo]');
  assert.equal(scrub(undefined, 10), '');
  assert.equal(POLICIES.report.requireSameOrigin, true);
});
