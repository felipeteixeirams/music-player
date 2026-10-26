import assert from 'node:assert/strict';
import test from 'node:test';
import type { Track } from '../src/types/music';
import { readSnapshot, readSyncFlag, writeSnapshot, writeSyncFlag, type SnapshotDiff, type UserDataSnapshot } from '../src/utils/userData';
import { createRemote, RemoteError, type Remote } from '../src/utils/userDataRemote';
import { UserDataSync } from '../src/utils/userDataSync';

const track = (n: number): Track => ({
  id: `deezer-${n}`, title: `T${n}`, artist: 'A', album: 'B', duration: 100, coverUrl: '', style: 'x', categoryId: 'c', sources: { localUrl: '' }
});
const snap = (partial: Partial<UserDataSnapshot> = {}): UserDataSnapshot => ({ favorites: [], playlists: [], choices: {}, ...partial });

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k)
  };
}

/** An account in memory: pushes are applied by hand to what `fetchAll` returns next. */
function fakeRemote(initial: UserDataSnapshot) {
  const state = { account: initial, pushes: [] as SnapshotDiff[], failWith: null as RemoteError | null, onFetch: null as (() => void) | null };
  const remote: Remote = {
    async fetchAll() {
      if (state.failWith) throw state.failWith;
      state.onFetch?.();
      return state.account;
    },
    async push(diff) {
      if (state.failWith) throw state.failWith;
      state.pushes.push(diff);
      state.account = snap({
        favorites: [...state.account.favorites.filter((t) => !diff.favoriteRemovals.includes(t.id)), ...diff.favoriteUpserts],
        playlists: state.account.playlists,
        choices: state.account.choices
      });
    }
  };
  return { state, remote };
}

const setup = (local: UserDataSnapshot, account: UserDataSnapshot) => {
  const storage = memoryStorage();
  writeSnapshot(storage, local);
  const fake = fakeRemote(account);
  let applied = 0;
  const sync = new UserDataSync({ storage, remote: fake.remote, onApplied: () => applied++, debounceMs: 0 });
  return { storage, ...fake, sync, applied: () => applied };
};

const ids = (s: UserDataSnapshot) => s.favorites.map((t) => t.id);

test('sem pendências, a conta vence: o aparelho recebe o que ela tem', async () => {
  const t = setup(snap({ favorites: [track(1)] }), snap({ favorites: [track(2)] }));
  t.sync.start();
  await t.sync.idle();
  assert.deepEqual(ids(readSnapshot(t.storage)), ['deezer-2']);
  assert.equal(t.applied(), 1);
  assert.equal(t.state.pushes.length, 0);
});

test('com alterações pendentes (marca no armazenamento), o aparelho vence e o que sobrou na conta é removido', async () => {
  const t = setup(snap({ favorites: [track(1)] }), snap({ favorites: [track(2)] }));
  writeSyncFlag(t.storage, 'local');
  t.sync.start();
  await t.sync.idle();
  assert.deepEqual(ids(t.state.account), ['deezer-1']);
  assert.equal(readSyncFlag(t.storage), null);
  assert.equal(t.applied(), 0);
});

test('primeiro login com dados antigos junta aparelho e conta', async () => {
  const t = setup(snap({ favorites: [track(1)] }), snap({ favorites: [track(2)] }));
  writeSyncFlag(t.storage, 'merge');
  t.sync.start();
  await t.sync.idle();
  assert.deepEqual(ids(readSnapshot(t.storage)).sort(), ['deezer-1', 'deezer-2']);
  assert.deepEqual(ids(t.state.account).sort(), ['deezer-1', 'deezer-2']);
  assert.equal(readSyncFlag(t.storage), null);
});

test('sem conexão nada é perdido: a marca fica e a alteração segue na próxima tentativa', async () => {
  const t = setup(snap(), snap());
  t.state.failWith = new RemoteError('Sem conexão', 0);
  t.sync.start();
  await t.sync.idle();

  writeSnapshot(t.storage, snap({ favorites: [track(1)] }));
  t.sync.notifyChanged();
  assert.equal(readSyncFlag(t.storage), 'local', 'marcada na hora, antes da espera');
  await t.sync.idle();
  await new Promise((r) => setTimeout(r, 5));
  await t.sync.idle();
  assert.deepEqual(ids(t.state.account), []);

  t.state.failWith = null;
  t.sync.refresh();
  await t.sync.idle();
  assert.deepEqual(ids(t.state.account), ['deezer-1']);
  assert.equal(readSyncFlag(t.storage), null);
});

test('uma alteração feita enquanto a conta era lida não é sobrescrita', async () => {
  const t = setup(snap(), snap({ favorites: [track(2)] }));
  t.state.onFetch = () => writeSnapshot(t.storage, snap({ favorites: [track(1)] }));
  t.sync.start();
  await t.sync.idle();
  assert.deepEqual(ids(t.state.account), ['deezer-1']);
  assert.deepEqual(ids(readSnapshot(t.storage)), ['deezer-1']);
});

test('depois de sincronizado, as mudanças são enviadas sem reenviar o resto', async () => {
  const t = setup(snap({ favorites: [track(1)] }), snap({ favorites: [track(1)] }));
  t.sync.start();
  await t.sync.idle();

  writeSnapshot(t.storage, snap({ favorites: [track(1), track(3)] }));
  t.sync.notifyChanged();
  await new Promise((r) => setTimeout(r, 5));
  await t.sync.idle();
  assert.equal(t.state.pushes.length, 1);
  assert.deepEqual(t.state.pushes[0].favoriteUpserts.map((x) => x.id), ['deezer-3']);
  assert.equal(readSyncFlag(t.storage), null);
});

