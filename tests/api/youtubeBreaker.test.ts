import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BREAKER_KEY, breakerUntil, classifyYouTubeError, createYoutubeBreaker, newBreakerMemory, nextQuotaReset, YouTubeApiError, type BreakerState, type BreakerStore } from '../../api/_youtubeBreaker';
import { resolveYouTubeVideos } from '../../api/_youtubeSearch';

const HOUR = 3_600_000;

function memoryStore(initial: BreakerState | null = null, options: { failGet?: boolean; failSet?: boolean } = {}) {
  let value = initial;
  const reads: string[] = [];
  const store: BreakerStore = {
    get: async (key) => {
      reads.push(key);
      if (options.failGet) throw new Error('db down');
      return value;
    },
    set: async (_key, state) => {
      if (options.failSet) throw new Error('db down');
      value = state;
    }
  };
  return { store, reads, value: () => value };
}

test('INV-PLAY-15: cada erro do YouTube vira uma causa: cota do dia, ritmo, chave; o resto não abre o disjuntor', () => {
  assert.equal(classifyYouTubeError(new YouTubeApiError(403, 'quotaExceeded')), 'quota');
  assert.equal(classifyYouTubeError(new YouTubeApiError(403, 'dailyLimitExceeded')), 'quota');
  assert.equal(classifyYouTubeError(new YouTubeApiError(403, 'rateLimitExceeded')), 'rate');
  assert.equal(classifyYouTubeError(new YouTubeApiError(429, '')), 'rate');
  assert.equal(classifyYouTubeError(new YouTubeApiError(400, 'keyInvalid')), 'key');
  assert.equal(classifyYouTubeError(new YouTubeApiError(403, 'accessNotConfigured')), 'key');
  assert.equal(classifyYouTubeError(new YouTubeApiError(500, 'backendError')), null);
  assert.equal(classifyYouTubeError(new Error('timeout')), null);
});

test('a cota do YouTube zera à meia-noite do Pacífico: o disjuntor de cota dura até lá, os outros só um tempo curto', () => {
  // 2026-10-28 20:00 UTC = 13:00 PDT: the next midnight in Pacific time is 07:00 UTC the next day
  const now = Date.UTC(2026, 9, 28, 20, 0, 0);
  assert.equal(nextQuotaReset(now), Date.UTC(2026, 9, 29, 7, 0, 0));
  // In winter (PST, UTC-8) it is 08:00 UTC
  assert.equal(nextQuotaReset(Date.UTC(2026, 11, 1, 20, 0, 0)), Date.UTC(2026, 11, 2, 8, 0, 0));
  assert.equal(breakerUntil('quota', now), nextQuotaReset(now));
  assert.equal(breakerUntil('rate', now), now + 60_000);
  assert.equal(breakerUntil('key', now), now + 10 * 60_000);
});

test('INV-PLAY-15: o disjuntor abre na primeira recusa, é lembrado na instância e no estado compartilhado, e fecha sozinho no prazo', async () => {
  let now = Date.UTC(2026, 9, 28, 20, 0, 0);
  const shared = memoryStore();
  const lines: string[] = [];
  const breaker = createYoutubeBreaker({ memory: newBreakerMemory(), store: shared.store, now: () => now, log: (line) => lines.push(line) });

  assert.equal(await breaker.check(), null, 'fechado no início');
  const state = await breaker.trip('quota');
  assert.equal(state.until, nextQuotaReset(now));
  assert.equal((await breaker.check())?.reason, 'quota');
  assert.equal(shared.value()?.reason, 'quota', 'gravado para as outras instâncias');
  assert.match(lines[0], /disjuntor aberto \(quota\).*até 2026-10-29T07:00:00/);

  // Another instance (empty memory) learns of it from the shared state
  const other = createYoutubeBreaker({ memory: newBreakerMemory(), store: shared.store, now: () => now, log: () => undefined });
  assert.equal((await other.check())?.reason, 'quota');

  // After the reset it closes by itself
  now = state.until + 1;
  assert.equal(await breaker.check(), null);
});

