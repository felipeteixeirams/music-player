import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATEGORY_IDS, CATEGORY_PLAYLISTS, MAX_PAGE_SIZE, isCategoryId, readPageParams } from '../../api/_categories';
import { CATEGORIES } from '../../src/data/musicCatalog';

test('every category shown in the app has a playlist behind it, and the other way around', () => {
  assert.deepEqual([...CATEGORIES.map((c) => c.id)].sort(), [...CATEGORY_IDS].sort());
  for (const id of CATEGORY_IDS) assert.ok(Number.isSafeInteger(CATEGORY_PLAYLISTS[id].playlistId));
});

test('isCategoryId accepts configured ids only', () => {
  assert.equal(isCategoryId('classic-rock'), true);
  for (const bad of [undefined, null, 42, '', 'unknown', '__proto__', 'constructor', 'toString', ['classic-rock']]) {
    assert.equal(isCategoryId(bad), false, String(bad));
  }
});

test('readPageParams reads non-negative integers and clamps the page size', () => {
  assert.deepEqual(readPageParams({}), { index: 0, limit: 20 });
  assert.deepEqual(readPageParams({ index: '40', limit: '10' }), { index: 40, limit: 10 });
  assert.deepEqual(readPageParams({ index: ['5'], limit: ['7'] }), { index: 5, limit: 7 });
  assert.equal(readPageParams({ limit: '9999' }).limit, MAX_PAGE_SIZE);
  assert.equal(readPageParams({ limit: '0' }).limit, 1);
  for (const bad of ['-1', '1.5', 'abc', '', '1e3', ' 5', '99999999999999999999']) {
    assert.deepEqual(readPageParams({ index: bad, limit: bad }), { index: 0, limit: 20 }, bad);
  }
});
