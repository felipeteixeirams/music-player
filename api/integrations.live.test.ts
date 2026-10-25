import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchCategoryPage, searchDeezerTracks } from './_deezer';
import { CATEGORY_IDS } from './_categories';
import { resolveYouTubeVideoIds } from './_youtubeSearch';
import { searchItunesTracks } from './_itunes';

test(
  'live Deezer search returns tracks whose preview is real audio',
  { skip: process.env.RUN_LIVE_INTEGRATION_TESTS !== '1', timeout: 30000 },
  async () => {
    for (const query of ['Metallica One', 'Creed One Last Breath', 'Bon Jovi Livin on a Prayer']) {
      const tracks = (await searchDeezerTracks(query)).filter((t) => t.sources.previewUrl);
      assert.ok(tracks.length > 0, `Deezer returned no playable tracks for "${query}"`);

      const track = tracks[0];
      assert.ok(track.duration > 0);
      const previewUrl = track.sources.previewUrl!;
      const audio = await fetch(previewUrl, {
        headers: { Range: 'bytes=0-0' },
        signal: AbortSignal.timeout(8000)
      });
      await audio.body?.cancel();
      assert.ok(audio.ok, `Preview for "${query}" returned HTTP ${audio.status}`);
      assert.match(audio.headers.get('content-type') ?? '', /^audio\//);
      console.info(`Live smoke: "${query}" -> ${track.artist} - ${track.title} (${track.duration}s), preview HTTP ${audio.status}`);
    }
  }
);

test(
  'live resolution finds YouTube videos for full-length playback of known tracks',
  { skip: process.env.RUN_LIVE_INTEGRATION_TESTS !== '1', timeout: 30000 },
  async () => {
    for (const query of ['Creed One Last Breath', 'Bon Jovi Livin on a Prayer', 'Queen Bohemian Rhapsody']) {
      const [track] = (await searchDeezerTracks(query)).filter((t) => t.sources.previewUrl);
      const videoIds = await resolveYouTubeVideoIds(
        { artist: track.artist, title: track.title, duration: track.duration },
        { apiKey: process.env.YOUTUBE_API_KEY }
      );
      assert.ok(videoIds.length > 0, `No video found for "${track.artist} - ${track.title}"`);
      for (const id of videoIds) assert.match(id, /^[A-Za-z0-9_-]{11}$/);
      // Finding a video does not prove the owner allows embedding: that is only known when the player loads it.
      console.info(`Live smoke: ${track.artist} - ${track.title} -> ${videoIds.join(', ')}`);
    }
  }
);

test(
  'live iTunes fallback returns tracks whose preview is real audio',
  { skip: process.env.RUN_LIVE_INTEGRATION_TESTS !== '1', timeout: 30000 },
  async () => {
    const tracks = await searchItunesTracks('Bon Jovi Livin on a Prayer');
    const track = tracks.find((t) => t.sources.previewUrl);
    assert.ok(track, 'iTunes returned no track with a preview');
    assert.ok(track.duration > 0);

    const audio = await fetch(track.sources.previewUrl!, {
      headers: { Range: 'bytes=0-0' },
      signal: AbortSignal.timeout(8000)
    });
    await audio.body?.cancel();
    assert.ok(audio.ok, `iTunes preview returned HTTP ${audio.status}`);
    assert.match(audio.headers.get('content-type') ?? '', /^(audio|video)\//);
    console.info(`Live smoke: iTunes -> ${track.artist} - ${track.title} (${track.duration}s), preview HTTP ${audio.status}`);
  }
);

test(
  'live category playlists still exist, have enough tracks and page correctly',
  { skip: process.env.RUN_LIVE_INTEGRATION_TESTS !== '1', timeout: 40000 },
  async () => {
    for (const id of CATEGORY_IDS) {
      const first = await fetchCategoryPage(id, { index: 0, limit: 20 });
      assert.ok(first.total >= 20, `"${id}" playlist has only ${first.total} tracks (removed or emptied?)`);
      assert.ok(first.tracks.length >= 10, `"${id}" first page mapped only ${first.tracks.length} tracks`);

      if (first.nextIndex !== null) {
        const second = await fetchCategoryPage(id, { index: first.nextIndex, limit: 20 });
        const firstIds = new Set(first.tracks.map((t) => t.id));
        assert.ok(second.tracks.every((t) => !firstIds.has(t.id)), `"${id}" page 2 repeats tracks from page 1`);
      }
      console.info(`Live smoke: ${id} -> ${first.total} faixas, página 1 com ${first.tracks.length}, "${first.tracks[0].artist} - ${first.tracks[0].title}"`);
    }
  }
);
