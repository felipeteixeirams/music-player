import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cacheKeyFor,
  FOUND_TTL_MS,
  MISS_TTL_MS,
  reportBadVideoEndpoint,
  resolveEndpoint,
  resolveRoute,
  usageEndpoint,
  type ResolveDeps
} from '../../api/_resolveEndpoint';
import { adminConfigFromEnv, createAdmin, saoPauloDay, type Admin, type CachedVideos } from '../../api/_supabaseAdmin';
import type { ResolvedVideos } from '../../api/_youtubeSearch';

const USER = { id: 'user-1', email: 'ana@x.com' };
const QUERY = { id: 'deezer-7', artist: 'Artista', title: 'Faixa', duration: '200' };
const VIDEO = 'AAAAAAAAAAA';

function fakeAdmin(limitFails = false) {
  const cache = new Map<string, CachedVideos>();
  const used = new Map<string, number>();
  const calls: string[] = [];
  const admin: Admin = {
    async getCached(key) {
      calls.push(`get ${key}`);
      return cache.get(key) ?? null;
    },
    async putCached(key, videoIds, now) {
      calls.push(`put ${key}`);
      cache.set(key, { videoIds, resolvedAt: now });
    },
    async deleteCached(key) {
      calls.push(`delete ${key}`);
      cache.delete(key);
    },
    async consume(userId, limit) {
      const next = (used.get(userId) ?? 0) + 1;
      if (next > limit) return -1;
      used.set(userId, next);
      return next;
    },
    async refund(userId) {
      used.set(userId, Math.max(0, (used.get(userId) ?? 0) - 1));
    },
    async usedToday(userId) {
      return used.get(userId) ?? 0;
    }
  };
  if (limitFails) admin.consume = async () => { throw new Error('db down'); };
  return { admin, cache, used, calls };
}

function setup(options: { via?: ResolvedVideos['via']; videoIds?: string[]; searchFails?: boolean; limit?: number; noAdmin?: boolean } = {}) {
  const fake = fakeAdmin();
  let searches = 0;
  let now = 1_000_000;
  const deps: ResolveDeps = {
    admin: options.noAdmin ? null : fake.admin,
    search: async () => {
      searches++;
      if (options.searchFails) throw new Error('youtube down');
      return { videoIds: options.videoIds ?? [VIDEO], via: options.via ?? 'official', picks: [], considered: 1 };
    },
    dailyLimit: options.limit ?? 30,
    now: () => now,
    log: () => undefined
  };
  return { ...fake, deps, searches: () => searches, advance: (ms: number) => (now += ms) };
}

test('cacheKeyFor usa o id do catálogo e, sem ele, um hash estável da faixa', () => {
  const track = { artist: 'Artista', title: 'Faixa', duration: 200 };
  assert.equal(cacheKeyFor(track, 'deezer-7'), 'deezer-7');
  const hashed = cacheKeyFor(track, undefined);
  assert.match(hashed, /^h-[0-9a-f]{24}$/);
  assert.equal(hashed, cacheKeyFor({ artist: 'ARTISTA', title: 'faixa', duration: 201 }, 'lixo'));
  assert.notEqual(hashed, cacheKeyFor({ ...track, title: 'Outra' }, undefined));
});

test('faixa nova: busca, grava no cache para todos e conta na cota do usuário', async () => {
  const t = setup();
  const result = await resolveEndpoint(QUERY, USER, t.deps);
  assert.deepEqual(result.body, { videoIds: [VIDEO], quota: { used: 1, limit: 30, exceeded: false } });
  assert.equal(result.cacheControl, 'private, no-store');
  assert.deepEqual(t.cache.get('deezer-7')?.videoIds, [VIDEO]);
  assert.equal(t.searches(), 1);
});

test('faixa já resolvida por outra pessoa vem do cache: sem busca e sem gastar cota', async () => {
  const t = setup();
  await resolveEndpoint(QUERY, USER, t.deps);
  const other = await resolveEndpoint(QUERY, { id: 'user-2', email: null }, t.deps);
  assert.deepEqual(other.body, { videoIds: [VIDEO] });
  assert.equal(t.searches(), 1);
  assert.equal(t.used.get('user-2'), undefined);
});

