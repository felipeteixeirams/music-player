import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchDeezerTracks } from './_deezer';
import { resolveYouTubeVideoIds } from './_youtubeSearch';

test(
  'live Deezer search returns tracks whose preview is real audio',
  { skip: process.env.RUN_LIVE_INTEGRATION_TESTS !== '1', timeout: 30000 },
  async () => {
    for (const query of ['Metallica One', 'Creed One Last Breath', 'Bon Jovi Livin on a Prayer']) {
      const tracks = await searchDeezerTracks(query, { requirePreview: true });
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
      const [track] = await searchDeezerTracks(query, { requirePreview: true });
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
