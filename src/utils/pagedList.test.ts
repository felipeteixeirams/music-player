import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMPTY_PAGED_LIST, appendPage, fromPage } from './pagedList';
import type { Track } from '../types/music';

const track = (id: string): Track => ({
  id,
  title: id,
  artist: 'Artist',
  album: 'Album',
  duration: 200,
  coverUrl: 'https://img.example/c.jpg',
  style: 'Deezer',
  categoryId: 'web',
  sources: { localUrl: '' }
});

test('appendPage adds the new page after the tracks already shown and moves the cursor', () => {
  const first = fromPage({ tracks: [track('a'), track('b')], total: 5, nextIndex: 2 });
  const second = appendPage(first, { tracks: [track('c'), track('d')], total: 5, nextIndex: 4 });
  assert.deepEqual(second.tracks.map((t) => t.id), ['a', 'b', 'c', 'd']);
  assert.equal(second.nextIndex, 4);
  assert.equal(second.total, 5);
});

test('appendPage skips tracks that were already listed, including repeats inside the page', () => {
  const first = fromPage({ tracks: [track('a'), track('b')], total: 4, nextIndex: 2 });
  const second = appendPage(first, { tracks: [track('b'), track('c'), track('c')], total: 4, nextIndex: null });
  assert.deepEqual(second.tracks.map((t) => t.id), ['a', 'b', 'c']);
  assert.equal(second.nextIndex, null);
});

test('appendPage does not change the previous state', () => {
  const first = fromPage({ tracks: [track('a')], total: 2, nextIndex: 1 });
  appendPage(first, { tracks: [track('b')], total: 2, nextIndex: null });
  assert.deepEqual(first.tracks.map((t) => t.id), ['a']);
  assert.deepEqual(EMPTY_PAGED_LIST, { tracks: [], total: 0, nextIndex: null });
});

test('a page of only known tracks still moves the cursor, so loading cannot stall on duplicates', () => {
  const first = fromPage({ tracks: [track('a'), track('b')], total: 6, nextIndex: 2 });
  const second = appendPage(first, { tracks: [track('a')], total: 6, nextIndex: 4 });
  assert.deepEqual(second.tracks.map((t) => t.id), ['a', 'b']);
  assert.equal(second.nextIndex, 4);
});
