import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findMatchingCompilation, HISTORIC_COMPILATIONS } from '../src/data/historicCompilations';

test('historic compilations database has complete metadata and valid tracks', () => {
  assert.ok(HISTORIC_COMPILATIONS.length >= 4);

  for (const comp of HISTORIC_COMPILATIONS) {
    assert.ok(comp.id, 'Compilation must have an id');
    assert.ok(comp.title, 'Compilation must have a title');
    assert.ok(comp.year > 1970, 'Compilation must have a valid year');
    assert.ok(comp.tracks.length >= 7, `${comp.title} must have at least 7 tracks`);

    for (const track of comp.tracks) {
      assert.ok(track.id.startsWith('historic-'), 'Track id must have prefix');
      assert.ok(track.title, 'Track must have a title');
      assert.ok(track.artist, 'Track must have an artist');
      assert.ok(track.duration > 60, 'Track must have a realistic duration');
      assert.ok(track.coverUrl.startsWith('https://'), 'Track must have https coverUrl');
    }
  }
});

test('findMatchingCompilation identifies Lovy Metal queries (including Love Metal typos)', () => {
  const queries = [
    'lovy metal',
    'love metal',
    'Lovy Metal Som Livre',
    'cd love metal',
    'CD LOVY METAL',
    'lovy metal 1',
    'o melhor de lovy metal'
  ];

  for (const q of queries) {
    const match = findMatchingCompilation(q);
    assert.ok(match, `Expected query "${q}" to match a compilation`);
    assert.equal(match.id, 'lovy-metal');
  }
});

test('findMatchingCompilation identifies Good Times queries', () => {
  const queries = [
    'good times',
    'Good Times Som Livre',
    'cd good times',
    'good times 98',
    'radio good times'
  ];

  for (const q of queries) {
    const match = findMatchingCompilation(q);
    assert.ok(match, `Expected query "${q}" to match a compilation`);
    assert.equal(match.id, 'good-times');
  }
});

test('findMatchingCompilation identifies Classic Metal queries', () => {
  const queries = [
    'classic metal',
    'Classic Metal Som Livre',
    'cd classic metal'
  ];

  for (const q of queries) {
    const match = findMatchingCompilation(q);
    assert.ok(match, `Expected query "${q}" to match a compilation`);
    assert.equal(match.id, 'classic-metal');
  }
});

test('findMatchingCompilation identifies Power Ballads queries', () => {
  const queries = [
    'power ballads',
    'power ballads som livre',
    'cd power ballads'
  ];

  for (const q of queries) {
    const match = findMatchingCompilation(q);
    assert.ok(match, `Expected query "${q}" to match a compilation`);
    assert.equal(match.id, 'power-ballads');
  }
});

test('findMatchingCompilation returns null for non-compilation queries', () => {
  const queries = [
    'Metallica',
    'Coldplay',
    'Taylor Swift',
    'Jorge e Mateus',
    'Anitta',
    'rock'
  ];

  for (const q of queries) {
    const match = findMatchingCompilation(q);
    assert.equal(match, null, `Query "${q}" should not match a compilation`);
  }
});
