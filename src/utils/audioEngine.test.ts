import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTime,
  formatRemainingTime,
  calculateProgress,
  progressToSeconds,
  getNextTrackIndex,
  getPreviousTrackIndex,
  extractAudioStreamFromPipedData,
  resolveAudioDetails
} from './audioEngine';
import { Track } from '../types/music';
import { extractYouTubeId } from './youtubeId';

test('extractYouTubeId normalizes Piped and YouTube URLs', () => {
  assert.equal(extractYouTubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('/streams/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('/watch?v=invalid'), null);
  assert.equal(extractYouTubeId(null), null);
});

test('formatTime formats seconds properly into MM:SS', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(65), '01:05');
  assert.equal(formatTime(354), '05:54');
  assert.equal(formatTime(204), '03:24');
  assert.equal(formatTime(-10), '00:00');
  assert.equal(formatTime(NaN), '00:00');
});

test('formatRemainingTime formats negative remaining duration', () => {
  assert.equal(formatRemainingTime(60, 200), '-02:20');
  assert.equal(formatRemainingTime(200, 200), '-00:00');
  assert.equal(formatRemainingTime(0, 0), '-00:00');
});

test('calculateProgress calculates accurate percentage clamped 0 to 100', () => {
  assert.equal(calculateProgress(50, 100), 50);
  assert.equal(calculateProgress(0, 300), 0);
  assert.equal(calculateProgress(300, 300), 100);
  assert.equal(calculateProgress(350, 300), 100);
  assert.equal(calculateProgress(-10, 300), 0);
  assert.equal(calculateProgress(0, 0), 0);
});

test('progressToSeconds calculates second offset from percentage', () => {
  assert.equal(progressToSeconds(50, 200), 100);
  assert.equal(progressToSeconds(100, 300), 300);
  assert.equal(progressToSeconds(0, 100), 0);
});

test('getNextTrackIndex handles sequential, repeat, and edge conditions', () => {
  // Sequential next
  assert.equal(getNextTrackIndex(0, 4, false, 'off'), 1);
  assert.equal(getNextTrackIndex(1, 4, false, 'off'), 2);
  assert.equal(getNextTrackIndex(3, 4, false, 'off'), -1); // End of queue

  // Repeat All
  assert.equal(getNextTrackIndex(3, 4, false, 'all'), 0);

  // Repeat One
  assert.equal(getNextTrackIndex(2, 4, false, 'one'), 2);

  // Empty queue
  assert.equal(getNextTrackIndex(0, 0, false, 'off'), -1);
  assert.equal(getNextTrackIndex(0, 1, false, 'off'), 0);
});

test('getPreviousTrackIndex cycles back properly', () => {
  assert.equal(getPreviousTrackIndex(2, 4), 1);
  assert.equal(getPreviousTrackIndex(0, 4), 3); // wraps to last track
  assert.equal(getPreviousTrackIndex(0, 1), 0);
});

test('extractAudioStreamFromPipedData parses and selects highest bitrate stream', () => {
  const mockPipedPayload = {
    audioStreams: [
      { url: 'https://stream.pipe/audio-low.webm', bitrate: 64000, quality: '64kbps' },
      { url: 'https://stream.pipe/audio-high.m4a', bitrate: 160000, quality: '160kbps' },
      { url: 'https://stream.pipe/audio-med.webm', bitrate: 128000, quality: '128kbps' }
    ]
  };

  const extracted = extractAudioStreamFromPipedData(mockPipedPayload);
  assert.ok(extracted);
  assert.equal(extracted.url, 'https://stream.pipe/audio-high.m4a');
  assert.equal(extracted.bitrate, 160000);

  // Empty or invalid data returns null
  assert.equal(extractAudioStreamFromPipedData(null), null);
  assert.equal(extractAudioStreamFromPipedData({ audioStreams: [] }), null);
});

test('resolveAudioDetails provides correct engine and url based on track sources', () => {
  const mockTrack: Track = {
    id: 'test-queen',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    duration: 354,
    coverUrl: '/cover.jpg',
    style: 'Classic Rock',
    categoryId: 'classic-rock',
    sources: {
      localUrl: 'https://audio.cdn/queen.mp3',
      youtubeId: 'fJ9rUzIMcZQ'
    }
  };

  const nativeDetails = resolveAudioDetails(mockTrack, 'native');
  assert.equal(nativeDetails.engine, 'native');
  assert.equal(nativeDetails.url, 'https://audio.cdn/queen.mp3');
  assert.equal(nativeDetails.fallbackAvailable, true);

  const fallbackDetails = resolveAudioDetails(mockTrack, 'fallback');
  assert.equal(fallbackDetails.engine, 'fallback');
  assert.equal(fallbackDetails.url, 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ');
});
