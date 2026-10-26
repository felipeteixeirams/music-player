import assert from 'node:assert/strict';
import test from 'node:test';
import type { Track } from '../src/types/music';
import { PlayedCounter, PLAY_THRESHOLD_SECONDS, playThreshold } from '../src/utils/playedCounter';
import {
  applyRemoteHistory,
  clearDone,
  distinctRecent,
  isClearPending,
  loadHistory,
  loadOutbox,
  markSent,
  MAX_HISTORY,
  recordPlay,
  requestClear
} from '../src/utils/playHistory';
import { createHistoryRemote, type HistoryRemote } from '../src/utils/playHistoryRemote';
import { PlayHistorySync } from '../src/utils/playHistorySync';
import { RemoteError } from '../src/utils/supabaseRest';

const track = (n: number, duration = 200): Track => ({
  id: `deezer-${n}`, title: `T${n}`, artist: 'A', album: 'B', duration, coverUrl: '', style: 'x', categoryId: 'c', sources: { localUrl: '' }
});

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k)
  };
}

/** Feeds the counter a playback clock that ticks every 0.25 s, as the player does. */
function listen(counter: PlayedCounter, t: Track, from: number, to: number) {
  for (let s = from; s <= to + 1e-9; s += 0.25) counter.tick(t, s);
}

// ------------------------------------------------------------------ quando conta como reproduzida

test('conta uma vez, depois de ouvir o bastante', () => {
  const played: string[] = [];
  const counter = new PlayedCounter((t) => played.push(t.id));
  listen(counter, track(1), 0, PLAY_THRESHOLD_SECONDS - 1);
  assert.deepEqual(played, []);
  listen(counter, track(1), PLAY_THRESHOLD_SECONDS - 1, 120);
  assert.deepEqual(played, ['deezer-1']);
});

test('faixa curta conta com metade; a prévia de 30 s conta', () => {
  assert.equal(playThreshold(4), 2);
  assert.equal(playThreshold(200), PLAY_THRESHOLD_SECONDS);
  assert.ok(playThreshold(30) < 30);
  const played: string[] = [];
  const counter = new PlayedCounter((t) => played.push(t.id));
  listen(counter, track(1, 4), 0, 3);
  assert.deepEqual(played, ['deezer-1']);
});

test('pular para frente não conta como ouvir', () => {
  const played: string[] = [];
  const counter = new PlayedCounter((t) => played.push(t.id));
  counter.tick(track(1), 0);
  counter.tick(track(1), 100);
  counter.tick(track(1), 100.25);
  counter.tick(track(1), 190);
  assert.deepEqual(played, []);
});

test('trocar de faixa recomeça a conta, e a primeira não conta pela metade', () => {
  const played: string[] = [];
  const counter = new PlayedCounter((t) => played.push(t.id));
  listen(counter, track(1), 0, 20);
  listen(counter, track(2), 0, 30);
  assert.deepEqual(played, ['deezer-2']);
});

test('começar de novo depois de contar (repetir a faixa) é outra reprodução', () => {
  const played: string[] = [];
  const counter = new PlayedCounter((t) => played.push(t.id));
  listen(counter, track(1), 0, 40);
  listen(counter, track(1), 0, 40);
  assert.deepEqual(played, ['deezer-1', 'deezer-1']);
});

test('sem faixa não faz nada', () => {
  const counter = new PlayedCounter(() => assert.fail('não devia contar'));
  counter.tick(null, 50);
});

// ------------------------------------------------------------------ armazenamento

test('recordPlay mostra na hora e guarda na fila de envio; só faixas do catálogo entram', () => {
  const storage = memoryStorage();
  recordPlay(storage, track(1), 100);
  recordPlay(storage, track(2), 200);
  recordPlay(storage, { ...track(3), id: 'radio-xyz' }, 300);
  assert.deepEqual(loadHistory(storage).map((e) => e.track.id), ['deezer-2', 'deezer-1']);
  assert.deepEqual(loadOutbox(storage).map((e) => e.track.id), ['deezer-1', 'deezer-2']);
});

test('a lista do dispositivo tem teto', () => {
  const storage = memoryStorage();
  for (let i = 0; i < MAX_HISTORY + 20; i++) recordPlay(storage, track(i), i);
  assert.equal(loadHistory(storage).length, MAX_HISTORY);
  assert.equal(loadHistory(storage)[0].track.id, `deezer-${MAX_HISTORY + 19}`);
});

test('a lista da conta substitui a do aparelho mas mantém no topo o que ainda não foi enviado', () => {
  const storage = memoryStorage();
  recordPlay(storage, track(9), 900);
  applyRemoteHistory(storage, [
    { track: track(5), playedAt: 500 },
    { track: track(4), playedAt: 400 }
  ]);
  assert.deepEqual(loadHistory(storage).map((e) => e.track.id), ['deezer-9', 'deezer-5', 'deezer-4']);
  markSent(storage, loadOutbox(storage));
  assert.deepEqual(loadOutbox(storage), []);
});

test('distinctRecent mostra cada faixa uma vez, a reprodução mais recente primeiro', () => {
  const entries = [
    { track: track(1), playedAt: 5 },
    { track: track(2), playedAt: 4 },
    { track: track(1), playedAt: 3 }
  ];
  assert.deepEqual(distinctRecent(entries).map((t) => t.id), ['deezer-1', 'deezer-2']);
  assert.equal(distinctRecent(entries, 1).length, 1);
});

