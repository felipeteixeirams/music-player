import assert from 'node:assert/strict';
import test from 'node:test';
import { isPlaylistNameTaken, type Playlist } from '../src/utils/playlists';

const playlist = (name: string): Playlist => ({ id: name, name, createdAt: 0, tracks: [] });

test('INV-SMART-08: o nome da playlist é único entre as da própria pessoa, comparando como foi digitado (sem ignorar maiúsculas)', () => {
  const mine = [playlist('Treino'), playlist('Viagem')];
  assert.equal(isPlaylistNameTaken(mine, 'Treino'), true);
  assert.equal(isPlaylistNameTaken(mine, '  Treino  '), true, 'espaços nas pontas não contam');
  assert.equal(isPlaylistNameTaken(mine, 'treino'), false, 'maiúscula muda o nome');
  assert.equal(isPlaylistNameTaken(mine, 'Treino 2'), false);
  assert.equal(isPlaylistNameTaken(mine, '   '), false, 'vazio não é nome repetido (a validação de vazio é outra)');
  assert.equal(isPlaylistNameTaken([], 'Treino'), false);
});
