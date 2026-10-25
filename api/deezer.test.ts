import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapDeezerTrack, mapDeezerTracks } from './_deezer';

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

test('mapDeezerTracks skips invalid and duplicate items before applying the limit', () => {
  const payload = {
    data: [null, { id: 1 }, { ...valid, id: 5 }, { ...valid, id: 5 }, { ...valid, id: 6, preview: '' }, { ...valid, id: 7 }]
  };
  assert.deepEqual(mapDeezerTracks(payload).map((t) => t.id), ['deezer-5', 'deezer-6', 'deezer-7']);
  assert.deepEqual(
    mapDeezerTracks(payload, { requirePreview: true }).map((t) => t.id),
    ['deezer-5', 'deezer-7']
  );
  assert.deepEqual(mapDeezerTracks(payload, { limit: 1 }).map((t) => t.id), ['deezer-5']);
});

test('mapDeezerTracks returns an empty list for payloads without a data array', () => {
  for (const payload of [null, {}, { data: 'x' }, { data: {} }, 'text']) {
    assert.deepEqual(mapDeezerTracks(payload), []);
  }
});
