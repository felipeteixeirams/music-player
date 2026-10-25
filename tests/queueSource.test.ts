import assert from 'node:assert/strict';
import test from 'node:test';
import type { Track } from '../src/types/music';
import { needsMoreTracks, newTracks, QUEUE_MORE_THRESHOLD } from '../src/utils/queueSource';

const track = (id: string): Track => ({
  id, title: id, artist: 'a', album: 'b', duration: 100, coverUrl: '', style: 's', categoryId: 'web', sources: { localUrl: '' }
});

test('needsMoreTracks pede mais perto do fim e só quando a lista tem mais', () => {
  assert.equal(needsMoreTracks(20, 10, 20), false);
  assert.equal(needsMoreTracks(20, 20 - 1 - QUEUE_MORE_THRESHOLD, 20), true);
  assert.equal(needsMoreTracks(20, 19, 20), true);
  assert.equal(needsMoreTracks(20, 19, null), false);
  assert.equal(needsMoreTracks(0, 0, 20), false);
});

test('newTracks descarta o que já está na fila e repetições da própria página', () => {
  const queue = [track('a'), track('b')];
  const incoming = [track('b'), track('c'), track('c'), track('d')];
  assert.deepEqual(newTracks(queue, incoming).map((t) => t.id), ['c', 'd']);
  assert.deepEqual(newTracks(queue, [track('a')]), []);
});
