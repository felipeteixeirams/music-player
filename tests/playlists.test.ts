import assert from 'node:assert/strict';
import test from 'node:test';
import type { Track } from '../src/types/music';
import {
  addTrackToPlaylist, cleanName, createPlaylist, deletePlaylist, loadPlaylists, MAX_NAME_LENGTH, MAX_PLAYLISTS,
  MAX_TRACKS_PER_PLAYLIST, PLAYLISTS_KEY, playlistHasTrack, removeTrackFromPlaylist, renamePlaylist, savePlaylists
} from '../src/utils/playlists';

const track = (n: number): Track => ({
  id: `deezer-${n}`, title: `Faixa ${n}`, artist: 'Artista', album: 'Álbum', duration: 100, coverUrl: '', style: 's', categoryId: 'web', sources: { localUrl: '' }
});

const memory = (initial?: string) => {
  let value = initial ?? null;
  return { getItem: () => value, setItem: (_: string, v: string) => { value = v; }, read: () => value };
};

test('cleanName apara, junta espaços e corta no limite', () => {
  assert.equal(cleanName('  Meu   rock \n favorito  '), 'Meu rock favorito');
  assert.equal(cleanName('x'.repeat(200)).length, MAX_NAME_LENGTH);
  assert.equal(cleanName('   '), '');
});

test('createPlaylist acrescenta no fim, dá nome padrão e respeita o limite', () => {
  const one = createPlaylist([], '  Estrada ', 'p1', 5)!;
  assert.deepEqual(one, [{ id: 'p1', name: 'Estrada', createdAt: 5, tracks: [] }]);
  assert.equal(createPlaylist(one, '', 'p2', 6)![1].name, 'Playlist 2');
  const full = Array.from({ length: MAX_PLAYLISTS }, (_, i) => ({ id: `p${i}`, name: `P${i}`, createdAt: 0, tracks: [] }));
  assert.equal(createPlaylist(full, 'mais uma', 'x', 0), null);
});

test('renamePlaylist ignora nome vazio; deletePlaylist remove só a escolhida', () => {
  const lists = createPlaylist(createPlaylist([], 'A', 'a', 0)!, 'B', 'b', 0)!;
  assert.equal(renamePlaylist(lists, 'a', 'Novo')[0].name, 'Novo');
  assert.equal(renamePlaylist(lists, 'a', '   ')[0].name, 'A');
  assert.deepEqual(deletePlaylist(lists, 'a').map((p) => p.id), ['b']);
});

test('addTrackToPlaylist não repete faixa nem passa do limite; removeTrackFromPlaylist tira só ela', () => {
  let lists = createPlaylist([], 'A', 'a', 0)!;
  lists = addTrackToPlaylist(lists, 'a', track(1));
  lists = addTrackToPlaylist(lists, 'a', track(1));
  lists = addTrackToPlaylist(lists, 'a', track(2));
  assert.deepEqual(lists[0].tracks.map((t) => t.id), ['deezer-1', 'deezer-2']);
  assert.equal(playlistHasTrack(lists[0], 'deezer-2'), true);
  assert.equal(playlistHasTrack(undefined, 'deezer-2'), false);
  assert.deepEqual(removeTrackFromPlaylist(lists, 'a', 'deezer-1')[0].tracks.map((t) => t.id), ['deezer-2']);

  const big = [{ id: 'a', name: 'A', createdAt: 0, tracks: Array.from({ length: MAX_TRACKS_PER_PLAYLIST }, (_, i) => track(i + 10)) }];
  assert.equal(addTrackToPlaylist(big, 'a', track(1))[0].tracks.length, MAX_TRACKS_PER_PLAYLIST);
});

test('save e load de ida e volta; load descarta o que está malformado', () => {
  const storage = memory();
  const lists = addTrackToPlaylist(createPlaylist([], 'Casa', 'a', 7)!, 'a', track(3));
  savePlaylists(storage, lists);
  assert.deepEqual(loadPlaylists(storage), lists);

  const dirty = memory(JSON.stringify([
    { id: 'ok', name: ' Boa ', createdAt: 1, tracks: [track(1), { id: 'piped-x' }, null] },
    { id: '', name: 'sem id', tracks: [] },
    { id: 'semnome', name: '  ', tracks: [] },
    'lixo'
  ]));
  const loaded = loadPlaylists(dirty);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, 'Boa');
  assert.deepEqual(loaded[0].tracks.map((t) => t.id), ['deezer-1']);
  assert.deepEqual(loadPlaylists(memory('não é json')), []);
  assert.deepEqual(loadPlaylists(memory(JSON.stringify({ a: 1 }))), []);
  assert.equal(PLAYLISTS_KEY, 'aurastream_playlists');
});

test('savePlaylists não quebra quando o armazenamento recusa', () => {
  assert.doesNotThrow(() => savePlaylists({ setItem: () => { throw new Error('quota'); } }, []));
});
