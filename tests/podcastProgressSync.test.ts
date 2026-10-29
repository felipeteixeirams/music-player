import assert from 'node:assert/strict';
import test from 'node:test';
import { applyRemoteProgress, markDirty, PODCAST_PROGRESS_KEY, readProgress, saveProgress, takeDirty, type ProgressMap } from '../src/utils/podcastProgress';
import { PodcastProgressSync } from '../src/utils/podcastProgressSync';
import type { ProgressRemote } from '../src/utils/podcastProgressRemote';
import { RemoteError } from '../src/utils/supabaseRest';
import type { EpisodeRef } from '../src/utils/podcastTrack';

const REF: EpisodeRef = { title: 'Palestra', showId: '42', showTitle: 'Despertar Zen', showAuthor: 'Monja Coen', coverUrl: 'https://x.example/c.jpg', audioUrl: 'https://x.example/a.mp3', publishedAt: '2020-05-25T10:00:00.000Z' };

function memory() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
}

function fakeRemote(account: ProgressMap = {}) {
  const state = { account, pushes: [] as ProgressMap[], failWith: null as RemoteError | null };
  const remote: ProgressRemote = {
    async fetchAll() {
      if (state.failWith) throw state.failWith;
      return state.account;
    },
    async push(entries) {
      if (state.failWith) throw state.failWith;
      state.pushes.push(entries);
      state.account = { ...state.account, ...entries };
    }
  };
  return { state, remote };
}

test('INV-POD-07: o que o aparelho salva leva junto o episódio (para o "Continue ouvindo") e vai para a lista de envio', () => {
  takeDirty();
  const storage = memory();
  saveProgress(storage, 'pod-42-a', 600, 4000, 1000, REF);
  assert.deepEqual(readProgress(storage)['pod-42-a'].episode, REF);
  // A later save without the episode keeps the one already stored
  saveProgress(storage, 'pod-42-a', 700, 4000, 2000);
  assert.deepEqual(readProgress(storage)['pod-42-a'].episode, REF);
  assert.deepEqual(takeDirty(), ['pod-42-a']);
  assert.deepEqual(takeDirty(), [], 'cada envio leva o que ainda não foi');
  markDirty(['x']);
  assert.deepEqual(takeDirty(), ['x']);
});

test('INV-POD-07: o salvamento mais recente de cada episódio vale: o da conta só entra se for mais novo', () => {
  takeDirty();
  const storage = memory();
  saveProgress(storage, 'a', 500, 4000, 5000, REF);
  const changed = applyRemoteProgress(storage, {
    a: { position: 100, duration: 4000, updatedAt: 4000, episode: REF },
    b: { position: 900, duration: 3000, updatedAt: 1000, episode: REF }
  });
  assert.deepEqual(changed, ['b'], 'o "a" daqui é mais novo e fica');
  assert.equal(readProgress(storage).a.position, 500);
  assert.equal(readProgress(storage).b.position, 900);
  assert.deepEqual(applyRemoteProgress(storage, { a: { position: 1, duration: 1, updatedAt: 9000, episode: REF } }), ['a']);
  assert.equal(readProgress(storage).a.position, 1);
  assert.ok(storage.getItem(PODCAST_PROGRESS_KEY));
});

test('INV-POD-07: ao abrir, traz o que a conta tem de mais novo e manda o que o aparelho tem à frente', async () => {
  takeDirty();
  const storage = memory();
  saveProgress(storage, 'local-only', 300, 3000, 8000, REF);
  saveProgress(storage, 'ahead', 800, 3000, 9000, REF);
  takeDirty(); // as if the app had been closed before sending
  const { state, remote } = fakeRemote({
    ahead: { position: 100, duration: 3000, updatedAt: 2000, episode: REF },
    elsewhere: { position: 1200, duration: 3000, updatedAt: 7000, episode: REF }
  });
  const sync = new PodcastProgressSync({ storage, remote, debounceMs: 0 });
  sync.start();
  await sync.idle();
  assert.equal(readProgress(storage).elsewhere.position, 1200, 'veio da conta');
  assert.deepEqual(Object.keys(state.pushes[0]).sort(), ['ahead', 'local-only'], 'só foi o que estava à frente da conta');
  assert.equal(state.account.ahead.position, 800);
});

test('INV-POD-07: falha de rede mantém os episódios para a próxima tentativa; sem as tabelas (404) desliga na sessão', async () => {
  takeDirty();
  const storage = memory();
  const { state, remote } = fakeRemote();
  const sync = new PodcastProgressSync({ storage, remote, debounceMs: 0 });

  saveProgress(storage, 'a', 400, 3000, 1000, REF);
  state.failWith = new RemoteError('Sem conexão', 0);
  sync.flush();
  await sync.idle();
  assert.equal(state.pushes.length, 0);
  state.failWith = null;
  sync.flush();
  await sync.idle();
  assert.deepEqual(Object.keys(state.pushes[0]), ['a'], 'o que falhou foi na tentativa seguinte');

  saveProgress(storage, 'b', 400, 3000, 2000, REF);
  state.failWith = new RemoteError('Falha 404', 404);
  sync.flush();
  await sync.idle();
  state.failWith = null;
  saveProgress(storage, 'c', 400, 3000, 3000, REF);
  sync.flush();
  await sync.idle();
  assert.equal(state.pushes.length, 1, 'desligado: não tenta mais nesta sessão');
});
