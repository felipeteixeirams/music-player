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
  resolveYouTubeVideos,
  type VideoCandidate,
  describeResolution,
  rankCandidatesDetailed
} from '../../api/_youtubeSearch';

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
  // The label's own audio upload (Topic channel) outranks an official audio upload
  assert.equal(ids[0], 'TOPIC000001');
  assert.equal(ids[1], 'AUDIO000001');
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

test('resolveYouTubeVideos reports which search produced the videos', async () => {
  const official = (async (url: string) => {
    if (String(url).includes('/oembed')) return Response.json({});
    if (String(url).includes('/search?')) {
      return Response.json({ items: [{ id: { videoId: 'WM8bTdBs-cw' }, snippet: { title: 'Metallica - One', channelTitle: 'Metallica' } }] });
    }
    return Response.json({ items: [{ id: 'WM8bTdBs-cw', contentDetails: { duration: 'PT7M27S' } }] });
  }) as unknown as typeof fetch;
  const resolved = await resolveYouTubeVideos(query, { apiKey: 'k', fetchImpl: official });
  assert.deepEqual(resolved.videoIds, ['WM8bTdBs-cw']);
  assert.equal(resolved.via, 'official');
  assert.equal(resolved.considered, 1);
  assert.equal(resolved.picks[0].candidate.videoId, 'WM8bTdBs-cw');

  const web = (async (url: string) =>
    String(url).includes('/oembed')
      ? Response.json({})
      : Response.json(webPayload([{ id: 'WM8bTdBs-cw', title: 'Metallica - One', channel: 'Metallica', length: '7:27' }]))
  ) as unknown as typeof fetch;
  assert.equal((await resolveYouTubeVideos(query, { fetchImpl: web })).via, 'web');

  const refused = (async (url: string) =>
    String(url).includes('googleapis.com') ? new Response('quota', { status: 403 }) : web(url)
  ) as unknown as typeof fetch;
  assert.equal((await resolveYouTubeVideos(query, { apiKey: 'k', fetchImpl: refused })).via, 'web-after-official-failure');
});

test('resolveYouTubeVideoIds rejects on HTTP errors so callers can fall back to the preview', async () => {
  const fetchImpl = (async () => new Response('forbidden', { status: 403 })) as unknown as typeof fetch;
  await assert.rejects(resolveYouTubeVideoIds(query, { fetchImpl }), /HTTP 403/);
});

const cand = (videoId: string, title: string, channel: string, durationSeconds: number | null) => ({ videoId, title, channel, durationSeconds });

test('rankCandidatesDetailed prefers the Topic channel and a music video comes last', () => {
  const ranked = rankCandidatesDetailed(
    [
      cand('CLIP0000001', 'Metallica - One (Official Music Video)', 'Metallica', 447),
      cand('AUDIO000001', 'Metallica - One (Official Audio)', 'Metallica', 447),
      cand('TOPIC000001', 'One', 'Metallica - Topic', 447)
    ],
    query
  );
  assert.deepEqual(ranked.map((r) => r.candidate.videoId), ['TOPIC000001', 'AUDIO000001', 'CLIP0000001']);
  assert.equal(ranked[0].topic, true);
  assert.equal(ranked[2].topic, false);
});

test('a music video is worse than audio but still accepted when it is all there is', () => {
  const ranked = rankCandidatesDetailed([cand('CLIP0000001', 'Metallica - One (Official Video)', 'Metallica', 447)], query);
  assert.equal(ranked.length, 1);
});

test('the closer the duration, the higher the rank, and more than 15 s away is rejected', () => {
  const ranked = rankCandidatesDetailed(
    [
      cand('FAR00000001', 'Metallica - One', 'Fan', 447 + 10),
      cand('NEAR0000001', 'Metallica - One', 'Fan', 447 + 4),
      cand('SAME0000001', 'Metallica - One', 'Fan', 447 + 1),
      cand('OFF00000001', 'Metallica - One', 'Fan', 447 + 40)
    ],
    query
  );
  assert.deepEqual(ranked.map((r) => r.candidate.videoId), ['SAME0000001', 'NEAR0000001', 'FAR00000001']);
  assert.equal(ranked[0].durationDiff, 1);
});

test('a live take of the right length stays rejected', () => {
  assert.deepEqual(rankCandidatesDetailed([cand('LIVE0000001', 'Metallica - One (Live)', 'Metallica', 447)], query), []);
});

test('describeResolution says what was chosen and why, or why nothing was', () => {
  const picked = describeResolution(
    query,
    { videoIds: ['TOPIC000001'], via: 'official', considered: 5, picks: rankCandidatesDetailed([cand('TOPIC000001', 'One', 'Metallica - Topic', 448)], query) },
    312
  );
  assert.match(picked, /✅ "Metallica - One" → 1 vídeo\(s\) via official em 312ms/);
  assert.match(picked, /escolhido: "One" \(Metallica - Topic\) Δ1s, \d+ pontos, Topic/);

  const none = describeResolution(query, { videoIds: [], via: 'web', considered: 7, picks: [] }, 90);
  assert.match(none, /⚠️ .* 0 vídeo\(s\) via web em 90ms \| 7 candidato\(s\), nenhum aceito/);
});


