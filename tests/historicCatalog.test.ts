// Coletâneas históricas (INV-CAT-02 e INV-CAT-03): a busca só mostra um CD quando o termo é o nome da série.
import assert from 'node:assert/strict';
import test from 'node:test';
import { findHistoricMatches, durationSeconds, historicAlbumSummary, historicCoverUrl, type HistoricEntry } from '../src/utils/historicCatalog';
import { baseTitle, norm } from '../src/utils/historicNames';

const entry = (id: string, title: string, base: string, year: number | null): HistoricEntry => ({
  id,
  title,
  base,
  year,
  catno: null,
  tracks: 10,
  matched: 8
});

const CATALOG: HistoricEntry[] = [
  entry('m1', 'Good Times', 'good times', 2003),
  entry('m2', 'Good Times 2', 'good times', 1990),
  entry('m3', 'Lovy Metal 1', 'lovy metal', 2001),
  entry('m4', 'Lovy Metal 3', 'lovy metal', 2003),
  entry('m5', 'Classic Metal', 'classic metal', null),
  entry('m6', 'Classic Metal 2', 'classic metal', 2005),
  entry('m7', 'Power Ballads', 'power ballads', 2004),
  entry('m8', 'Seattle 90', 'seattle 90', 2003)
];

test('INV-CAT-02: a busca pelo nome da série traz os volumes dela, do mais antigo ao mais novo', () => {
  assert.deepEqual(
    findHistoricMatches('good times', CATALOG).map((e) => e.id),
    ['m2', 'm1']
  );
  assert.deepEqual(
    findHistoricMatches('Classic Metal', CATALOG).map((e) => e.id),
    ['m5', 'm6']
  );
});

test('INV-CAT-02: nome com volume, edição ou ano ainda casa a série; aliases também', () => {
  assert.deepEqual(findHistoricMatches('lovy metal 3', CATALOG).map((e) => e.id), ['m3', 'm4']);
  assert.deepEqual(findHistoricMatches('Good Times 98', CATALOG).map((e) => e.id), ['m2', 'm1']);
  // "love metal" é como as pessoas escrevem; o catálogo tem "lovy metal"
  assert.deepEqual(findHistoricMatches('love metal', CATALOG).map((e) => e.id), ['m3', 'm4']);
});

test('INV-CAT-03: uma busca por artista ou por música nunca vira um CD', () => {
  for (const query of [
    'good times bee gees',
    'love metal iron maiden',
    'metallica classic metal',
    'rock good times',
    'power ballads roxette'
  ]) {
    assert.deepEqual(findHistoricMatches(query, CATALOG), [], query);
  }
});

test('INV-CAT-03: termos curtos ou genéricos não casam nenhum CD', () => {
  for (const query of ['metal', 'cd', 'som livre', 'coletanea', 'rock', 'good']) {
    assert.deepEqual(findHistoricMatches(query, CATALOG), [], query);
  }
});

test('o nome da série tira volume, edição, ano, acento e pontuação', () => {
  assert.equal(baseTitle('Various - Lovy Metal, Volume 2'), 'lovy metal');
  assert.equal(baseTitle('Various - Good Times 98 - Internacional'), 'good times');
  assert.equal(baseTitle('Various - Classic Metal 2'), 'classic metal');
  assert.equal(baseTitle('Various - Power Ballads (Internacional) 2004'), 'power ballads');
  assert.equal(norm('Ação, Canção!'), 'acao cancao');
});

test('a duração do Discogs ("5:41") vira segundos; sem tempo vale 0', () => {
  assert.equal(durationSeconds('5:41'), 341);
  assert.equal(durationSeconds('12:05'), 725);
  assert.equal(durationSeconds(null), 0);
  assert.equal(durationSeconds('?'), 0);
});

test('a capa do CD vem da Cover Art Archive pelo release do MusicBrainz; sem release, não há endereço', () => {
  assert.equal(historicCoverUrl('1ebe9ab6-a804-4f52-9773-695902e1fab3'), 'https://coverartarchive.org/release/1ebe9ab6-a804-4f52-9773-695902e1fab3/front-250');
  assert.equal(historicCoverUrl(null), '');
  assert.equal(historicCoverUrl(undefined), '');
  assert.equal(historicAlbumSummary({ ...entry('m1', 'Good Times', 'good times', 2003), mbid: null }).coverUrl, '');
});
