import { CATEGORY_IDS } from '../../api/_categories';
import { searchEndpoint } from '../../api/_endpoints';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import categoryHandler from '../../api/category';
import radioHandler from '../../api/radio';
import feedHandler from '../../api/feed';
import searchHandler from '../../api/search';
import resolveHandler from '../../api/resolve';

interface RecordedResponse extends VercelResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createResponse(): RecordedResponse {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    }
  };

  return response as unknown as RecordedResponse;
}

function setFetchMock(
  responder: (url: string, init?: RequestInit) => Promise<Response>
) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    return responder(url, init);
  }) as typeof fetch;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function deezerItem(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Song ${id}`,
    title_short: `Song ${id}`,
    duration: 248,
    preview: `https://cdn.example/preview-${id}.mp3`,
    artist: { name: 'Integration Artist' },
    album: { title: 'Integration Album', cover_big: 'https://img.example/cover.jpg' },
    ...overrides
  };
}

const page = (items: unknown[], total = items.length) => ({ total, data: items });

test('search endpoint maps Deezer results into a page of playable tracks', async () => {
  let requestedUrl = '';
  setFetchMock(async (url) => {
    requestedUrl = url;
    return jsonResponse(page([deezerItem(1), deezerItem(2)], 60));
  });

  const response = createResponse();
  await searchHandler(
    { query: { q: 'Metallica One' } } as unknown as VercelRequest,
    response
  );

  const body = response.body as { tracks: Array<Record<string, any>>; source: string; total: number; nextIndex: number | null };
  assert.equal(response.statusCode, 200);
  assert.match(requestedUrl, /^https:\/\/api\.deezer\.com\/search\?q=Metallica%20One&index=0&limit=20$/);
  assert.equal(body.source, 'deezer');
  assert.equal(body.total, 60);
  assert.equal(body.nextIndex, 2);
  assert.equal(body.tracks.length, 2);
  assert.equal(body.tracks[0].id, 'deezer-1');
  assert.equal(body.tracks[0].artist, 'Integration Artist');
  assert.equal(body.tracks[0].duration, 248);
  assert.equal(body.tracks[0].sources.previewUrl, 'https://cdn.example/preview-1.mp3');
  assert.match(response.headers['Cache-Control'], /s-maxage=/);
});

test('search endpoint forwards the page the client asked for', async () => {
  let requestedUrl = '';
  setFetchMock(async (url) => {
    requestedUrl = url;
    return jsonResponse(page([deezerItem(41)], 41));
  });

  const response = createResponse();
  await searchHandler({ query: { q: 'rock', index: '40', limit: '10' } } as unknown as VercelRequest, response);

  assert.match(requestedUrl, /q=rock&index=40&limit=10$/);
  assert.equal((response.body as { nextIndex: number | null }).nextIndex, null);
});

test('search endpoint rejects a blank query without calling Deezer', async () => {
  setFetchMock(async () => {
    throw new Error('Deezer must not be called');
  });

  const response = createResponse();
  await searchHandler({ query: { q: '  ' } } as unknown as VercelRequest, response);
  assert.equal(response.statusCode, 400);
});

test('search endpoint answers 502 without cache headers when every catalog fails', async () => {
  setFetchMock(async () => jsonResponse({ error: 'unavailable' }, 503));

  const response = createResponse();
  await searchHandler({ query: { q: 'anything' } } as unknown as VercelRequest, response);

  assert.equal(response.statusCode, 502);
  assert.ok((response.body as { error: string }).error);
  assert.equal(response.headers['Cache-Control'], undefined);
});

test('category endpoint pages through the playlist behind the category and keeps tracks without preview', async () => {
  let requestedUrl = '';
  setFetchMock(async (url) => {
    requestedUrl = url;
    return jsonResponse(page([deezerItem(10, { preview: '' }), deezerItem(11)], 100));
  });

  const response = createResponse();
  await categoryHandler({ query: { id: 'classic-rock', index: '20', limit: '2' } } as unknown as VercelRequest, response);

  const body = response.body as { tracks: Array<Record<string, any>>; total: number; nextIndex: number | null };
  assert.equal(response.statusCode, 200);
  assert.equal(requestedUrl, 'https://api.deezer.com/playlist/1306931615/tracks?index=20&limit=2');
  assert.deepEqual(body.tracks.map((t) => t.id), ['deezer-10', 'deezer-11']);
  assert.equal(body.tracks[0].style, 'Classic Rock');
  assert.equal('previewUrl' in body.tracks[0].sources, false);
  assert.equal(body.total, 100);
  assert.equal(body.nextIndex, 22);
  assert.match(response.headers['Cache-Control'], /s-maxage=/);
});