const akashic = { artist: 'Akashic', title: 'Memories', duration: 565 };

/** The official API finds videos, but none is the track; the web search has it. */
function officialMissesWebHits(web: unknown) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    const text = String(url);
    calls.push(text);
    if (text.includes('/oembed')) return Response.json({});
    if (text.includes('googleapis.com') && text.includes('/search?')) {
      return Response.json({ items: [{ id: { videoId: 'OTHER000001' }, snippet: { title: 'Memories - Maroon 5 (Official Video)', channelTitle: 'Maroon 5' } }] });
    }
    if (text.includes('googleapis.com')) return Response.json({ items: [{ id: 'OTHER000001', contentDetails: { duration: 'PT3M9S' } }] });
    if (web === 'blocked') return new Response('no', { status: 429 });
    return Response.json(web);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

test('INV-PLAY-17: quando a busca oficial acha vídeos mas nenhum é a faixa, a busca web dá uma segunda opinião (sem gastar cota)', async () => {
  const { fetchImpl, calls } = officialMissesWebHits(webPayload([{ id: 'AKASHIC0001', title: 'Akashic - Memories (Lyrics)', channel: 'M K', length: '9:26' }]));
  const result = await resolveYouTubeVideos(akashic, { apiKey: 'k', fetchImpl });
  assert.equal(result.via, 'web-after-official-empty');
  assert.deepEqual(result.videoIds, ['AKASHIC0001']);
  // One official search (and its details call) plus one web search: the second opinion is not a second official search
  assert.equal(calls.filter((url) => url.includes('googleapis.com') && url.includes('/search?')).length, 1);
  assert.equal(calls.filter((url) => url.includes('youtubei')).length, 1);
});

test('INV-PLAY-17: sem segunda opinião útil (web vazia ou bloqueada) a resposta oficial "nada" vale e continua sendo guardada como tal', async () => {
  for (const web of [webPayload([{ id: 'NOPE0000001', title: 'Something Else Entirely', channel: 'X', length: '3:00' }]), 'blocked']) {
    const { fetchImpl } = officialMissesWebHits(web);
    const result = await resolveYouTubeVideos(akashic, { apiKey: 'k', fetchImpl });
    assert.equal(result.via, 'official', 'o resultado vazio segue sendo o da API oficial (é o que o cache de "não achei" exige)');
    assert.deepEqual(result.videoIds, []);
  }
});

test('INV-PLAY-17: quando a busca oficial acha a faixa, a busca web nem é consultada', async () => {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    const text = String(url);
    calls.push(text);
    if (text.includes('/oembed')) return Response.json({});
    if (text.includes('/search?')) return Response.json({ items: [{ id: { videoId: 'WM8bTdBs-cw' }, snippet: { title: 'Metallica - One', channelTitle: 'Metallica' } }] });
    return Response.json({ items: [{ id: 'WM8bTdBs-cw', contentDetails: { duration: 'PT7M27S' } }] });
  }) as unknown as typeof fetch;
  const result = await resolveYouTubeVideos(query, { apiKey: 'k', fetchImpl });
  assert.equal(result.via, 'official');
  assert.equal(calls.filter((url) => url.includes('youtubei')).length, 0);
});

test('INV-PLAY-18: um vídeo de outro artista e outro título, mesmo Topic e com duração parecida, não é aceito', () => {
  const wanted = { artist: 'Akashic', title: "Heaven's Call", duration: 258 };
  const other = candidate({ videoId: 'OTHER000001', title: 'Calling From Heaven', channel: 'Ebbot Lundberg - Topic', durationSeconds: 248 });
  const right = candidate({ videoId: 'RIGHT000001', title: "Akashic - Heaven's Call", channel: 'Akashic', durationSeconds: 258 });
  assert.equal(pickBestCandidate([other], wanted), null);
  assert.equal(pickBestCandidate([other, right], wanted)?.videoId, 'RIGHT000001');
});

test('INV-PLAY-18: o artista aparece no canal ou com grafia diferente e a faixa continua sendo aceita', () => {
  const vevo = candidate({ videoId: 'VEVO0000001', title: 'Tusa', channel: 'KarolGVEVO', durationSeconds: 200 });
  assert.equal(pickBestCandidate([vevo], { artist: 'KAROL G, Nicki Minaj', title: 'Tusa', duration: 200 })?.videoId, 'VEVO0000001');
  const dupla = candidate({ videoId: 'DUPLA000001', title: 'Zé Neto e Cristiano - Largado às Traças', channel: 'Zé Neto & Cristiano', durationSeconds: 180 });
  assert.equal(pickBestCandidate([dupla], { artist: 'Zé Neto & Cristiano', title: 'Largado às Traças', duration: 180 })?.videoId, 'DUPLA000001');
});
