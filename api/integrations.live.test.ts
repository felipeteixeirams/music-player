import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchDeezerTracks } from './_deezer';

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
