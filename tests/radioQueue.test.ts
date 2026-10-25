import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RADIO_REFILL_THRESHOLD, needsRadioRefill, pickRadioRefill } from '../src/utils/radioQueue';
import type { Track } from '../src/types/music';

const track = (id: number): Track => ({
  id: `deezer-${id}`,
  title: `Song ${id}`,
  artist: 'Artist',
  album: 'Album',
  duration: 200,
  coverUrl: 'https://img.example/c.jpg',
  style: 'Rock Clássico',
  categoryId: 'web',
  sources: { localUrl: '' }
});
const tracks = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => track(from + i));
const ids = (list: Track[]) => list.map((t) => t.id);

test('the radio asks for more when few tracks are left after the one playing', () => {
  assert.equal(needsRadioRefill(40, 0), false);
  assert.equal(needsRadioRefill(40, 40 - 1 - RADIO_REFILL_THRESHOLD - 1), false);
  assert.equal(needsRadioRefill(40, 40 - 1 - RADIO_REFILL_THRESHOLD), true);
  assert.equal(needsRadioRefill(40, 39), true);
  assert.equal(needsRadioRefill(0, 0), false);
});

test('a batch of new tracks is added whole', () => {
  const picked = pickRadioRefill(tracks(1, 40), tracks(41, 80));
  assert.deepEqual(ids(picked), ids(tracks(41, 80)));
});

test('tracks heard in the last 40 plays are skipped when enough others are new', () => {
  const queue = tracks(1, 40);
  const incoming = [...tracks(1, 20), ...tracks(41, 60)];
  assert.deepEqual(ids(pickRadioRefill(queue, incoming)), ids(tracks(41, 60)));
});

test('with a small pool the older tracks come back, but never the last 15', () => {
  // pool of 45: after 40 plays only 5 are new (fewer than 10); tracks 1-25 are older than the last 15 plays (26-40)
  const queue = tracks(1, 40);
  const picked = ids(pickRadioRefill(queue, tracks(1, 45)));

  assert.ok(picked.includes('deezer-41') && picked.includes('deezer-45'));
  assert.ok(picked.includes('deezer-1') && picked.includes('deezer-25'));
  for (let n = 26; n <= 40; n++) assert.ok(!picked.includes(`deezer-${n}`), `track ${n} was played too recently`);
});

test('with exactly 10 new tracks the older ones stay out', () => {
  const picked = ids(pickRadioRefill(tracks(1, 40), tracks(1, 50)));
  assert.deepEqual(picked, ids(tracks(41, 50)));
});

test('a batch made only of the last 15 plays adds nothing instead of looping on them', () => {
  assert.deepEqual(pickRadioRefill(tracks(1, 40), tracks(26, 40)), []);
});

test('the same track twice in a batch is added once, and an empty batch adds nothing', () => {
  assert.deepEqual(ids(pickRadioRefill([], [track(1), track(1), track(2)])), ['deezer-1', 'deezer-2']);
  assert.deepEqual(pickRadioRefill(tracks(1, 5), []), []);
});

test('the queue is not changed', () => {
  const queue = tracks(1, 10);
  const incoming = tracks(5, 20);
  pickRadioRefill(queue, incoming);
  assert.equal(queue.length, 10);
  assert.equal(incoming.length, 16);
});
