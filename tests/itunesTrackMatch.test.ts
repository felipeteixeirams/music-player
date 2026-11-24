// INV-CAT-07: a faixa sem capa do Deezer só recebe a capa do iTunes de mesmo artista e título parecido.
import assert from 'node:assert/strict';
import test from 'node:test';
import { pickItunesCover, sameName } from '../scripts/itunesTrackMatch.mjs';

const song = (artistName: string, trackName: string, artwork = 'https://is1.mzstatic.com/image/thumb/Music/x/100x100bb.jpg') => ({
  artistName,
  trackName,
  artworkUrl100: artwork
});

test('INV-CAT-07: a capa vem do iTunes do mesmo artista com o título começando igual, em 250 px', () => {
  const results = [song('Outro Artista', 'Like An Angel'), song('Filhos de Jah', 'Like An Angel (Ao Vivo)')];
  assert.equal(
    pickItunesCover(results, 'Like An Angel', 'Filhos de Jah'),
    'https://is1.mzstatic.com/image/thumb/Music/x/250x250bb.jpg'
  );
});

test('INV-CAT-07: artista diferente nunca conta, mesmo com o título igual', () => {
  assert.equal(pickItunesCover([song('Outro Artista', 'Like An Angel')], 'Like An Angel', 'Filhos de Jah'), null);
});

test('INV-CAT-07: título que não começa igual não casa, e música sem capa é pulada', () => {
  assert.equal(pickItunesCover([song('Filhos de Jah', 'Nosso Reggae')], 'Like An Angel', 'Filhos de Jah'), null);
  assert.equal(pickItunesCover([song('Filhos de Jah', 'Like An Angel', '')], 'Like An Angel', 'Filhos de Jah'), null);
  assert.equal(pickItunesCover(undefined, 'Like An Angel', 'Filhos de Jah'), null);
});

test('INV-CAT-07: acento, caixa e pontuação não atrapalham a comparação de nomes', () => {
  assert.equal(sameName('  Tombó da Ladeira!! '), 'tombo da ladeira');
  assert.equal(
    pickItunesCover([song('BERIMBROWN', 'Tombo da Ladeira (Remix)', 'https://is1.mzstatic.com/a/100x100bb.jpg')], 'Tombó da Ladeira', 'Berimbrown'),
    'https://is1.mzstatic.com/a/250x250bb.jpg'
  );
});
