import assert from 'node:assert/strict';
import test from 'node:test';
import type { Track } from '../src/types/music';
import type { PlayEntry } from '../src/utils/playHistory';
import { computePlayStats, formatPlayTime, getTimelinePeriod } from '../src/utils/playStats';

const makeTrack = (id: string, title: string, artist: string, duration = 180): Track => ({
  id,
  title,
  artist,
  album: 'Test Album',
  duration,
  coverUrl: `https://example.com/${id}.jpg`,
  style: 'Pop',
  categoryId: 'pop',
  sources: { localUrl: '' }
});

const t1 = makeTrack('1', 'Song A', 'Artist One', 200);
const t2 = makeTrack('2', 'Song B', 'Artist One', 150);
const t3 = makeTrack('3', 'Song C', 'Artist Two', 300);

test('computePlayStats: retorna valores zerados para histórico vazio', () => {
  const stats = computePlayStats([]);
  assert.equal(stats.totalPlays, 0);
  assert.equal(stats.uniqueTracksCount, 0);
  assert.equal(stats.uniqueArtistsCount, 0);
  assert.equal(stats.totalMinutesListened, 0);
  assert.deepEqual(stats.topTracks, []);
  assert.deepEqual(stats.topArtists, []);
  assert.deepEqual(stats.timeline, []);
  assert.equal(stats.favoriteArtist, undefined);
});

test('computePlayStats: computa ranking de faixas mais tocadas e artistas corretamente', () => {
  const now = Date.now();
  const entries: PlayEntry[] = [
    { track: t1, playedAt: now - 1000 },
    { track: t1, playedAt: now - 5000 },
    { track: t1, playedAt: now - 10000 },
    { track: t2, playedAt: now - 20000 },
    { track: t3, playedAt: now - 30000 },
    { track: t3, playedAt: now - 40000 }
  ];

  const stats = computePlayStats(entries, now);
  assert.equal(stats.totalPlays, 6);
  assert.equal(stats.uniqueTracksCount, 3);
  assert.equal(stats.uniqueArtistsCount, 2);

  // Top Tracks: t1 (3 plays), t3 (2 plays), t2 (1 play)
  assert.equal(stats.topTracks.length, 3);
  assert.equal(stats.topTracks[0].track.id, '1');
  assert.equal(stats.topTracks[0].count, 3);
  assert.equal(stats.topTracks[1].track.id, '3');
  assert.equal(stats.topTracks[1].count, 2);
  assert.equal(stats.topTracks[2].track.id, '2');
  assert.equal(stats.topTracks[2].count, 1);

  // Top Artists: Artist One (4 plays: 3 from t1 + 1 from t2), Artist Two (2 plays)
  assert.equal(stats.topArtists.length, 2);
  assert.equal(stats.topArtists[0].artist, 'Artist One');
  assert.equal(stats.topArtists[0].count, 4);
  assert.equal(stats.topArtists[0].trackCount, 2);
  assert.equal(stats.favoriteArtist?.artist, 'Artist One');

  // Total Duration: (200*3 + 150*1 + 300*2) = 600 + 150 + 600 = 1350s = ~23 min
  assert.equal(stats.totalMinutesListened, 23);
});

test('getTimelinePeriod e formatPlayTime: agrupamento cronológico correto', () => {
  const now = new Date('2026-11-17T12:00:00Z').getTime();

  // 1 hour ago -> Hoje
  assert.equal(getTimelinePeriod(now - 3600 * 1000, now), 'Hoje');

  // 26 hours ago -> Ontem
  assert.equal(getTimelinePeriod(now - 26 * 3600 * 1000, now), 'Ontem');

  // 4 days ago -> Esta semana
  assert.equal(getTimelinePeriod(now - 4 * 24 * 3600 * 1000, now), 'Esta semana');

  // 15 days ago -> Mais antigas
  assert.equal(getTimelinePeriod(now - 15 * 24 * 3600 * 1000, now), 'Mais antigas');

  // formatPlayTime
  assert.equal(formatPlayTime(now - 30 * 1000, now), 'Agora mesmo');
  assert.equal(formatPlayTime(now - 10 * 60 * 1000, now), 'Há 10 min');
});
