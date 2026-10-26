import assert from 'node:assert/strict';
import test from 'node:test';
import type { Track } from '../src/types/music';
import { groupByAlbum, groupByArtist, libraryParent, libraryTitle, tracksOf } from '../src/utils/library';

const t = (id: string, artist: string, album: string): Track => ({
  id, title: id, artist, album, duration: 100, coverUrl: `c-${id}`, style: 's', categoryId: 'web', sources: { localUrl: '' }
});
const liked = [t('1', 'Oasis', 'Morning Glory'), t('2', 'Creed', 'Weathered'), t('3', 'oasis', 'Morning Glory'), t('4', 'Oasis', 'Be Here Now')];

test('groupByArtist junta maiúsculas e minúsculas e ordena pelo nome', () => {
  const groups = groupByArtist(liked);
  assert.deepEqual(groups.map((g) => [g.name, g.tracks.length]), [['Creed', 1], ['Oasis', 3]]);
});

test('groupByAlbum separa álbuns iguais de artistas diferentes', () => {
  const groups = groupByAlbum([...liked, t('5', 'Outro', 'Morning Glory')]);
  assert.equal(groups.filter((g) => g.name === 'Morning Glory').length, 2);
  assert.equal(groups.find((g) => g.name === 'Morning Glory' && g.detail === 'Oasis')?.tracks.length, 2);
});

test('tracksOf, libraryTitle e libraryParent seguem a navegação', () => {
  assert.equal(tracksOf({ kind: 'artist', name: 'Oasis' }, liked, []).length, 3);
  assert.equal(tracksOf({ kind: 'album', name: 'Be Here Now', artist: 'Oasis' }, liked, []).length, 1);
  assert.equal(tracksOf({ kind: 'downloads' }, liked, [liked[0]]).length, 1);
  assert.equal(libraryTitle(null), 'Biblioteca');
  assert.equal(libraryTitle({ kind: 'artist', name: 'Oasis' }), 'Oasis');
  assert.deepEqual(libraryParent({ kind: 'artist', name: 'x' }), { kind: 'artists' });
  assert.equal(libraryParent({ kind: 'songs' }), null);
  assert.equal(libraryTitle({ kind: 'playlists' }), 'Playlists');
  assert.equal(libraryTitle({ kind: 'playlist', id: 'a' }, [{ id: 'a', name: 'Estrada' }]), 'Estrada');
  assert.equal(libraryTitle({ kind: 'playlist', id: 'zz' }, [{ id: 'a', name: 'Estrada' }]), 'Playlist', 'playlist apagada');
  assert.deepEqual(libraryParent({ kind: 'playlist', id: 'a' }), { kind: 'playlists' });
});
