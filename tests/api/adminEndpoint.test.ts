import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminEndpoint, isAdminUser, type AdminDeps } from '../../api/_adminEndpoint';
import type { Admin } from '../../api/_supabaseAdmin';

const ME = { id: 'u-me', email: 'Felipe@Example.com' };
const OTHER = { id: 'u-other', email: 'ana@example.com' };
const ENV = { ADMIN_EMAILS: ' felipe@example.com , outra@example.com ' };

function deps(overrides: Partial<AdminDeps> = {}): AdminDeps {
  const admin = {
    usageByDay: async () => ({ 'u-me': 3, 'u-other': 9 }),
    cacheCount: async () => 120,
    listUsers: async () => ({ 'u-me': 'felipe@example.com', 'u-other': 'ana@example.com', 'u-idle': 'idle@example.com' })
  } as unknown as Admin;
  return {
    admin,
    breaker: { check: async () => null, trip: async () => ({ until: 0, reason: 'quota' as const }) },
    findings: async () => [{ id: 'login-key', level: 'ok' as const, message: 'ok' }],
    dailyLimit: 30,
    now: () => Date.parse('2026-10-29T15:00:00Z'),
    env: ENV,
    ...overrides
  };
}

test('INV-ADMIN-01: administrador é quem tem o e-mail em ADMIN_EMAILS (sem diferenciar maiúsculas); sem lista ou sem e-mail ninguém é', () => {
  assert.equal(isAdminUser(ME, ENV), true);
  assert.equal(isAdminUser(OTHER, ENV), false);
  assert.equal(isAdminUser({ id: 'x', email: null }, ENV), false);
  assert.equal(isAdminUser(null, ENV), false);
  assert.equal(isAdminUser(ME, {}), false);
  assert.equal(isAdminUser(ME, { ADMIN_EMAILS: '' }), false);
});

test('INV-ADMIN-01: ?me=1 responde a qualquer um, mas os dados do painel só ao administrador (403 sem corpo útil)', async () => {
  assert.deepEqual((await adminEndpoint({ me: '1' }, ME, deps())).body, { admin: true });
  assert.deepEqual((await adminEndpoint({ me: '1' }, OTHER, deps())).body, { admin: false });
  const denied = await adminEndpoint({}, OTHER, deps());
  assert.equal(denied.status, 403);
  assert.doesNotMatch(JSON.stringify(denied.body), /ana@|felipe@|120/);
  assert.equal((await adminEndpoint({}, null, deps())).status, 403);
});

test('INV-ADMIN-02: o painel traz o disjuntor do YouTube, o uso por pessoa (maior primeiro), o cache e a configuração', async () => {
  const { status, body } = await adminEndpoint({}, ME, deps());
  assert.equal(status, 200);
  const data = body as {
    youtube: { search: string; searchesToday: number; unitsUpperBound: number };
    people: { counted: number; accounts: number; perPerson: { email: string; used: number }[] };
    cache: { tracks: number };
    config: { id: string }[];
    limits: { dailyNewTracks: number };
    day: string;
  };
  assert.equal(data.day, '2026-10-29');
  assert.equal(data.youtube.search, 'normal');
  assert.equal(data.youtube.searchesToday, 12);
  assert.equal(data.youtube.unitsUpperBound, 1200);
  assert.deepEqual(data.people.perPerson, [{ email: 'ana@example.com', used: 9 }, { email: 'felipe@example.com', used: 3 }]);
  assert.equal(data.people.accounts, 3);
  assert.equal(data.cache.tracks, 120);
  assert.equal(data.limits.dailyNewTracks, 30);
  assert.deepEqual(data.config.map((item) => item.id), ['login-key']);
});

test('INV-ADMIN-02: com o disjuntor aberto o painel diz "suspended" com o motivo; sem banco ou com o banco falhando ainda responde', async () => {
  const open = await adminEndpoint({}, ME, deps({ breaker: { check: async () => ({ until: 5, reason: 'quota' as const }), trip: async () => ({ until: 5, reason: 'quota' as const }) } }));
  assert.deepEqual((open.body as { youtube: { search: string; reason: string } }).youtube.search, 'suspended');
  const noDb = await adminEndpoint({}, ME, deps({ admin: null }));
  assert.equal(noDb.status, 200);
  assert.equal((noDb.body as { database: string }).database, 'off');
  const broken = { usageByDay: async () => { throw new Error('db'); }, cacheCount: async () => { throw new Error('db'); }, listUsers: async () => { throw new Error('db'); } } as unknown as Admin;
  const failing = await adminEndpoint({}, ME, deps({ admin: broken }));
  assert.equal(failing.status, 200);
  assert.equal((failing.body as { cache: { tracks: null } }).cache.tracks, null);
});