test('category endpoint clamps the page size and rejects unknown categories without calling Deezer', async () => {
  const requested: string[] = [];
  setFetchMock(async (url) => {
    requested.push(url);
    return jsonResponse(page([deezerItem(1)]));
  });

  const big = createResponse();
  await categoryHandler({ query: { id: 'synthwave', limit: '5000' } } as unknown as VercelRequest, big);
  assert.match(requested[0], /playlist\/5896949744\/tracks\?index=0&limit=50$/);

  requested.length = 0;
  for (const id of [undefined, 'nope', '__proto__', 'constructor']) {
    const response = createResponse();
    await categoryHandler({ query: { id } } as unknown as VercelRequest, response);
    assert.equal(response.statusCode, 400);
  }
  assert.equal(requested.length, 0);
});

test('category endpoint answers 502 without cache headers when Deezer fails', async () => {
  setFetchMock(async () => jsonResponse({}, 500));

  const response = createResponse();
  await categoryHandler({ query: { id: 'lofi-chill' } } as unknown as VercelRequest, response);

  assert.equal(response.statusCode, 502);
  assert.equal(response.headers['Cache-Control'], undefined);
});

test('feed endpoint returns the first page of every category and a featured track from the top list', async () => {
  const requested: string[] = [];
  setFetchMock(async (url) => {
    requested.push(url);
    const first = 1000 + requested.length * 10;
    return jsonResponse(page([deezerItem(first), deezerItem(first + 1)], 100));
  });

  const response = createResponse();
  await feedHandler({ query: {} } as unknown as VercelRequest, response);

  const body = response.body as { categories: Record<string, { tracks: any[]; total: number; nextIndex: number | null }>; featured: any };
  assert.equal(response.statusCode, 200);
  assert.deepEqual(Object.keys(body.categories).sort(), [...CATEGORY_IDS].sort());
  assert.equal(requested.length, CATEGORY_IDS.length);
  assert.ok(requested.every((url) => /\/playlist\/\d+\/tracks\?index=0&limit=15$/.test(url)), requested.join('\n'));
  for (const category of Object.values(body.categories)) {
    assert.equal(category.tracks.length, 2);
    assert.equal(category.total, 100);
    assert.equal(category.nextIndex, 2);
  }
  assert.equal(body.featured.id, body.categories['top-hits'].tracks[0].id);
  assert.match(response.headers['Cache-Control'], /s-maxage=/);
});

test('feed endpoint logs the category that failed and a summary line, and keeps the others', async () => {
  const warnings: string[] = [];
  const logs: string[] = [];
  const originalWarn = console.warn;
  const originalLog = console.log;
  console.warn = (...args: unknown[]) => void warnings.push(args.join(' '));
  console.log = (...args: unknown[]) => void logs.push(args.join(' '));
  const response = createResponse();
  try {
    setFetchMock(async (url) =>
      url.includes('/playlist/1306931615/') ? jsonResponse({}, 500) : jsonResponse(page([deezerItem(30)], 50))
    );
    await feedHandler({ query: {} } as unknown as VercelRequest, response);
  } finally {
    console.warn = originalWarn;
    console.log = originalLog;
  }

  const body = response.body as { categories: Record<string, { tracks: unknown[] }>; featured: { id: string } };
  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.categories['classic-rock'].tracks, []);
  assert.equal(body.categories['synthwave'].tracks.length, 1);
  assert.equal(body.featured.id, 'deezer-30');
  assert.ok(warnings.some((line) => line.includes('Categoria "classic-rock" falhou')), warnings.join('\n'));
  assert.ok(logs.some((line) => /\[Feed\] .*classic-rock=0 .*synthwave=1 em \d+ms/.test(line)), logs.join('\n'));
});

test('feed endpoint answers 502 without cache headers when every category fails', async () => {
  setFetchMock(async () => jsonResponse({}, 503));

  const response = createResponse();
  await feedHandler({ query: {} } as unknown as VercelRequest, response);

  assert.equal(response.statusCode, 502);
  assert.equal(response.headers['Cache-Control'], undefined);
});