test('INV-PLAY-15: o disjuntor falha aberto-para-uso: sem o estado compartilhado a busca segue, e "fechado" não vai ao banco a cada pedido', async () => {
  let now = 1_000_000;
  const broken = memoryStore(null, { failGet: true, failSet: true });
  const lines: string[] = [];
  const breaker = createYoutubeBreaker({ memory: newBreakerMemory(), store: broken.store, now: () => now, log: (line) => lines.push(line) });
  assert.equal(await breaker.check(), null, 'banco fora: não suspende nada');
  assert.ok(lines.some((line) => /estado compartilhado indisponível/.test(line)));
  const state = await breaker.trip('quota');
  assert.equal(state.reason, 'quota', 'mesmo sem gravar, vale nesta instância');
  assert.equal((await breaker.check())?.reason, 'quota');

  const healthy = memoryStore();
  const quiet = createYoutubeBreaker({ memory: newBreakerMemory(), store: healthy.store, now: () => now, log: () => undefined });
  await quiet.check();
  await quiet.check();
  await quiet.check();
  assert.equal(healthy.reads.length, 1, 'fechado confirmado uma vez; só lê de novo depois de 30 s');
  now += 31_000;
  await quiet.check();
  assert.deepEqual(healthy.reads, [BREAKER_KEY, BREAKER_KEY]);
});

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const WEB_RESULT = { contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: [
  { videoRenderer: { videoId: 'WEBVIDEO001', title: { runs: [{ text: 'Artista - Faixa (Official Audio)' }] }, ownerText: { runs: [{ text: 'Artista - Topic' }] }, lengthText: { simpleText: '3:20' } } }
] } }] } } } } };

test('INV-PLAY-15: a cota esgotada abre o disjuntor, a faixa é achada pela busca web, e as buscas seguintes nem tocam a API oficial', async () => {
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    urls.push(url);
    if (url.startsWith('https://www.googleapis.com/youtube/v3/search')) return jsonResponse({ error: { errors: [{ reason: 'quotaExceeded' }] } }, 403);
    if (url.includes('youtube.com/youtubei')) return jsonResponse(WEB_RESULT);
    if (url.includes('oembed')) return jsonResponse({}, 200);
    throw new Error(`url inesperada ${url} ${init?.method ?? ''}`);
  };
  const shared = memoryStore();
  const breaker = createYoutubeBreaker({ memory: newBreakerMemory(), store: shared.store, log: () => undefined });
  const query = { artist: 'Artista', title: 'Faixa', duration: 200 };

  const first = await resolveYouTubeVideos(query, { apiKey: 'key', fetchImpl, breaker });
  assert.equal(first.via, 'web-after-official-failure');
  assert.deepEqual(first.videoIds, ['WEBVIDEO001']);
  assert.equal(shared.value()?.reason, 'quota', 'a recusa abriu o disjuntor');

  const officialBefore = urls.filter((url) => url.includes('googleapis.com')).length;
  const second = await resolveYouTubeVideos(query, { apiKey: 'key', fetchImpl, breaker });
  assert.equal(second.via, 'web-api-suspended');
  assert.deepEqual(second.videoIds, ['WEBVIDEO001']);
  assert.equal(urls.filter((url) => url.includes('googleapis.com')).length, officialBefore, 'a API oficial não foi chamada de novo');
});

test('INV-PLAY-15: um erro que não é de cota (timeout, 500) não abre o disjuntor', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.startsWith('https://www.googleapis.com/youtube/v3/search')) return jsonResponse({ error: { errors: [{ reason: 'backendError' }] } }, 500);
    if (url.includes('youtube.com/youtubei')) return jsonResponse(WEB_RESULT);
    return jsonResponse({}, 200);
  };
  const shared = memoryStore();
  const breaker = createYoutubeBreaker({ memory: newBreakerMemory(), store: shared.store, log: () => undefined });
  await resolveYouTubeVideos({ artist: 'Artista', title: 'Faixa', duration: 200 }, { apiKey: 'key', fetchImpl, breaker });
  assert.equal(shared.value(), null);
});
