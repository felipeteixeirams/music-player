import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import searchHandler from './search';
import streamHandler from './streams/[id]';

interface RecordedResponse extends VercelResponse {
  statusCode: number;
  body: unknown;
}

function createResponse(): RecordedResponse {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader() {
      return this;
    }
  };

  return response as unknown as RecordedResponse;
}

test(
  'live search result resolves to direct audio or an embeddable YouTube fallback',
  { skip: process.env.RUN_LIVE_INTEGRATION_TESTS !== '1', timeout: 30000 },
  async () => {
    const searchResponse = createResponse();
    await searchHandler(
      { query: { q: 'Daft Punk Get Lucky' } } as unknown as VercelRequest,
      searchResponse
    );

    const searchBody = searchResponse.body as {
      tracks?: Array<{ title: string; sources?: { youtubeId?: string } }>;
      source?: string;
    };
    assert.equal(searchResponse.statusCode, 200);
    assert.ok(searchBody.tracks?.length, 'Live providers returned no playable tracks');

    const track = searchBody.tracks[0];
    const youtubeId = track.sources?.youtubeId;
    assert.match(youtubeId || '', /^[A-Za-z0-9_-]{11}$/, 'Search returned an invalid YouTube ID');

    const streamResponse = createResponse();
    await streamHandler(
      { query: { id: youtubeId } } as unknown as VercelRequest,
      streamResponse
    );

    const streamBody = streamResponse.body as {
      directStreamAvailable?: boolean;
      audioUrl?: string | null;
      youtubeId?: string;
    };
    assert.equal(streamResponse.statusCode, 200);

    if (streamBody.directStreamAvailable && streamBody.audioUrl) {
      const audioUrl = new URL(streamBody.audioUrl);
      assert.ok(['http:', 'https:'].includes(audioUrl.protocol));

      const audioResponse = await fetch(audioUrl, {
        headers: { Range: 'bytes=0-0' },
        signal: AbortSignal.timeout(8000)
      });
      await audioResponse.body?.cancel();
      assert.ok(
        audioResponse.ok,
        `Resolved audio URL returned HTTP ${audioResponse.status}`
      );
      console.info(`Live smoke: ${searchBody.source}; áudio direto HTTP ${audioResponse.status}`);
      return;
    }

    assert.equal(streamBody.youtubeId, youtubeId);
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    const embedResponse = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    assert.equal(embedResponse.status, 200, 'YouTube fallback video is not embeddable');
    console.info(`Live smoke: ${searchBody.source}; stream Piped indisponível, fallback incorporável`);
  }
);