import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseClockDuration,
  parseIsoDuration,
  parseOfficialCandidates,
  parseWebSearchCandidates,
  pickBestCandidate,
  rankCandidates,
  resolveYouTubeVideoIds,
  type VideoCandidate
} from './_youtubeSearch';

const query = { artist: 'Metallica', title: 'One', duration: 447 };

const candidate = (overrides: Partial<VideoCandidate>): VideoCandidate => ({
  videoId: 'AAAAAAAAAAA',
  title: 'Metallica - One (Official Audio)',
  channel: 'Metallica',
  durationSeconds: 447,
  ...overrides
});

function webPayload(items: Array<{ id: string; title: string; channel: string; length: string }>) {
  return {
    contents: {
      sections: [{
        itemSectionRenderer: {
          contents: [
            { adSlotRenderer: {} },
            ...items.map((item) => ({
              videoRenderer: {
                videoId: item.id,
                title: { runs: [{ text: item.title }] },
                ownerText: { runs: [{ text: item.channel }] },
                lengthText: { simpleText: item.length }
              }
            }))
          ]
        }
      }]
    }
  };
}

test('duration parsers accept clock and ISO values and reject anything else', () => {
  assert.equal(parseClockDuration('4:08'), 248);
  assert.equal(parseClockDuration('1:02:03'), 3723);
  assert.equal(parseClockDuration('LIVE'), null);
  assert.equal(parseClockDuration(''), null);
  assert.equal(parseIsoDuration('PT4M8S'), 248);
  assert.equal(parseIsoDuration('PT1H2M3S'), 3723);
  assert.equal(parseIsoDuration('PT'), null);
  assert.equal(parseIsoDuration('4:08'), null);
});

test('parseWebSearchCandidates extracts videos and skips malformed entries', () => {
  const payload = webPayload([
    { id: 'WM8bTdBs-cw', title: 'Metallica: One', channel: 'Metallica', length: '7:27' },
    { id: 'bad', title: 'Invalid id', channel: 'x', length: '1:00' }
  ]);
  const candidates = parseWebSearchCandidates(payload);
  assert.deepEqual(candidates, [
    { videoId: 'WM8bTdBs-cw', title: 'Metallica: One', channel: 'Metallica', durationSeconds: 447 }
  ]);
  for (const bad of [null, 'text', 42, [], {}]) assert.deepEqual(parseWebSearchCandidates(bad), []);
});

test('parseOfficialCandidates merges search items with video durations', () => {
  const search = {
    items: [
      { id: { videoId: 'WM8bTdBs-cw' }, snippet: { title: 'One', channelTitle: 'Metallica - Topic' } },
      { id: { videoId: 'pqRDu3ueuA8' }, snippet: { title: 'Other', channelTitle: 'x' } },
      { id: {}, snippet: { title: 'No id' } }
    ]
  };
  const videos = { items: [{ id: 'WM8bTdBs-cw', contentDetails: { duration: 'PT7M27S' } }] };
  const candidates = parseOfficialCandidates(search, videos);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].durationSeconds, 447);
  assert.equal(candidates[1].durationSeconds, null);
  assert.deepEqual(parseOfficialCandidates(null, null), []);
});

test('pickBestCandidate prefers the studio recording over live, cover and wrong-length videos', () => {
  const studio = candidate({ videoId: 'STUDIO00001' });
  const live = candidate({ videoId: 'LIVE0000001', title: 'Metallica - One (Live)', durationSeconds: 448 });
  const cover = candidate({ videoId: 'COVER000001', title: 'One - Metallica cover', channel: 'Someone' });
  const tooShort = candidate({ videoId: 'SHORT000001', durationSeconds: 120 });

  assert.equal(pickBestCandidate([tooShort, cover, live, studio], query)?.videoId, 'STUDIO00001');
  assert.equal(pickBestCandidate([tooShort, cover], query), null);
});

test('pickBestCandidate returns null when nothing is close enough', () => {
  assert.equal(pickBestCandidate([], query), null);
  assert.equal(pickBestCandidate([candidate({ durationSeconds: 90 })], query), null);
  assert.equal(
    pickBestCandidate([candidate({ title: 'Totally unrelated video', channel: 'Other', durationSeconds: null })], query),
    null
  );
});

test('pickBestCandidate tolerates a video without duration when the title matches well', () => {
  const noDuration = candidate({ durationSeconds: null });
  assert.equal(pickBestCandidate([noDuration], query)?.videoId, 'AAAAAAAAAAA');
});

test('resolveYouTubeVideoIds uses the unofficial web search without an API key', async () => {
  const requested: string[] = [];
  const fetchImpl = (async (url: string) => {
    requested.push(String(url));
    if (String(url).includes('/oembed')) return Response.json({});
    return Response.json(webPayload([
      { id: 'LIVE0000001', title: 'Metallica - One (Live)', channel: 'Metallica', length: '7:28' },
      { id: 'WM8bTdBs-cw', title: 'Metallica: One (Official Audio)', channel: 'Metallica', length: '7:27' }
    ]));
  }) as unknown as typeof fetch;

  assert.deepEqual(await resolveYouTubeVideoIds(query, { fetchImpl }), ['WM8bTdBs-cw']);
  assert.equal(requested.length, 2);
  assert.match(requested[0], /^https:\/\/www\.youtube\.com\/youtubei\/v1\/search/);
  assert.match(requested[1], /\/oembed\?url=.*WM8bTdBs-cw/);
});

