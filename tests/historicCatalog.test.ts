import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findHistoricMatches,
  HISTORIC_ALBUM_PREFIX,
  loadHistoricAlbumPage,
  type HistoricIndex
} from '../src/utils/historicCatalog';

const MOCK_INDEX: HistoricIndex = {
  generatedAt: '2026-11-09',
  source: 'test',
  compilations: [
    { id: 'm3', title: 'Lovy Metal 1', base: 'lovy metal', year: 2001, catno: '23282', tracks: 14, matched: 12 },
    { id: 'm4', title: 'Lovy Metal 3', base: 'lovy metal', year: 2003, catno: '23284', tracks: 14, matched: 10 },
    { id: 'cam-alt', title: 'Alternativo 2000', base: 'alternativo', year: 2000, catno: 'CAM-2000', tracks: 14, matched: 14 },
    { id: 'cam-ver', title: 'Verão 98', base: 'verao', year: 1998, catno: 'CAM-1998', tracks: 14, matched: 14 },
    { id: 'm1845970', title: 'Summer Eletrohits', base: 'summer eletrohits', year: 2005, catno: '001', tracks: 16, matched: 16 }
  ]
};

test('INV-CAT-02: carregar uma coletânea histórica gera um AlbumPage com faixas e metadados oficiais', async () => {
  // Mock fetch for loadHistoricAlbumPage
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/historic/t/m3.json')) {
      return {
        ok: true,
        json: async () => ({
          id: 'm3',
          title: 'Lovy Metal 1',
          base: 'lovy metal',
          year: 2001,
          label: 'Som Livre',
          catno: '23282',
          country: 'Brazil',
          tracks: [
            { position: '1', title: 'Silent Lucidity', artist: 'Queensrÿche', duration: '5:07', deezerId: 1234 },
            { position: '2', title: 'Still Loving You', artist: 'Scorpions', duration: '6:23', deezerId: null }
          ]
        })
      } as Response;
    }
    return { ok: false, status: 404 } as Response;
  };

  try {
    const page = await loadHistoricAlbumPage(`${HISTORIC_ALBUM_PREFIX}m3`);
    assert.equal(page.album.title, 'Lovy Metal 1');
    assert.equal(page.album.artist, 'Som Livre');
    assert.equal(page.album.year, 2001);
    assert.equal(page.tracks.tracks.length, 2);

    const [t1, t2] = page.tracks.tracks;
    assert.equal(t1.title, 'Silent Lucidity');
    assert.equal(t1.artist, 'Queensrÿche');
    assert.equal(t1.duration, 307);
    assert.equal(t1.id, 'deezer-1234');

    assert.equal(t2.title, 'Still Loving You');
    assert.equal(t2.artist, 'Scorpions');
    assert.equal(t2.duration, 383);
    assert.equal(t2.id, 'hist-m3-2');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('INV-CAT-03: busca por nome da série encontra os CDs; busca com artista ou genérica não mostra nenhum CD', () => {
  // Exact series matches
  const lovyMatches = findHistoricMatches('lovy metal', MOCK_INDEX);
  assert.equal(lovyMatches.length, 2);
  assert.equal(lovyMatches[0].title, 'Lovy Metal 1');
  assert.equal(lovyMatches[1].title, 'Lovy Metal 3');

  // Series match with volume/year in query
  const lovyVolMatches = findHistoricMatches('lovy metal 1', MOCK_INDEX);
  assert.equal(lovyVolMatches.length, 2);

  // Camelô classics matches
  const altMatches = findHistoricMatches('alternativo 2000', MOCK_INDEX);
  assert.equal(altMatches.length, 1);
  assert.equal(altMatches[0].title, 'Alternativo 2000');

  const veraoMatches = findHistoricMatches('verão 98', MOCK_INDEX);
  assert.equal(veraoMatches.length, 1);
  assert.equal(veraoMatches[0].title, 'Verão 98');

  // Searches that include artists must return empty (prevent artist searches becoming compilations)
  assert.deepEqual(findHistoricMatches('love metal iron maiden', MOCK_INDEX), []);
  assert.deepEqual(findHistoricMatches('metallica classic metal', MOCK_INDEX), []);
  assert.deepEqual(findHistoricMatches('good times bee gees', MOCK_INDEX), []);

  // Generic and empty queries must return empty
  assert.deepEqual(findHistoricMatches('som livre', MOCK_INDEX), []);
  assert.deepEqual(findHistoricMatches('cd', MOCK_INDEX), []);
  assert.deepEqual(findHistoricMatches('', MOCK_INDEX), []);
  assert.deepEqual(findHistoricMatches('a', MOCK_INDEX), []);
});
