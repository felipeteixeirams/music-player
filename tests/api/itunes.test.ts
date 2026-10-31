import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapItunesTrack, mapItunesTracks } from '../../api/_itunes';
import { searchCatalog } from '../../api/_catalog';

const valid = {
  wrapperType: 'track',
  kind: 'song',
  trackId: 617154366,
  trackName: 'Get Lucky',
  artistName: 'Daft Punk, Pharrell Williams & Nile Rodgers',
  collectionName: 'Random Access Memories',
  trackTimeMillis: 369626,
  artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/100x100bb.jpg',
  previewUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a'
};

const deezerItem = (id: number) => ({
  id,
  title: `Song ${id}`,
  duration: 200,
  preview: `https://cdn.example/${id}.mp3`,
  artist: { name: 'Artist' },
  album: { title: 'Album', cover_big: 'https://img.example/c.jpg' }
});

test('mapItunesTrack maps a complete song with seconds, large artwork and preview', () => {
  assert.deepEqual(mapItunesTrack(valid), {
    id: 'itunes-617154366',
    title: 'Get Lucky',
    artist: 'Daft Punk, Pharrell Williams & Nile Rodgers',
    album: 'Random Access Memories',
    duration: 370,
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music/600x600bb.jpg',
    style: 'Apple Music',
    categoryId: 'web',
    sources: { localUrl: '', previewUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a' }
  });
});

test('mapItunesTrack omits previewUrl when absent or not https', () => {
  for (const previewUrl of [undefined, '', 'http://insecure.example/a.m4a', 'nope']) {
    const track = mapItunesTrack({ ...valid, previewUrl });
    assert.ok(track);
    assert.equal('previewUrl' in track.sources, false);
  }
});

test('mapItunesTrack rejects non-songs and malformed items without throwing', () => {
  const invalid: unknown[] = [
    null, 'x', [], {},
    { ...valid, kind: 'podcast' },
    { ...valid, wrapperType: 'artist' },
    { ...valid, trackId: 'abc' },
    { ...valid, trackName: '' },
    { ...valid, artistName: undefined },
    { ...valid, trackTimeMillis: 0 },
    { ...valid, trackTimeMillis: '369626' }
  ];
  for (const input of invalid) assert.equal(mapItunesTrack(input), null);
});

test('mapItunesTracks deduplicates, skips invalid items and respects the limit', () => {
  const payload = { results: [{ resultCount: 2 }, valid, valid, { ...valid, trackId: 2 }, { ...valid, trackId: 3 }] };
  assert.deepEqual(mapItunesTracks(payload).map((t) => t.id), ['itunes-617154366', 'itunes-2', 'itunes-3']);
  assert.equal(mapItunesTracks(payload, { limit: 1 }).length, 1);
  for (const bad of [null, {}, { results: 'x' }]) assert.deepEqual(mapItunesTracks(bad), []);
});

test('searchCatalog answers from Deezer and never calls iTunes when Deezer has tracks', async () => {
  const requested: string[] = [];
  const fetchImpl = (async (url: string) => {
    requested.push(String(url));
    return Response.json({ data: [deezerItem(1)] });
  }) as unknown as typeof fetch;

  const result = await searchCatalog('anything', { fetchImpl });
  assert.equal(result.source, 'deezer');
  assert.equal(result.tracks[0].id, 'deezer-1');
  assert.ok(!requested.some((url) => url.includes('apple.com')), 'never calls iTunes when Deezer has tracks');
  assert.ok(requested.some((u) => /\/search\?q=anything&index=0&limit=20$/.test(u)));
});

test('searchCatalog falls back to iTunes when Deezer fails or finds nothing', async () => {
  for (const deezerResponse of [new Response('', { status: 503 }), Response.json({ data: [] })]) {
    const fetchImpl = (async (url: string) =>
      String(url).includes('deezer.com') ? deezerResponse.clone() : Response.json({ results: [valid] })
    ) as unknown as typeof fetch;

    const result = await searchCatalog('anything', { fetchImpl });
    assert.equal(result.source, 'itunes');
    assert.equal(result.tracks[0].id, 'itunes-617154366');
  }
});

test('searchCatalog rejects only when both catalogs fail', async () => {
  const fetchImpl = (async () => new Response('', { status: 500 })) as unknown as typeof fetch;
  await assert.rejects(searchCatalog('anything', { fetchImpl }), /iTunes HTTP 500/);
});

test('searchCatalog returns an empty result when Deezer is empty and iTunes is down', async () => {
  const fetchImpl = (async (url: string) =>
    String(url).includes('deezer.com') ? Response.json({ data: [] }) : new Response('', { status: 500 })
  ) as unknown as typeof fetch;
  assert.deepEqual(await searchCatalog('anything', { fetchImpl }), { tracks: [], total: 0, nextIndex: null, albums: [], source: 'deezer' });
});

test('searchCatalog asks Deezer for the requested page and never falls back to iTunes past the first page', async () => {
  const requested: string[] = [];
  const fetchImpl = (async (url: string) => {
    requested.push(String(url));
    return Response.json({ total: 90, data: [deezerItem(41), deezerItem(42)] });
  }) as unknown as typeof fetch;
  const page = await searchCatalog('rock', { index: 40, limit: 2, fetchImpl });
  assert.match(requested[0], /index=40&limit=2/);
  assert.equal(page.nextIndex, 42);
  assert.equal(page.total, 90);

  const emptyPage = (async () => Response.json({ total: 90, data: [] })) as unknown as typeof fetch;
  const empty = await searchCatalog('rock', { index: 80, fetchImpl: emptyPage });
  assert.deepEqual(empty.tracks, []);
  assert.equal(empty.source, 'deezer');

  const down = (async () => new Response('', { status: 503 })) as unknown as typeof fetch;
  await assert.rejects(searchCatalog('rock', { index: 40, fetchImpl: down }), /Deezer HTTP 503/);
});
