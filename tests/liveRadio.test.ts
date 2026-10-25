import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIVE_RADIO_GROUPS, LIVE_STATIONS } from '../src/data/liveRadios';
import { isLiveTrack, liveStationToTrack } from '../src/utils/liveRadio';
import type { Track } from '../src/types/music';

test('the live radio list has unique ids, HTTPS streams and names for every station', () => {
  assert.ok(LIVE_RADIO_GROUPS.length >= 5);
  assert.ok(LIVE_STATIONS.length >= 15);
  assert.equal(new Set(LIVE_STATIONS.map((s) => s.id)).size, LIVE_STATIONS.length);
  assert.equal(new Set(LIVE_STATIONS.map((s) => s.streamUrl)).size, LIVE_STATIONS.length, 'two stations share a stream');
  for (const group of LIVE_RADIO_GROUPS) assert.ok(group.stations.length > 0, group.id);
  for (const station of LIVE_STATIONS) {
    assert.match(station.id, /^[a-z0-9-]+$/, station.id);
    assert.ok(station.name.trim() && station.location.trim(), station.id);
    assert.equal(new URL(station.streamUrl).protocol, 'https:', `${station.id} must be HTTPS to play inside the HTTPS app`);
  }
});

test('a live station becomes a track that plays its stream and is marked as live', () => {
  const station = LIVE_STATIONS[0];
  const track = liveStationToTrack(station);
  assert.equal(track.id, `live-${station.id}`);
  assert.equal(track.title, station.name);
  assert.equal(track.sources.localUrl, station.streamUrl);
  assert.equal(track.sources.isLive, true);
  assert.equal(track.duration, 0);
  assert.equal('youtubeId' in track.sources, false);
  assert.equal('previewUrl' in track.sources, false);
  assert.match(track.artist, new RegExp(station.location));
});

test('only tracks marked as live count as live', () => {
  const live = liveStationToTrack(LIVE_STATIONS[0]);
  const normal: Track = { ...live, id: 'deezer-1', sources: { localUrl: '', previewUrl: 'https://cdn.example/p.mp3' } };
  assert.equal(isLiveTrack(live), true);
  assert.equal(isLiveTrack(normal), false);
  assert.equal(isLiveTrack(null), false);
  assert.equal(isLiveTrack(undefined), false);
});

test('the id of a live track cannot be mistaken for a catalog favorite', () => {
  // likedTracks only keeps deezer-N and itunes-N ids, so a station never lands in the favorites library
  assert.equal(/^(deezer|itunes)-\d+$/.test(liveStationToTrack(LIVE_STATIONS[0]).id), false);
});
