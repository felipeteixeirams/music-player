import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import feedHandler from './feed';
import searchHandler from './search';
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

function youtubeMusicSearchPayload(videoId = 'dQw4w9WgXcQ') {
  const column = (text: string) => ({
    musicResponsiveListItemFlexColumnRenderer: {
      text: { runs: [{ text }] }
    }
  });

  return {
    contents: {
      tabbedSearchResultsRenderer: {
        tabs: [{
          tabRenderer: {
            content: {
              sectionListRenderer: {
                contents: [{
                  musicShelfRenderer: {
                    contents: [{
                      musicResponsiveListItemRenderer: {
                        videoId,
                        flexColumns: [
                          column('Integration Song'),
                          column('Integration Artist'),
                          column('Integration Album')
                        ],
                        thumbnail: {
                          musicThumbnailRenderer: {
                            thumbnail: {
                              thumbnails: [{ url: 'https://img.example/cover.jpg' }]
                            }
                          }
                        }
                      }
                    }]
                  }
                }]
              }
            }
          }
        }]
      }
    }
  };
}

function pipedSearchPayload(videoId = 'M7lc1UVf-VE') {
  return {
    items: [{
      url: `/watch?v=${videoId}`,
      title: 'Piped Integration Song',
      uploaderName: 'Piped Artist',
      duration: 197,
      thumbnail: 'https://img.example/piped-cover.jpg'
    }]
  };
}

test('search endpoint maps YouTube Music results into playable tracks', async () => {
  let pipedRequests = 0;
  setFetchMock(async (url) => {
    if (url.startsWith('https://music.youtube.com/')) {
      return jsonResponse(youtubeMusicSearchPayload());
    }
    pipedRequests += 1;
    return jsonResponse(pipedSearchPayload());
  });

  const response = createResponse();
  await searchHandler(
    { query: { q: 'Integration Song' } } as unknown as VercelRequest,
    response
  );

  const body = response.body as { tracks: Array<Record<string, any>>; source: string };
  assert.equal(response.statusCode, 200);
  assert.equal(body.source, 'YouTube Music InnerTube');
  assert.equal(body.tracks.length, 1);
  assert.equal(body.tracks[0].title, 'Integration Song');
  assert.equal(body.tracks[0].artist, 'Integration Artist');
  assert.equal(body.tracks[0].sources.youtubeId, 'dQw4w9WgXcQ');
  assert.equal(pipedRequests, 0);
});

test('search endpoint falls back to Piped and returns normalized video IDs', async () => {
  setFetchMock(async (url) => {
    if (url.startsWith('https://music.youtube.com/')) {
      return jsonResponse({ error: 'unavailable' }, 503);
    }
    if (url.includes('/search?')) return jsonResponse(pipedSearchPayload());
    throw new Error(`Unexpected integration request: ${url}`);
  });

  const response = createResponse();
  await searchHandler(
    { query: { q: 'Piped Integration Song' } } as unknown as VercelRequest,
    response
  );

  const body = response.body as { tracks: Array<Record<string, any>>; source: string };
  assert.equal(response.statusCode, 200);
  assert.match(body.source, /^https:\/\//);
  assert.equal(body.tracks.length, 1);
  assert.equal(body.tracks[0].id, 'piped-M7lc1UVf-VE');
  assert.equal(body.tracks[0].sources.youtubeId, 'M7lc1UVf-VE');
  assert.equal(body.tracks[0].duration, 197);
});

test('feed endpoint returns the expected categories and a playable featured track', async () => {
  let searchRequests = 0;
  setFetchMock(async (url) => {
    if (!url.startsWith('https://music.youtube.com/')) {
      throw new Error(`Unexpected integration request: ${url}`);
    }
    searchRequests += 1;
    return jsonResponse(youtubeMusicSearchPayload());
  });

  const response = createResponse();
  await feedHandler({ query: {} } as unknown as VercelRequest, response);

  const body = response.body as Record<string, any>;
  assert.equal(response.statusCode, 200);
  assert.equal(searchRequests, 4);
  assert.equal(body.trending.length, 1);
  assert.equal(body.rock.length, 1);
  assert.equal(body.pop.length, 1);
  assert.equal(body.lofi.length, 1);
  assert.equal(body.featured.sources.youtubeId, 'dQw4w9WgXcQ');
  assert.match(response.headers['Cache-Control'], /s-maxage=/);
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