test('resolveYouTubeVideoIds uses the official API when a key is configured', async () => {
  const requested: string[] = [];
  const fetchImpl = (async (url: string) => {
    requested.push(String(url));
    if (String(url).includes('/oembed')) return Response.json({});
    if (String(url).includes('/search?')) {
      return Response.json({
        items: [{ id: { videoId: 'WM8bTdBs-cw' }, snippet: { title: 'Metallica - One', channelTitle: 'Metallica' } }]
      });
    }
    return Response.json({ items: [{ id: 'WM8bTdBs-cw', contentDetails: { duration: 'PT7M27S' } }] });
  }) as unknown as typeof fetch;

  assert.deepEqual(await resolveYouTubeVideoIds(query, { apiKey: 'test-key', fetchImpl }), ['WM8bTdBs-cw']);
  assert.equal(requested.length, 3);
  assert.match(requested[0], /googleapis\.com\/youtube\/v3\/search\?.*key=test-key/);
});

test('resolveYouTubeVideoIds drops videos that oEmbed reports as blocked', async () => {
  const fetchImpl = (async (url: string) => {
    if (String(url).includes('/oembed')) {
      return new Response('', { status: String(url).includes('BLOCKED0001') ? 401 : 200 });
    }
    return Response.json(webPayload([
      { id: 'BLOCKED0001', title: 'Metallica - One (Official Audio)', channel: 'Metallica - Topic', length: '7:27' },
      { id: 'ALLOWED0001', title: 'Metallica - One', channel: 'Metallica', length: '7:27' }
    ]));
  }) as unknown as typeof fetch;

  assert.deepEqual(await resolveYouTubeVideoIds(query, { fetchImpl }), ['ALLOWED0001']);
});

test('resolveYouTubeVideoIds returns an empty list when every candidate blocks embedding', async () => {
  const fetchImpl = (async (url: string) =>
    String(url).includes('/oembed')
      ? new Response('', { status: 401 })
      : Response.json(webPayload([{ id: 'BLOCKED0001', title: 'Metallica - One', channel: 'Metallica', length: '7:27' }]))
  ) as unknown as typeof fetch;

  assert.deepEqual(await resolveYouTubeVideoIds(query, { fetchImpl }), []);
});

test('resolveYouTubeVideoIds returns alternates in rank order, capped at three', async () => {
  const fetchImpl = (async (url: string) =>
    String(url).includes('/oembed')
      ? Response.json({})
      : Response.json(webPayload([
          { id: 'FAN00000001', title: 'Metallica - One', channel: 'Fan channel', length: '7:27' },
          { id: 'TOPIC000001', title: 'One', channel: 'Metallica - Topic', length: '7:27' },
          { id: 'AUDIO000001', title: 'Metallica - One (Official Audio)', channel: 'Metallica', length: '7:27' },
          { id: 'OTHER000001', title: 'Metallica One', channel: 'Another fan', length: '7:26' },
          { id: 'OTHER000002', title: 'Metallica One', channel: 'Third fan', length: '7:25' }
        ]))
  ) as unknown as typeof fetch;

  const ids = await resolveYouTubeVideoIds(query, { fetchImpl });
  assert.equal(ids.length, 3);
  assert.equal(ids[0], 'AUDIO000001');
});

test('parseOfficialCandidates drops videos whose owner disabled embedding', () => {
  const search = {
    items: [
      { id: { videoId: 'WM8bTdBs-cw' }, snippet: { title: 'One', channelTitle: 'Metallica' } },
      { id: { videoId: 'pqRDu3ueuA8' }, snippet: { title: 'One', channelTitle: 'Metallica' } }
    ]
  };
  const videos = {
    items: [
      { id: 'WM8bTdBs-cw', contentDetails: { duration: 'PT7M27S' }, status: { embeddable: false } },
      { id: 'pqRDu3ueuA8', contentDetails: { duration: 'PT7M27S' }, status: { embeddable: true } }
    ]
  };
  assert.deepEqual(parseOfficialCandidates(search, videos).map((c) => c.videoId), ['pqRDu3ueuA8']);
});

test('rankCandidates orders acceptable videos best first', () => {
  const best = candidate({ videoId: 'BEST0000001', channel: 'Metallica - Topic' });
  const okay = candidate({ videoId: 'OKAY0000001', title: 'Metallica - One', channel: 'Fan channel' });
  assert.deepEqual(rankCandidates([okay, best], query).map((c) => c.videoId), ['BEST0000001', 'OKAY0000001']);
});

test('resolveYouTubeVideoIds falls back to the web search when the official API refuses the key', async () => {
  const requested: string[] = [];
  const fetchImpl = (async (url: string) => {
    requested.push(String(url));
    if (String(url).includes('googleapis.com')) return new Response('quotaExceeded', { status: 403 });
    if (String(url).includes('/oembed')) return Response.json({});
    return Response.json(webPayload([
      { id: 'WM8bTdBs-cw', title: 'Metallica: One (Official Audio)', channel: 'Metallica', length: '7:27' }
    ]));
  }) as unknown as typeof fetch;

  assert.deepEqual(await resolveYouTubeVideoIds(query, { apiKey: 'bad-key', fetchImpl }), ['WM8bTdBs-cw']);
  assert.ok(requested.some((url) => url.includes('googleapis.com')));
  assert.ok(requested.some((url) => url.includes('/youtubei/v1/search')));
});

test('resolveYouTubeVideoIds rejects on HTTP errors so callers can fall back to the preview', async () => {
  const fetchImpl = (async () => new Response('forbidden', { status: 403 })) as unknown as typeof fetch;
  await assert.rejects(resolveYouTubeVideoIds(query, { fetchImpl }), /HTTP 403/);
});
