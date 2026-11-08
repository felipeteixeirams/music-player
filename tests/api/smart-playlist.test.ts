import assert from 'node:assert/strict';
import test from 'node:test';
import type { Track } from '../../src/types/music';
import {
  buildValidationReport,
  resolveAndValidateCandidates,
  smartPlaylistEndpoint
} from '../../api/_smartPlaylist.js';

function mockTrack(id: string, title: string, artist: string): Track {
  return {
    id: `deezer-${id}`,
    title,
    artist,
    album: 'Album Teste',
    duration: 210,
    coverUrl: 'https://e-cdns-images.dzcdn.net/images/cover/test.jpg',
    style: 'Deezer',
    categoryId: 'test',
    sources: {
      localUrl: '',
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/test.mp3'
    }
  };
}

test('INV-SMART-01: toda faixa resolvida e validada pertence ao catálogo com id e metadados reais', async () => {
  const candidates = [
    { artist: 'Legião Urbana', title: 'Tempo Perdido', searchQuery: 'Legião Urbana Tempo Perdido' },
    { artist: 'Paralamas do Sucesso', title: 'Vital', searchQuery: 'Paralamas Vital' }
  ];

  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('Tempo')) {
      return new Response(JSON.stringify({
        data: [{
          id: 111,
          title: 'Tempo Perdido',
          artist: { name: 'Legião Urbana' },
          album: { title: 'Dois' },
          duration: 300,
          preview: 'https://cdns-preview-d.dzcdn.net/stream/tempo.mp3'
        }],
        total: 1
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      data: [{
        id: 222,
        title: 'Vital e Sua Moto',
        artist: { name: 'Os Paralamas do Sucesso' },
        album: { title: 'Cinema Mudo' },
        duration: 190,
        preview: 'https://cdns-preview-d.dzcdn.net/stream/vital.mp3'
      }],
      total: 1
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const tracks = await resolveAndValidateCandidates(candidates, 2, 'rock nacional', fakeFetch);
  assert.equal(tracks.length, 2);
  for (const t of tracks) {
    assert.ok(t.id.startsWith('deezer-') || t.id.startsWith('itunes-'), `id deve ser de catálogo: ${t.id}`);
    assert.ok(t.title && t.artist, 'faixa deve ter título e artista');
    assert.ok(t.sources?.previewUrl, 'faixa deve conter previewUrl para escuta');
  }
});

test('INV-SMART-02: conteúdos de podcast ou sem formato de música individual são rejeitados', async () => {
  const candidates = [
    { artist: 'Podcast Falado', title: 'Episódio 10', searchQuery: 'Podcast Falado' },
    { artist: 'Queen', title: 'Radio Ga Ga', searchQuery: 'Queen Radio Ga Ga' }
  ];

  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('Podcast')) {
      // Deezer returning empty for song or malformed
      return new Response(JSON.stringify({ data: [], total: 0 }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      data: [{
        id: 333,
        title: 'Radio Ga Ga',
        artist: { name: 'Queen' },
        album: { title: 'The Works' },
        duration: 345,
        preview: 'https://cdns-preview-d.dzcdn.net/stream/queen.mp3'
      }],
      total: 1
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const tracks = await resolveAndValidateCandidates(candidates, 2, 'Queen', fakeFetch);
  assert.ok(tracks.every((t) => !t.title.includes('Episódio') && !t.id.includes('pod-')), 'podcasts não devem entrar');
  assert.ok(tracks.some((t) => t.artist === 'Queen'));
});

test('INV-SMART-03: respeita teto de faixas e impõe limite de no máximo 2 faixas por artista para garantir diversidade', async () => {
  const candidates = [
    { artist: 'Beatles', title: 'Song 1', searchQuery: 'Beatles Song 1' },
    { artist: 'Beatles', title: 'Song 2', searchQuery: 'Beatles Song 2' },
    { artist: 'Beatles', title: 'Song 3', searchQuery: 'Beatles Song 3' }, // Should be dropped (exceeds 2)
    { artist: 'Pink Floyd', title: 'Song 4', searchQuery: 'Pink Floyd Song 4' }
  ];

  let idCounter = 1000;
  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    const artist = url.includes('Beatles') ? 'The Beatles' : 'Pink Floyd';
    const title = url.includes('Song 1') ? 'Song 1' : url.includes('Song 2') ? 'Song 2' : url.includes('Song 3') ? 'Song 3' : 'Song 4';
    idCounter += 1;
    return new Response(JSON.stringify({
      data: [{
        id: idCounter,
        title,
        artist: { name: artist },
        album: { title: 'Classic Album' },
        duration: 200,
        preview: 'https://cdns-preview-d.dzcdn.net/stream/track.mp3'
      }],
      total: 1
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const tracks = await resolveAndValidateCandidates(candidates, 5, 'rock clássico', fakeFetch);
  const beatlesTracks = tracks.filter((t) => t.artist.toLowerCase().includes('beatles'));
  assert.ok(beatlesTracks.length <= 2, `Máximo 2 faixas do mesmo artista, encontrou ${beatlesTracks.length}`);
});

test('INV-SMART-04: o motor de validação de conformidade checa critérios e atesta aprovação', () => {
  const tracks = [
    mockTrack('1', 'Musica 1', 'Artista A'),
    mockTrack('2', 'Musica 2', 'Artista B'),
    mockTrack('3', 'Musica 3', 'Artista C'),
    mockTrack('4', 'Musica 4', 'Artista D'),
    mockTrack('5', 'Musica 5', 'Artista E')
  ];

  const validation = buildValidationReport('Rock suave anos 80', 5, tracks, ['Anos 80', 'Rock suave']);
  assert.equal(validation.passed, true);
  assert.equal(validation.deliveredCount, 5);
  assert.ok(validation.confidenceScore > 70);
  assert.ok(validation.criteriaMet.length >= 3);
  assert.ok(validation.excludedTypes.includes('podcast'));
  assert.ok(validation.excludedTypes.includes('curated_playlist'));
});

test('INV-SMART-05: o endpoint responde formato compatível com UserDataSnapshot e valida entrada', async () => {
  // Invalid empty request
  const emptyRes = await smartPlaylistEndpoint({});
  assert.equal(emptyRes.status, 400);

  // Very long request
  const longRes = await smartPlaylistEndpoint({ prompt: 'a'.repeat(301) });
  assert.equal(longRes.status, 400);

  // Valid curation call with fake fetch
  const fakeFetch: typeof fetch = async () => {
    return new Response(JSON.stringify({
      data: [{
        id: 777,
        title: 'Música de Teste',
        artist: { name: 'Artista de Teste' },
        album: { title: 'Album X' },
        duration: 180,
        preview: 'https://cdns-preview-d.dzcdn.net/stream/test777.mp3'
      }],
      total: 1
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const okRes = await smartPlaylistEndpoint({ prompt: 'MPB clássica anos 70', targetCount: 10 }, { fetchImpl: fakeFetch });
  assert.equal(okRes.status, 200);
  if ('tracks' in okRes.body) {
    assert.ok(Array.isArray(okRes.body.tracks));
    assert.ok(typeof okRes.body.title === 'string');
    assert.ok(typeof okRes.body.description === 'string');
    assert.ok(okRes.body.validation.passed !== undefined);
  }
});