test('radio endpoint lists the curated stations by genre with their covers, and lets the CDN cache it', async () => {
  setFetchMock(async (url) => {
    assert.equal(url, 'https://api.deezer.com/radio/genres');
    return jsonResponse({
      data: [{ id: 152, radios: [{ id: 37765, picture_medium: 'https://cdn.example/rock.jpg' }, { id: 1, picture_medium: 'https://cdn.example/x.jpg' }] }]
    });
  });

  const response = createResponse();
  await radioHandler({ query: {} } as unknown as VercelRequest, response);

  const body = response.body as { genres: Array<{ id: string; stations: Array<{ id: number; name: string; picture: string | null }> }> };
  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.genres.map((g) => g.id), ['rock']);
  assert.deepEqual(body.genres[0].stations, [{ id: 37765, name: 'Rock Clássico', picture: 'https://cdn.example/rock.jpg' }]);
  assert.match(response.headers['Cache-Control'], /s-maxage=/);
});

test('radio endpoint answers 502 without cache headers when Deezer fails or lists none of our stations', async () => {
  for (const respond of [() => jsonResponse({}, 503), () => jsonResponse({ data: [] })]) {
    setFetchMock(async () => respond());
    const response = createResponse();
    await radioHandler({ query: {} } as unknown as VercelRequest, response);
    assert.equal(response.statusCode, 502);
    assert.equal(response.headers['Cache-Control'], undefined);
  }
});

test('radio endpoint returns a fresh batch of a station and never lets it be cached', async () => {
  let requestedUrl = '';
  setFetchMock(async (url) => {
    requestedUrl = url;
    return jsonResponse({ data: [deezerItem(1), deezerItem(2)] });
  });

  const response = createResponse();
  await radioHandler({ query: { id: '37765' } } as unknown as VercelRequest, response);

  const body = response.body as { tracks: Array<Record<string, any>>; nextIndex: number | null };
  assert.equal(response.statusCode, 200);
  assert.equal(requestedUrl, 'https://api.deezer.com/radio/37765/tracks?limit=40');
  assert.deepEqual(body.tracks.map((t) => t.id), ['deezer-1', 'deezer-2']);
  assert.equal(body.tracks[0].style, 'Rock Clássico');
  assert.equal(body.nextIndex, null);
  assert.equal(response.headers['Cache-Control'], undefined);
});

test('radio endpoint rejects stations that are not ours without calling Deezer', async () => {
  const requested: string[] = [];
  setFetchMock(async (url) => {
    requested.push(url);
    return jsonResponse({ data: [] });
  });

  for (const id of ['abc', '1', '37765x', '', '99999999999']) {
    const response = createResponse();
    await radioHandler({ query: { id } } as unknown as VercelRequest, response);
    assert.equal(response.statusCode, 400, id);
  }
  assert.equal(requested.length, 0);
});

test('radio endpoint answers 502 when a station fails', async () => {
  setFetchMock(async () => jsonResponse({}, 500));
  const response = createResponse();
  await radioHandler({ query: { id: '37765' } } as unknown as VercelRequest, response);
  assert.equal(response.statusCode, 502);
  assert.equal(response.headers['Cache-Control'], undefined);
});

test('resolve endpoint returns the video ids found for a catalog track', async () => {
  setFetchMock(async (url) =>
    url.includes('/oembed') ? jsonResponse({}) : jsonResponse({
      contents: [{
        videoRenderer: {
          videoId: 'WM8bTdBs-cw',
          title: { runs: [{ text: 'Metallica: One (Official Audio)' }] },
          ownerText: { runs: [{ text: 'Metallica' }] },
          lengthText: { simpleText: '7:27' }
        }
      }]
    })
  );

  const response = createResponse();
  await resolveHandler(
    { query: { artist: 'Metallica', title: 'One', duration: '447' } } as unknown as VercelRequest,
    response
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { videoIds: ['WM8bTdBs-cw'] });
  assert.equal(response.headers['Cache-Control'], 'private, no-store', 'the answer depends on the user (quota): never shared');
});

test('resolve endpoint validates its parameters without calling YouTube', async () => {
  setFetchMock(async () => {
    throw new Error('YouTube must not be called');
  });

  for (const query of [{}, { artist: 'Metallica', title: 'One' }, { artist: 'Metallica', title: 'One', duration: '-5' }, { artist: 'Metallica', title: 'One', duration: '99999' }]) {
    const response = createResponse();
    await resolveHandler({ query } as unknown as VercelRequest, response);
    assert.equal(response.statusCode, 400);
  }
});

test('resolve endpoint answers an empty list when YouTube fails', async () => {
  setFetchMock(async () => jsonResponse({}, 429));

  const response = createResponse();
  await resolveHandler(
    { query: { artist: 'Metallica', title: 'One', duration: '447' } } as unknown as VercelRequest,
    response
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { videoIds: [] });
  assert.equal(response.headers['Cache-Control'], undefined, 'a failure is never cached');
});

