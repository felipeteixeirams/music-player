import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapDeezerPage, mapDeezerTrack, mapDeezerTracks } from './_deezer';

const valid = {
  id: 66609426,
  title: 'Get Lucky (Radio Edit)',
  title_short: 'Get Lucky',
  duration: 248,
  preview: 'https://cdn.example/p.mp3',
  artist: { name: 'Daft Punk' },
  album: { title: 'Random Access Memories', cover_big: 'https://img.example/big.jpg' }
};

test('mapDeezerTrack maps a complete item with the provider duration and preview', () => {
  const track = mapDeezerTrack(valid, 'Pop');
  assert.deepEqual(track, {
    id: 'deezer-66609426',
    title: 'Get Lucky',
    artist: 'Daft Punk',
    album: 'Random Access Memories',
    duration: 248,
    coverUrl: 'https://img.example/big.jpg',
    style: 'Pop',
    categoryId: 'web',
    sources: { localUrl: '', previewUrl: 'https://cdn.example/p.mp3' }
  });
});

test('mapDeezerTrack omits previewUrl instead of using an empty string', () => {
  for (const preview of ['', '   ', null, undefined, 42, 'not a url', 'javascript:alert(1)']) {
    const track = mapDeezerTrack({ ...valid, preview });
    assert.ok(track, `item with preview ${String(preview)} should still map`);
    assert.equal('previewUrl' in track.sources, false);
  }
});

test('mapDeezerTrack rejects malformed items without throwing', () => {
  const invalid: unknown[] = [
    null,
    'text',
    [],
    {},
    { ...valid, id: 'abc' },
    { ...valid, id: undefined },
    { ...valid, title: '', title_short: '' },
    { ...valid, artist: {} },
    { ...valid, duration: 0 },
    { ...valid, duration: -3 },
    { ...valid, duration: Number.NaN },
    { ...valid, duration: '248' }
  ];
  for (const input of invalid) assert.equal(mapDeezerTrack(input), null);
});

test('mapDeezerTrack applies consistent fallbacks for optional fields', () => {
  const track = mapDeezerTrack({ ...valid, title_short: undefined, album: undefined });
  assert.ok(track);
  assert.equal(track.title, 'Get Lucky (Radio Edit)');
  assert.equal(track.album, 'Single');
  assert.match(track.coverUrl, /^https:\/\//);
});

test('mapDeezerTracks skips invalid and duplicate items and keeps tracks without preview', () => {
  const payload = {
    data: [null, { id: 1 }, { ...valid, id: 5 }, { ...valid, id: 5 }, { ...valid, id: 6, preview: '' }, { ...valid, id: 7 }]
  };
  const tracks = mapDeezerTracks(payload);
  assert.deepEqual(tracks.map((t) => t.id), ['deezer-5', 'deezer-6', 'deezer-7']);
  assert.equal('previewUrl' in tracks[1].sources, false);
});

test('mapDeezerTracks returns an empty list for payloads without a data array', () => {
  for (const payload of [null, {}, { data: 'x' }, { data: {} }, 'text']) {
    assert.deepEqual(mapDeezerTracks(payload), []);
  }
});

test('mapDeezerPage points the next page at the items Deezer returned, not at the ones that mapped', () => {
  // 5 raw items, 2 of them unusable: the next page must still start at index 20 + 5
  const payload = { total: 100, data: [null, { id: 1 }, { ...valid, id: 5 }, { ...valid, id: 5 }, { ...valid, id: 7 }] };
  const page = mapDeezerPage(payload, { index: 20 });
  assert.deepEqual(page.tracks.map((t) => t.id), ['deezer-5', 'deezer-7']);
  assert.equal(page.total, 100);
  assert.equal(page.nextIndex, 25);
});

test('mapDeezerPage ends the list on the last page, on an empty page and when the total is missing', () => {
  assert.equal(mapDeezerPage({ total: 25, data: [{ ...valid, id: 1 }, { ...valid, id: 2 }] }, { index: 23 }).nextIndex, null);
  assert.equal(mapDeezerPage({ total: 100, data: [] }, { index: 40 }).nextIndex, null);
  const unknownTotal = mapDeezerPage({ data: [{ ...valid, id: 1 }] }, { index: 10 });
  assert.equal(unknownTotal.total, 11);
  assert.equal(unknownTotal.nextIndex, null);
  for (const bad of [null, 'x', {}, { data: 'x' }, { total: 'many', data: [] }]) {
    assert.deepEqual(mapDeezerPage(bad), { tracks: [], total: 0, nextIndex: null });
  }
});
