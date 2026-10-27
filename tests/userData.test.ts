import assert from 'node:assert/strict';
import test from 'node:test';
import type { Track } from '../src/types/music';
import { scopedStorage } from '../src/utils/scopedStorage';
import {
  adoptLegacyData,
  diffSnapshots,
  isEmptyDiff,
  mergeSnapshots,
  readSnapshot,
  readSyncFlag,
  snapshotKey,
  writeSnapshot,
  type UserDataSnapshot
} from '../src/utils/userData';

const track = (n: number): Track => ({
  id: `deezer-${n}`, title: `T${n}`, artist: 'A', album: 'B', duration: 100, coverUrl: '', style: 'x', categoryId: 'c', sources: { localUrl: '' }
});
const playlist = (id: string, name: string, tracks: Track[]) => ({ id, name, createdAt: 1, tracks });
const snap = (partial: Partial<UserDataSnapshot> = {}): UserDataSnapshot => ({ favorites: [], playlists: [], choices: {}, ...partial });

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return Object.assign(
    {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k)
    },
    { data }
  );
}

test('INV-DATA-01: scopedStorage separa as chaves por usuário e usa as chaves puras sem usuário', () => {
  const backing = memoryStorage();
  scopedStorage('u1', backing).setItem('k', 'a');
  scopedStorage('u2', backing).setItem('k', 'b');
  scopedStorage(null, backing).setItem('k', 'plain');
  assert.equal(scopedStorage('u1', backing).getItem('k'), 'a');
  assert.equal(scopedStorage('u2', backing).getItem('k'), 'b');
  assert.equal(scopedStorage(null, backing).getItem('k'), 'plain');
  assert.deepEqual([...backing.data.keys()].sort(), ['k', 'k:u1', 'k:u2']);
});

test('writeSnapshot e readSnapshot fazem o caminho de ida e volta', () => {
  const storage = memoryStorage();
  const original = snap({
    favorites: [track(1), track(2)],
    playlists: [playlist('p1', 'Estrada', [track(3), track(1)])],
    choices: { 'deezer-1': 'AAAAAAAAAAA' }
  });
  writeSnapshot(storage, original);
  assert.deepEqual(readSnapshot(storage), original);
});

test('diffSnapshots: nada muda, nada a enviar', () => {
  const s = snap({ favorites: [track(1)], playlists: [playlist('p', 'X', [track(2)])], choices: { a: 'AAAAAAAAAAA' } });
  assert.equal(isEmptyDiff(diffSnapshots(s, s)), true);
});

test('diffSnapshots: favoritos, escolhas e playlists (criar, renomear, trocar faixas, apagar)', () => {
  const remote = snap({
    favorites: [track(1), track(2)],
    playlists: [playlist('keep', 'Antes', [track(1), track(2), track(3)]), playlist('gone', 'Apagada', [track(1)])],
    choices: { 'deezer-1': 'AAAAAAAAAAA', 'deezer-9': 'CCCCCCCCCCC' }
  });
  const local = snap({
    favorites: [track(2), track(3)],
    playlists: [playlist('keep', 'Depois', [track(3), track(1)]), playlist('new', 'Nova', [track(5)])],
    choices: { 'deezer-1': 'BBBBBBBBBBB' }
  });
  const diff = diffSnapshots(remote, local);

  assert.deepEqual(diff.favoriteUpserts.map((t) => t.id), ['deezer-3']);
  assert.deepEqual(diff.favoriteRemovals, ['deezer-1']);
  assert.deepEqual(diff.playlistRemovals, ['gone']);
  assert.deepEqual(diff.playlistUpserts.map((p) => [p.id, p.name]), [['keep', 'Depois'], ['new', 'Nova']]);
  assert.deepEqual(
    diff.playlistTrackUpserts.map((t) => [t.playlistId, t.track.id, t.position]),
    [['keep', 'deezer-3', 0], ['keep', 'deezer-1', 1], ['new', 'deezer-5', 0]]
  );
  assert.deepEqual(diff.playlistTrackRemovals, [{ playlistId: 'keep', trackIds: ['deezer-2'] }]);
  assert.deepEqual(diff.choiceUpserts, [{ trackId: 'deezer-1', videoId: 'BBBBBBBBBBB' }]);
  assert.deepEqual(diff.choiceRemovals, ['deezer-9']);
});

test('mergeSnapshots junta tudo, com a ordem da conta primeiro e a escolha do aparelho vencendo', () => {
  const remote = snap({ favorites: [track(1)], playlists: [playlist('p', 'X', [track(1)])], choices: { a: 'AAAAAAAAAAA' } });
  const local = snap({
    favorites: [track(2), track(1)],
    playlists: [playlist('p', 'X', [track(2)]), playlist('q', 'Y', [])],
    choices: { a: 'BBBBBBBBBBB' }
  });
  const merged = mergeSnapshots(local, remote);
  assert.deepEqual(merged.favorites.map((t) => t.id), ['deezer-1', 'deezer-2']);
  assert.deepEqual(merged.playlists.map((p) => [p.id, p.tracks.map((t) => t.id)]), [['p', ['deezer-1', 'deezer-2']], ['q', []]]);
  assert.deepEqual(merged.choices, { a: 'BBBBBBBBBBB' });
});

test('snapshotKey ignora detalhes da faixa mas pega ordem e nomes', () => {
  assert.equal(snapshotKey(snap({ favorites: [track(1)] })), snapshotKey(snap({ favorites: [{ ...track(1), coverUrl: 'x' }] })));
  assert.notEqual(snapshotKey(snap({ favorites: [track(1), track(2)] })), snapshotKey(snap({ favorites: [track(2), track(1)] })));
});

test('adoptLegacyData leva os dados antigos para o primeiro usuário, troca ids de playlist e limpa as chaves puras', () => {
  const backing = memoryStorage();
  const legacy = scopedStorage(null, backing);
  writeSnapshot(legacy, snap({ favorites: [track(1)], playlists: [playlist('antiga', 'Velha', [track(2)])] }));

  assert.equal(adoptLegacyData(legacy, scopedStorage('u1', backing)), true);
  const mine = readSnapshot(scopedStorage('u1', backing));
  assert.deepEqual(mine.favorites.map((t) => t.id), ['deezer-1']);
  assert.match(mine.playlists[0].id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(readSyncFlag(scopedStorage('u1', backing)), 'merge');

  // Nobody else inherits it
  assert.equal(adoptLegacyData(legacy, scopedStorage('u2', backing)), false);
  assert.deepEqual(readSnapshot(scopedStorage('u2', backing)), snap());
  assert.equal(legacy.getItem('aurastream_liked_track_objects'), null);
});

test('adoptLegacyData não faz nada sem dados antigos', () => {
  const backing = memoryStorage();
  assert.equal(adoptLegacyData(scopedStorage(null, backing), scopedStorage('u1', backing)), false);
  assert.equal(readSyncFlag(scopedStorage('u1', backing)), null);
});