test('resolve endpoint answers "no video found" as a normal answer (the shared cache, not the CDN, remembers it)', async () => {
  setFetchMock(async () => jsonResponse({ contents: [] }));

  const response = createResponse();
  await resolveHandler(
    { query: { artist: 'Artista Sem Vídeo', title: 'Faixa', duration: '200' } } as unknown as VercelRequest,
    response
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { videoIds: [] });
  assert.equal(response.headers['Cache-Control'], 'private, no-store');
});

test('INV-UI-06: /api/search?artists lista artistas e /api/search?artist traz o artista com as mais tocadas', async () => {
  const requested: string[] = [];
  setFetchMock(async (url) => {
    requested.push(url);
    if (url.includes('/search/artist')) return jsonResponse({ data: [{ id: 1783, name: 'Creed', picture_big: 'https://cdn.example/creed.jpg', nb_fan: 1537601 }, { id: 'x', name: '' }] });
    if (/\/artist\/1783\/top/.test(url)) return jsonResponse(page([deezerItem(5), deezerItem(6)], 20));
    return jsonResponse({ id: 1783, name: 'Creed', picture_big: 'https://cdn.example/creed.jpg', nb_fan: 1537601 });
  });

  const list = await searchEndpoint({ artists: 'creed' });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body, { artists: [{ id: '1783', name: 'Creed', pictureUrl: 'https://cdn.example/creed.jpg', fans: 1537601 }] });
  assert.match(list.cacheControl ?? '', /s-maxage=/);

  const artist = await searchEndpoint({ artist: '1783', limit: '2' });
  const body = artist.body as { artist: { name: string }; top: { tracks: unknown[]; total: number; nextIndex: number | null } };
  assert.equal(artist.status, 200);
  assert.equal(body.artist.name, 'Creed');
  assert.equal(body.top.tracks.length, 2);
  assert.equal(body.top.nextIndex, 2);

  const before = requested.length;
  assert.equal((await searchEndpoint({ artist: '../x' })).status, 400);
  assert.equal((await searchEndpoint({ artists: ' ' })).status, 400);
  assert.equal(requested.length, before, 'entrada inválida não chega ao Deezer');
});

test('INV-UI-06: /api/search?album traz o álbum com as faixas (com álbum e artista recolocados) e os álbuns do artista vêm sem repetição, do mais novo', async () => {
  setFetchMock(async (url) => {
    if (/\/artist\/1783\/albums/.test(url)) {
      return jsonResponse({
        data: [
          { id: 1, title: 'Antigo', release_date: '1999-05-01', cover_big: 'https://cdn.example/a.jpg' },
          { id: 2, title: 'Novo', release_date: '2009-10-27', cover_big: 'https://cdn.example/n.jpg' },
          { id: 3, title: 'novo', release_date: '2010-01-01' }
        ]
      });
    }
    if (/\/artist\/1783\/top/.test(url)) return jsonResponse(page([deezerItem(5)], 1));
    if (/\/artist\/1783$/.test(url)) return jsonResponse({ id: 1783, name: 'Creed', picture_big: 'https://cdn.example/c.jpg', nb_fan: 10 });
    if (/\/album\/2$/.test(url)) {
      const { artist: _artist, album: _album, ...bare } = deezerItem(9) as Record<string, unknown>;
      return jsonResponse({ id: 2, title: 'Novo', release_date: '2009-10-27', cover_big: 'https://cdn.example/n.jpg', artist: { name: 'Creed' }, tracks: { data: [bare] } });
    }
    throw new Error(`url inesperada ${url}`);
  });

  const artist = (await searchEndpoint({ artist: '1783' })).body as { albums: { title: string; year: number }[] };
  assert.deepEqual(artist.albums.map((a) => [a.title, a.year]), [['Novo', 2009], ['Antigo', 1999]]);

  const album = await searchEndpoint({ album: '2' });
  const body = album.body as { album: { title: string; year: number }; tracks: { tracks: { artist: string; album: string; coverUrl: string }[] } };
  assert.equal(album.status, 200);
  assert.equal(body.album.year, 2009);
  assert.equal(body.tracks.tracks.length, 1);
  assert.equal(body.tracks.tracks[0].artist, 'Creed');
  assert.equal(body.tracks.tracks[0].album, 'Novo');
  assert.equal((await searchEndpoint({ album: 'abc' })).status, 400);
});