test('passado o prazo o cache vence: acha de novo (vídeo por 180 dias, "não achei" por 1 dia)', async () => {
  const found = setup();
  await resolveEndpoint(QUERY, USER, found.deps);
  found.advance(FOUND_TTL_MS - 1);
  await resolveEndpoint(QUERY, USER, found.deps);
  assert.equal(found.searches(), 1);
  found.advance(2);
  await resolveEndpoint(QUERY, USER, found.deps);
  assert.equal(found.searches(), 2);

  const miss = setup({ videoIds: [] });
  await resolveEndpoint(QUERY, USER, miss.deps);
  assert.deepEqual(miss.cache.get('deezer-7')?.videoIds, []);
  miss.advance(MISS_TTL_MS - 1);
  await resolveEndpoint(QUERY, USER, miss.deps);
  assert.equal(miss.searches(), 1);
  miss.advance(2);
  await resolveEndpoint(QUERY, USER, miss.deps);
  assert.equal(miss.searches(), 2);
});

test('"não achei" da busca web não vai para o cache (ela falha em silêncio)', async () => {
  const t = setup({ videoIds: [], via: 'web' });
  await resolveEndpoint(QUERY, USER, t.deps);
  assert.equal(t.cache.size, 0);
});

test('acima do limite diário não busca nem grava: avisa que a cota acabou; o cache continua valendo', async () => {
  const t = setup({ limit: 2 });
  await resolveEndpoint({ ...QUERY, id: 'deezer-1' }, USER, t.deps);
  await resolveEndpoint({ ...QUERY, id: 'deezer-2' }, USER, t.deps);
  const third = await resolveEndpoint({ ...QUERY, id: 'deezer-3' }, USER, t.deps);
  assert.deepEqual(third.body, { videoIds: [], quota: { used: 2, limit: 2, exceeded: true } });
  assert.equal(t.searches(), 2);
  assert.equal(t.cache.has('deezer-3'), false);
  const cached = await resolveEndpoint({ ...QUERY, id: 'deezer-1' }, USER, t.deps);
  assert.deepEqual(cached.body, { videoIds: [VIDEO] });
});

test('a cota é de cada pessoa', async () => {
  const t = setup({ limit: 1 });
  await resolveEndpoint({ ...QUERY, id: 'deezer-1' }, USER, t.deps);
  const other = await resolveEndpoint({ ...QUERY, id: 'deezer-2' }, { id: 'user-2', email: null }, t.deps);
  assert.equal((other.body as { quota: { exceeded: boolean } }).quota.exceeded, false);
});

test('busca que falha devolve a unidade da cota e não grava nada', async () => {
  const t = setup({ searchFails: true });
  const result = await resolveEndpoint(QUERY, USER, t.deps);
  assert.equal((result.body as { videoIds: string[] }).videoIds.length, 0);
  assert.equal(t.used.get('user-1'), 0);
  assert.equal(t.cache.size, 0);
  assert.equal(result.cacheControl, undefined, 'falha não se cacheia');
});

test('sem banco configurado, ou com o banco fora do ar, tudo funciona como antes: busca sem cache nem limite', async () => {
  const none = setup({ noAdmin: true });
  assert.deepEqual((await resolveEndpoint(QUERY, USER, none.deps)).body, { videoIds: [VIDEO] });

  const down = setup();
  down.deps.admin = { ...down.admin, consume: async () => { throw new Error('db down'); }, getCached: async () => { throw new Error('db down'); } };
  assert.deepEqual((await resolveEndpoint(QUERY, USER, down.deps)).body, { videoIds: [VIDEO] });
});

test('parâmetros inválidos dão 400', async () => {
  const t = setup();
  for (const bad of [{}, { ...QUERY, artist: '' }, { ...QUERY, duration: '99999' }, { ...QUERY, title: 'x'.repeat(201) }]) {
    assert.equal((await resolveEndpoint(bad, USER, t.deps)).status, 400);
  }
  assert.equal(t.searches(), 0);
});

test('denúncia de vídeo quebrado tira só aquele id; o último some com a linha', async () => {
  const t = setup();
  await t.admin.putCached('deezer-7', [VIDEO, 'BBBBBBBBBBB'], 5);
  await reportBadVideoEndpoint({ id: 'deezer-7', videoId: VIDEO }, t.deps);
  assert.deepEqual(t.cache.get('deezer-7')?.videoIds, ['BBBBBBBBBBB']);
  assert.equal(t.cache.get('deezer-7')?.resolvedAt, 5, 'a data da busca não é renovada');
  await reportBadVideoEndpoint({ id: 'deezer-7', videoId: 'BBBBBBBBBBB' }, t.deps);
  assert.equal(t.cache.has('deezer-7'), false);

  await reportBadVideoEndpoint({ id: 'deezer-7', videoId: 'CCCCCCCCCCC' }, t.deps);
  assert.equal((await reportBadVideoEndpoint({ id: 'x', videoId: VIDEO }, t.deps)).status, 400);
  assert.equal((await reportBadVideoEndpoint({ id: 'deezer-7', videoId: 'curto' }, t.deps)).status, 400);
});

