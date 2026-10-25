import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LIKED_IDS_KEY,
  LIKED_TRACKS_KEY,
  hydrateLikedLibrary,
  likedIds,
  loadLikedLibrary,
  toggleLikedTrack
} from './likedTracks';
import type { Track } from '../types/music';

const track = (id: string): Track => ({
  id,
  title: `Song ${id}`,
  artist: 'Artist',
  album: 'Album',
  duration: 200,
  coverUrl: 'https://img.example/c.jpg',
  style: 'Deezer',
  categoryId: 'web',
  sources: { localUrl: '', previewUrl: 'https://cdn.example/p.mp3' }
});

const storage = (entries: Record<string, unknown>) => ({
  getItem: (key: string) => (key in entries ? JSON.stringify(entries[key]) : null)
});

test('loadLikedLibrary keeps stored favorites and drops ids of removed integrations', () => {
  const library = loadLikedLibrary(storage({
    [LIKED_TRACKS_KEY]: [track('deezer-1'), track('piped-M7lc1UVf-VE'), { id: 'deezer-2' }, null],
    [LIKED_IDS_KEY]: ['deezer-1', 'deezer-3', 'ytm-dQw4w9WgXcQ', 'piped-M7lc1UVf-VE', 42]
  }));
  assert.deepEqual(library.tracks.map((t) => t.id), ['deezer-1']);
  assert.deepEqual(library.pendingIds, ['deezer-3']);
});

test('loadLikedLibrary survives missing and corrupt storage', () => {
  assert.deepEqual(loadLikedLibrary(storage({})), { tracks: [], pendingIds: [] });
  assert.deepEqual(
    loadLikedLibrary({ getItem: () => '{not json' }),
    { tracks: [], pendingIds: [] }
  );
  assert.deepEqual(loadLikedLibrary(storage({ [LIKED_TRACKS_KEY]: { a: 1 } })), { tracks: [], pendingIds: [] });
});

test('toggleLikedTrack adds with metadata, removes, and removes pending ids', () => {
  let library = loadLikedLibrary(storage({ [LIKED_IDS_KEY]: ['deezer-9'] }));
  library = toggleLikedTrack(library, track('deezer-1'));
  assert.deepEqual(likedIds(library), ['deezer-1', 'deezer-9']);

  library = toggleLikedTrack(library, track('deezer-1'));
  library = toggleLikedTrack(library, track('deezer-9'));
  assert.deepEqual(library, { tracks: [], pendingIds: [] });
});

test('hydrateLikedLibrary gives metadata to pending favorites that reappear', () => {
  const library = { tracks: [track('deezer-1')], pendingIds: ['deezer-2', 'deezer-3'] };
  const hydrated = hydrateLikedLibrary(library, [track('deezer-2'), track('deezer-2'), track('deezer-7')]);
  assert.deepEqual(hydrated.tracks.map((t) => t.id), ['deezer-1', 'deezer-2']);
  assert.deepEqual(hydrated.pendingIds, ['deezer-3']);
});

test('hydrateLikedLibrary returns the same object when nothing changes', () => {
  const library = { tracks: [], pendingIds: ['deezer-2'] };
  assert.equal(hydrateLikedLibrary(library, [track('deezer-7')]), library);
  const noPending = { tracks: [track('deezer-1')], pendingIds: [] };
  assert.equal(hydrateLikedLibrary(noPending, [track('deezer-1')]), noPending);
});