test('refresh traz novidades de outro aparelho quando este não tem pendências', async () => {
  const t = setup(snap(), snap());
  t.sync.start();
  await t.sync.idle();
  t.state.account = snap({ favorites: [track(4)] });
  t.sync.refresh();
  await t.sync.idle();
  assert.deepEqual(ids(readSnapshot(t.storage)), ['deezer-4']);
});

test('uma recusa definitiva da conta (limite) devolve ao aparelho o que a conta tem', async () => {
  const t = setup(snap(), snap({ favorites: [track(2)] }));
  t.sync.start();
  await t.sync.idle();

  writeSnapshot(t.storage, snap({ favorites: [track(2), track(9)] }));
  t.state.failWith = new RemoteError('Falha 400', 400);
  const originalFetch = t.remote.fetchAll;
  t.remote.fetchAll = async () => (t.state.account);
  t.sync.notifyChanged();
  await new Promise((r) => setTimeout(r, 5));
  await t.sync.idle();
  t.remote.fetchAll = originalFetch;
  assert.deepEqual(ids(readSnapshot(t.storage)), ['deezer-2']);
  assert.equal(readSyncFlag(t.storage), null);
});

// ------------------------------------------------------------------ cliente REST

function recordingFetch(respond: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond(url, init);
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}
const config = { url: 'https://p.supabase.co', key: 'anon' };
const user = async () => ({ id: 'user-1', token: 'jwt' });

test('fetchAll lê as quatro tabelas com o token do usuário e junta as faixas às playlists', async () => {
  const { calls, fetchImpl } = recordingFetch((url) => {
    const body = url.includes('/favorites?')
      ? [{ track: track(1) }]
      : url.includes('/playlists?')
      ? [{ id: 'p1', name: 'Estrada', created_at: '2026-01-01T00:00:00Z' }]
      : url.includes('/playlist_tracks?')
      ? [{ playlist_id: 'p1', track: track(2), position: 0 }]
      : [{ track_id: 'deezer-1', video_id: 'AAAAAAAAAAA' }];
    return new Response(JSON.stringify(body));
  });
  const data = await createRemote(config, user, fetchImpl).fetchAll();
  assert.equal(calls.length, 4);
  assert.ok(calls.every((c) => (c.init.headers as Record<string, string>).Authorization === 'Bearer jwt'));
  assert.deepEqual(ids(data), ['deezer-1']);
  assert.deepEqual(data.playlists.map((p) => [p.id, p.name, p.tracks.map((t) => t.id)]), [['p1', 'Estrada', ['deezer-2']]]);
  assert.equal(data.playlists[0].createdAt, Date.parse('2026-01-01T00:00:00Z'));
  assert.deepEqual(data.choices, { 'deezer-1': 'AAAAAAAAAAA' });
});

test('fetchAll pagina além de mil linhas', async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ track: track(i) }));
  const { calls, fetchImpl } = recordingFetch((url) => {
    if (!url.includes('/favorites?')) return new Response('[]');
    return new Response(JSON.stringify(url.includes('offset=0') ? rows : [{ track: track(5000) }]));
  });
  const data = await createRemote(config, user, fetchImpl).fetchAll();
  assert.equal(data.favorites.length, 1001);
  assert.equal(calls.filter((c) => c.url.includes('/favorites?')).length, 2);
});

test('push envia upserts antes e remoções depois, com o dono preenchido', async () => {
  const { calls, fetchImpl } = recordingFetch(() => new Response(null, { status: 204 }));
  await createRemote(config, user, fetchImpl).push({
    favoriteUpserts: [track(1)],
    favoriteRemovals: ['deezer-9'],
    playlistUpserts: [{ id: 'p', name: 'X', createdAt: 0 }],
    playlistRemovals: ['old'],
    playlistTrackUpserts: [{ playlistId: 'p', track: track(1), position: 0 }],
    playlistTrackRemovals: [],
    choiceUpserts: [],
    choiceRemovals: []
  });
  const summary = calls.map((c) => `${c.init.method} ${c.url.replace(config.url + '/rest/v1', '').split('?')[0]}`);
  assert.deepEqual(summary, ['POST /playlists', 'POST /playlist_tracks', 'POST /favorites', 'DELETE /favorites', 'DELETE /playlists']);
  const favoriteBody = JSON.parse(calls[2].init.body as string);
  assert.equal(favoriteBody[0].user_id, 'user-1');
  assert.ok(calls[3].url.includes('track_id=in.'));
});

test('erros do servidor viram RemoteError, repetíveis ou não', async () => {
  const failing = (status: number) => createRemote(config, user, recordingFetch(() => new Response('{}', { status })).fetchImpl).fetchAll();
  await assert.rejects(failing(503), (e: RemoteError) => e.retryable && e.status === 503);
  await assert.rejects(failing(400), (e: RemoteError) => !e.retryable);
  const offline = createRemote(config, user, (async () => { throw new Error('offline'); }) as unknown as typeof fetch);
  await assert.rejects(offline.fetchAll(), (e: RemoteError) => e.retryable && e.status === 0);
});
