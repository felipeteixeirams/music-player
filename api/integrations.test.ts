import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import feedHandler from './feed';
import searchHandler from './search';
import resolveHandler from './resolve';
import streamHandler from './streams/[id]';
import { fetchPipedAudioStream } from '../src/utils/audioEngine';

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

test('search endpoint maps Deezer results into playable preview tracks', async () => {
  let requestedUrl = '';
  setFetchMock(async (url) => {
    requestedUrl = url;
    return jsonResponse({ data: [deezerItem(1), deezerItem(2)] });
  });

  const response = createResponse();
  await searchHandler(
    { query: { q: 'Metallica One' } } as unknown as VercelRequest,
    response
  );

  const body = response.body as { tracks: Array<Record<string, any>>; source: string };
  assert.equal(response.statusCode, 200);
  assert.match(requestedUrl, /^https:\/\/api\.deezer\.com\/search\?q=Metallica%20One/);
  assert.equal(body.source, 'deezer');
  assert.equal(body.tracks.length, 2);
  assert.equal(body.tracks[0].id, 'deezer-1');
  assert.equal(body.tracks[0].artist, 'Integration Artist');
  assert.equal(body.tracks[0].duration, 248);
  assert.equal(body.tracks[0].sources.previewUrl, 'https://cdn.example/preview-1.mp3');
  assert.match(response.headers['Cache-Control'], /s-maxage=/);
});

test('search endpoint rejects a blank query without calling Deezer', async () => {
  setFetchMock(async () => {
    throw new Error('Deezer must not be called');
  });

  const response = createResponse();
  await searchHandler({ query: { q: '  ' } } as unknown as VercelRequest, response);
  assert.equal(response.statusCode, 400);
});

test('search endpoint returns an empty valid payload when Deezer fails', async () => {
  setFetchMock(async () => jsonResponse({ error: 'unavailable' }, 503));

  const response = createResponse();
  await searchHandler({ query: { q: 'anything' } } as unknown as VercelRequest, response);

  const body = response.body as { tracks: unknown[]; source: string };
  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.tracks, []);
  assert.equal(body.source, 'deezer');
});

test('feed endpoint returns the expected categories and a playable featured track', async () => {
  const requested: string[] = [];
  setFetchMock(async (url) => {
    requested.push(url);
    return jsonResponse({
      data: [deezerItem(10, { preview: '' }), deezerItem(11)]
    });
  });

  const response = createResponse();
  await feedHandler({ query: {} } as unknown as VercelRequest, response);

  const body = response.body as Record<string, any>;
  assert.equal(response.statusCode, 200);
  assert.equal(requested.length, 4);
  assert.ok(requested.some((url) => url.includes('/chart/0/tracks')));
  assert.ok(requested.some((url) => url.includes('/chart/152/tracks')));
  for (const key of ['trending', 'rock', 'pop', 'lofi']) {
    assert.equal(body[key].length, 1, `${key} should drop tracks without preview`);
  }
  assert.equal(body.featured.id, 'deezer-11');
  assert.match(response.headers['Cache-Control'], /s-maxage=/);
});

test('feed endpoint keeps working when one Deezer category fails', async () => {
  setFetchMock(async (url) =>
    url.includes('/chart/152/') ? jsonResponse({}, 500) : jsonResponse({ data: [deezerItem(20)] })
  );

  const response = createResponse();
  await feedHandler({ query: {} } as unknown as VercelRequest, response);

  const body = response.body as Record<string, any>;
  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.rock, []);
  assert.equal(body.pop.length, 1);
  assert.equal(body.featured.id, 'deezer-20');
});

test('stream endpoint selects the highest bitrate Piped audio stream', async () => {
  setFetchMock(async (url) => {
    assert.match(url, /\/streams\/dQw4w9WgXcQ$/);
    return jsonResponse({
      audioStreams: [
        { url: 'https://audio.example/low.webm', bitrate: 64000, quality: '64kbps' },
        { url: 'https://audio.example/high.m4a', bitrate: 160000, quality: '160kbps' }
      ]
    });
  });

  const response = createResponse();
  await streamHandler(
    { query: { id: 'dQw4w9WgXcQ' } } as unknown as VercelRequest,
    response
  );

  const body = response.body as Record<string, any>;
  assert.equal(response.statusCode, 200);
  assert.equal(body.audioUrl, 'https://audio.example/high.m4a');
  assert.equal(body.quality, '160kbps');
  assert.equal(body.directStreamAvailable, true);
});

test('stream endpoint reports fallback when all Piped instances fail', async () => {
  setFetchMock(async () => jsonResponse({ error: 'unavailable' }, 503));

  const response = createResponse();
  await streamHandler(
    { query: { id: 'dQw4w9WgXcQ' } } as unknown as VercelRequest,
    response
  );

  const body = response.body as Record<string, any>;
  assert.equal(response.statusCode, 200);
  assert.equal(body.directStreamAvailable, false);
  assert.equal(body.audioUrl, null);
  assert.equal(body.youtubeId, 'dQw4w9WgXcQ');
});

test('audio client consumes the stream endpoint contract and its fallback response', async () => {
  let endpointResult: Record<string, unknown> = {
    audioUrl: 'https://audio.example/direct.m4a',
    quality: '128kbps',
    instanceUsed: 'https://piped.example'
  };
  setFetchMock(async (url) => {
    assert.equal(url, '/api/streams/dQw4w9WgXcQ');
    return jsonResponse(endpointResult);
  });

  const resolved = await fetchPipedAudioStream('dQw4w9WgXcQ');
  assert.equal(resolved.audioUrl, 'https://audio.example/direct.m4a');
  assert.equal(resolved.instanceUsed, 'https://piped.example');

  endpointResult = {
    directStreamAvailable: false,
    audioUrl: null,
    youtubeId: 'dQw4w9WgXcQ'
  };
  const fallback = await fetchPipedAudioStream('dQw4w9WgXcQ');
  assert.equal(fallback.audioUrl, null);
  assert.equal(fallback.instanceUsed, 'YouTube Engine');
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
  assert.match(response.headers['Cache-Control'], /s-maxage=/);
});

test('resolve endpoint validates its parameters without calling YouTube', async () => {
  setFetchMock(async () => {
    throw new Error('YouTube must not be called');
  });

  for (const query of [{}, { artist: 'Metallica', title: 'One' }, { artist: 'Metallica', title: 'One', duration: '-5' }]) {
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
});