test('limpar apaga a lista e a fila na hora e deixa um pedido para a conta', () => {
  const storage = memoryStorage();
  recordPlay(storage, track(1), 1);
  requestClear(storage);
  assert.deepEqual(loadHistory(storage), []);
  assert.deepEqual(loadOutbox(storage), []);
  assert.equal(isClearPending(storage), true);
  clearDone(storage);
  assert.equal(isClearPending(storage), false);
});

// ------------------------------------------------------------------ sincronização

function fakeRemote(account: { track: Track; playedAt: number }[] = []) {
  const state = { account, sent: [] as number[], cleared: 0, failWith: null as RemoteError | null };
  const remote: HistoryRemote = {
    async fetchRecent() {
      if (state.failWith) throw state.failWith;
      return [...state.account].sort((a, b) => b.playedAt - a.playedAt);
    },
    async send(entries) {
      if (state.failWith) throw state.failWith;
      state.account.push(...entries);
      state.sent.push(entries.length);
    },
    async clear() {
      if (state.failWith) throw state.failWith;
      state.account = [];
      state.cleared++;
    }
  };
  return { state, remote };
}

const syncOf = (storage: ReturnType<typeof memoryStorage>, remote: HistoryRemote) => {
  let applied = 0;
  const sync = new PlayHistorySync({ storage, remote, onApplied: () => applied++, debounceMs: 0 });
  return { sync, applied: () => applied };
};

test('ao abrir: envia o que ficou pendente e traz a lista da conta (inclusive de outro aparelho)', async () => {
  const storage = memoryStorage();
  recordPlay(storage, track(1), 100);
  const { state, remote } = fakeRemote([{ track: track(7), playedAt: 700 }]);
  const { sync, applied } = syncOf(storage, remote);
  sync.start();
  await sync.idle();
  assert.deepEqual(state.account.map((e) => e.track.id).sort(), ['deezer-1', 'deezer-7']);
  assert.deepEqual(loadOutbox(storage), []);
  assert.deepEqual(loadHistory(storage).map((e) => e.track.id), ['deezer-7', 'deezer-1']);
  assert.equal(applied(), 1);
});

test('sem conexão a fila fica e vai na próxima tentativa, sem duplicar', async () => {
  const storage = memoryStorage();
  recordPlay(storage, track(1), 100);
  const { state, remote } = fakeRemote();
  state.failWith = new RemoteError('Sem conexão', 0);
  const { sync } = syncOf(storage, remote);
  sync.start();
  await sync.idle();
  assert.equal(loadOutbox(storage).length, 1);

  state.failWith = null;
  sync.refresh();
  await sync.idle();
  sync.refresh();
  await sync.idle();
  assert.equal(state.account.length, 1);
  assert.deepEqual(loadOutbox(storage), []);
});

test('uma reprodução que a conta recusa para sempre é descartada para não travar as outras', async () => {
  const storage = memoryStorage();
  recordPlay(storage, track(1), 100);
  const { state, remote } = fakeRemote();
  const original = remote.send;
  remote.send = async () => {
    throw new RemoteError('Falha 400', 400);
  };
  const { sync } = syncOf(storage, remote);
  sync.start();
  await sync.idle();
  assert.deepEqual(loadOutbox(storage), []);
  remote.send = original;
  assert.equal(state.account.length, 0);
});

test('limpar: o pedido vai para a conta antes de qualquer envio, e a lista volta vazia', async () => {
  const storage = memoryStorage();
  const { state, remote } = fakeRemote([{ track: track(7), playedAt: 700 }]);
  requestClear(storage);
  const { sync } = syncOf(storage, remote);
  sync.start();
  await sync.idle();
  assert.equal(state.cleared, 1);
  assert.deepEqual(state.account, []);
  assert.equal(isClearPending(storage), false);
  assert.deepEqual(loadHistory(storage), []);
});

test('notifyChanged envia sem ler a lista da conta', async () => {
  const storage = memoryStorage();
  const { state, remote } = fakeRemote();
  const { sync, applied } = syncOf(storage, remote);
  recordPlay(storage, track(1), 100);
  sync.notifyChanged();
  await new Promise((r) => setTimeout(r, 5));
  await sync.idle();
  assert.equal(state.account.length, 1);
  assert.equal(applied(), 0);
});

// ------------------------------------------------------------------ cliente REST

test('createHistoryRemote lê as últimas reproduções e envia com o dono e a hora', async () => {
  const calls: { url: string; method?: string; body?: string }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method, body: init.body as string });
    if (!init.method) return new Response(JSON.stringify([{ track: track(1), played_at: '2026-01-01T00:00:00Z' }]));
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
  const remote = createHistoryRemote({ url: 'https://p.supabase.co', key: 'anon' }, async () => ({ id: 'u1', token: 'jwt' }), fetchImpl);

  assert.deepEqual(await remote.fetchRecent(50), [{ track: track(1), playedAt: Date.parse('2026-01-01T00:00:00Z') }]);
  assert.ok(calls[0].url.includes('/play_history?select=track,played_at&order=played_at.desc,id.desc&limit=50'));

  await remote.send([{ track: track(2), playedAt: 1_700_000_000_000 }]);
  const row = JSON.parse(calls[1].body!)[0];
  assert.deepEqual([row.user_id, row.track_id, row.played_at], ['u1', 'deezer-2', new Date(1_700_000_000_000).toISOString()]);

  await remote.clear();
  assert.equal(calls[2].method, 'DELETE');
  assert.ok(calls[2].url.endsWith('/play_history?user_id=eq.u1'));
});
