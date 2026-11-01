import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchItunesAlbumPage, mapItunesAlbum, mapItunesTrack, mapItunesTracks, searchItunesAlbums } from '../../api/_itunes';
import { mapDeezerPlaylist, searchDeezerPlaylists } from '../../api/_deezer';
import { mergeAlbumResults, relevantToQuery, searchCatalog } from '../../api/_catalog';
import { searchEndpoint } from '../../api/_endpoints';

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
  assert.ok(!requested.some((url) => url.includes('apple.com') && url.includes('entity=song')), 'never searches iTunes tracks when Deezer has tracks');
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

const itunesAlbum = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  wrapperType: 'collection',
  collectionType: 'Album',
  collectionId: id,
  collectionName: name,
  artistName: 'Vários Artistas',
  artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/100x100bb.jpg',
  releaseDate: '2020-01-31T08:00:00Z',
  trackCount: 14,
  ...extra
});

test('INV-CAT-01: o álbum oficial que só o iTunes tem entra na busca, na frente de singles de nome parecido', async () => {
  const fetchImpl = (async (url: string) => {
    const text = String(url);
    if (text.includes('itunes.apple.com/search')) {
      assert.match(text, /entity=album/);
      assert.match(text, /country=BR/);
      return Response.json({ results: [itunesAlbum(1495409741, 'Summer Eletrohits 2020'), itunesAlbum(2, 'Summer Eletrohits - Single')] });
    }
    if (text.includes('/search/album')) return Response.json({ data: [{ id: 9, title: 'Summer Eletrohits', artist: { name: 'DJ Qualquer' }, release_date: '2021-01-01' }] });
    if (text.includes('/search/playlist')) return Response.json({ data: [] });
    return Response.json({ data: [deezerItem(1)] });
  }) as unknown as typeof fetch;

  const result = await searchCatalog('Summer Eletrohits', { fetchImpl });
  const titles = (result.albums ?? []).map((album) => album.title);
  assert.deepEqual(titles, ['Summer Eletrohits 2020', 'Summer Eletrohits'], 'o single do iTunes sai; o oficial vem primeiro');
  assert.equal(result.albums?.[0].id, 'it-1495409741');
});

test('INV-CAT-01: playlists do Deezer entram com o criador e a contagem, sem as muito curtas', async () => {
  const fetchImpl = (async (url: string) =>
    Response.json({
      data: [
        { id: 1, title: 'Classic Metal Som Livre', nb_tracks: 124, user: { name: 'Fulano' }, picture_big: 'https://cdn.example/p.jpg' },
        { id: 2, title: 'Curta', nb_tracks: 3, user: { name: 'Ciclano' } }
      ]
    })
  ) as unknown as typeof fetch;
  const playlists = await searchDeezerPlaylists('classic metal', 6, fetchImpl);
  assert.deepEqual(playlists.map((entry) => [entry.id, entry.kind, entry.artist, entry.trackCount]), [['pl-1', 'playlist', 'Fulano', 124]]);
  assert.equal(mapDeezerPlaylist({ id: 'x', title: 'a' }), null);
});

test('INV-CAT-01: a busca de coleções falha ou demora sem derrubar as faixas', async () => {
  const fetchImpl = (async (url: string) => {
    const text = String(url);
    if (text.includes('apple.com') || text.includes('/search/album') || text.includes('/search/playlist')) throw new Error('fora do ar');
    return Response.json({ data: [deezerItem(1)] });
  }) as unknown as typeof fetch;
  const result = await searchCatalog('anything', { fetchImpl });
  assert.equal(result.tracks[0].id, 'deezer-1');
  assert.deepEqual(result.albums, []);
});

test('INV-CAT-01: mergeAlbumResults tira a repetição entre as fontes e põe as playlists depois dos álbuns', () => {
  const a = { id: '1', title: 'Álbum Teste', artist: 'Quem', coverUrl: 'c', year: 2000 };
  const same = { ...a, id: 'it-5' };
  const pl = { id: 'pl-1', title: 'Lista', artist: 'U', coverUrl: 'c', year: 0, kind: 'playlist' as const };
  assert.deepEqual(mergeAlbumResults('x', [a], [same], [pl]).map((entry) => entry.id), ['1', 'pl-1']);
});

test('INV-CAT-01: a página de um álbum do iTunes (it-) traz as faixas na ordem do álbum', async () => {
  const song = (n: number) => ({ ...valid, trackId: 1000 + n, trackName: `Faixa ${n}`, collectionName: 'Summer Eletrohits 2020' });
  const fetchImpl = (async (url: string) => {
    assert.match(String(url), /lookup\?id=1495409741&entity=song&country=BR/);
    return Response.json({ results: [itunesAlbum(1495409741, 'Summer Eletrohits 2020'), song(1), song(2)] });
  }) as unknown as typeof fetch;
  const page = await fetchItunesAlbumPage('1495409741', fetchImpl);
  assert.equal(page.album.title, 'Summer Eletrohits 2020');
  assert.deepEqual(page.tracks.tracks.map((track) => track.title), ['Faixa 1', 'Faixa 2']);
  assert.equal(mapItunesAlbum({ wrapperType: 'track' }), null);
  assert.deepEqual((await searchItunesAlbums('x', 8, (async () => Response.json({ results: [] })) as unknown as typeof fetch)), []);
});

test('INV-CAT-01: o endpoint de álbum aceita número (Deezer), it- (iTunes) e pl- (playlist), e recusa o resto', async () => {
  for (const bad of ['abc', 'it-', 'pl-x', 'xx-1', '1; drop']) assert.equal((await searchEndpoint({ album: bad })).status, 400, bad);
  const fetchImpl = (async (url: string) => {
    const text = String(url);
    if (text.includes('/playlist/55/tracks')) return Response.json({ data: [deezerItem(7)], total: 1 });
    if (text.includes('/playlist/55')) return Response.json({ id: 55, title: 'Lista', nb_tracks: 30, creator: { name: 'Dono' } });
    return new Response('', { status: 500 });
  }) as unknown as typeof fetch;
  const result = await searchEndpoint({ album: 'pl-55' }, fetchImpl);
  assert.equal(result.status, 200);
  const body = result.body as { album: { kind: string; artist: string }; tracks: { tracks: unknown[] } };
  assert.equal(body.album.kind, 'playlist');
  assert.equal(body.album.artist, 'Dono');
  assert.equal(body.tracks.tracks.length, 1);
});

test('INV-CAT-01: álbum do iTunes sem nenhuma palavra da busca é descartado (resposta frouxa da loja)', () => {
  const album = (title: string, artist = 'X') => ({ id: 'it-1', title, artist, coverUrl: 'c', year: 2020 });
  const kept = relevantToQuery('Classic Metal Som Livre', [album('Guerreiras do K-Pop'), album('Legacy', 'Eagles'), album('Classic Rock Hits'), album('Heavy', 'Som Livre')]);
  assert.deepEqual(kept.map((entry) => entry.title), ['Classic Rock Hits', 'Heavy']);
  assert.equal(relevantToQuery('ab', [album('Qualquer')]).length, 1, 'texto só de palavras curtas não filtra');
});