test('usage devolve o consumo do dia, e "desligado" sem banco ou sem usuário', async () => {
  const t = setup();
  await resolveEndpoint(QUERY, USER, t.deps);
  assert.deepEqual((await usageEndpoint(USER, t.deps)).body, { enabled: true, used: 1, limit: 30 });
  assert.deepEqual((await usageEndpoint(null, t.deps)).body, { enabled: false });
  assert.deepEqual((await usageEndpoint(USER, setup({ noAdmin: true }).deps)).body, { enabled: false });
});

test('resolveRoute escolhe pelo método e pelo parâmetro usage', async () => {
  const t = setup();
  assert.equal((await resolveRoute({ method: 'POST', query: {}, body: { id: 'x' } }, USER, t.deps)).status, 400);
  assert.deepEqual((await resolveRoute({ method: 'GET', query: { usage: '1' } }, USER, t.deps)).body, { enabled: true, used: 0, limit: 30 });
  assert.equal((await resolveRoute({ method: 'GET', query: QUERY }, USER, t.deps)).status, 200);
});

// ------------------------------------------------------------------ acesso ao banco

test('adminConfigFromEnv aceita os nomes da integração da Vercel e os sem prefixo', () => {
  assert.deepEqual(
    adminConfigFromEnv({ DATABASE_SUPABASE_URL: 'https://a.supabase.co/', DATABASE_SUPABASE_SERVICE_ROLE_KEY: 'k' }),
    { url: 'https://a.supabase.co', serviceKey: 'k' }
  );
  assert.deepEqual(adminConfigFromEnv({ SUPABASE_URL: 'https://b.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k2' }), {
    url: 'https://b.supabase.co',
    serviceKey: 'k2'
  });
  assert.equal(adminConfigFromEnv({ DATABASE_SUPABASE_URL: 'https://a.supabase.co' }), null);
});

test('saoPauloDay usa o dia de São Paulo, não o UTC', () => {
  assert.equal(saoPauloDay(Date.parse('2026-10-26T02:30:00Z')), '2026-10-25');
  assert.equal(saoPauloDay(Date.parse('2026-10-26T03:30:00Z')), '2026-10-26');
});

test('createAdmin fala com as tabelas e funções certas com a chave de serviço', async () => {
  const calls: { url: string; method?: string; body?: string; headers: Record<string, string> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method, body: init.body as string, headers: init.headers as Record<string, string> });
    if (url.includes('/video_cache?select')) return new Response(JSON.stringify([{ video_ids: [VIDEO], resolved_at: '2026-01-01T00:00:00Z' }]));
    if (url.includes('/rpc/consume_resolve')) return new Response('3');
    if (url.includes('/usage_daily')) return new Response(JSON.stringify([{ resolves: 4 }]));
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
  const admin = createAdmin({ url: 'https://p.supabase.co', serviceKey: 'service' }, fetchImpl);

  assert.deepEqual(await admin.getCached('deezer-7'), { videoIds: [VIDEO], resolvedAt: Date.parse('2026-01-01T00:00:00Z') });
  assert.equal(await admin.consume('u1', 30), 3);
  assert.equal(await admin.usedToday('u1', Date.parse('2026-10-26T12:00:00Z')), 4);
  await admin.putCached('deezer-7', [VIDEO], 0);
  await admin.refund('u1');
  await admin.deleteCached('deezer-7');

  assert.ok(calls.every((c) => c.headers.apikey === 'service' && c.headers.Authorization === 'Bearer service'));
  assert.ok(calls[0].url.includes('track_id=eq.deezer-7') || calls[0].url.includes('track_id=eq%2Edeezer-7') || decodeURIComponent(calls[0].url).includes('track_id=eq.deezer-7'));
  assert.deepEqual(JSON.parse(calls[1].body!), { p_user: 'u1', p_limit: 30 });
  assert.ok(decodeURIComponent(calls[2].url).includes('day=eq.2026-10-26'));
  assert.equal(calls[5].method, 'DELETE');
});
