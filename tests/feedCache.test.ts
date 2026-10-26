import assert from 'node:assert/strict';
import test from 'node:test';
import type { FeedResponse, Track } from '../src/types/music';
import { FEED_CACHE_KEY, FEED_MAX_AGE_MS, formatAge, loadSavedFeed, saveFeed } from '../src/utils/feedCache';

const track = (n: number): Track => ({
  id: `deezer-${n}`, title: `Faixa ${n}`, artist: 'A', album: 'B', duration: 100, coverUrl: '', style: 's', categoryId: 'web', sources: { localUrl: '' }
});
const feed = (): FeedResponse => ({
  categories: { 'top-hits': { tracks: [track(1), track(2)], total: 100, nextIndex: 2 }, 'lofi-chill': { tracks: [], total: 0, nextIndex: null } },
  featured: track(1)
});

const memory = (initial?: string) => {
  let value = initial ?? null;
  return { getItem: () => value, setItem: (_: string, v: string) => { value = v; } };
};

test('saveFeed e loadSavedFeed de ida e volta, com a hora em que foi salvo', () => {
  const storage = memory();
  saveFeed(storage, feed(), 1_000);
  const saved = loadSavedFeed(storage, 5_000);
  assert.equal(saved?.savedAt, 1_000);
  assert.deepEqual(saved?.feed, feed());
});

test('loadSavedFeed recusa o que está velho, vazio, malformado ou vindo do futuro', () => {
  const store = (value: unknown) => memory(JSON.stringify(value));
  assert.equal(loadSavedFeed(memory()), null);
  assert.equal(loadSavedFeed(memory('não é json')), null);
  assert.equal(loadSavedFeed(store({ savedAt: 0, feed: feed() }), FEED_MAX_AGE_MS + 1), null, 'velho demais');
  assert.equal(loadSavedFeed(store({ savedAt: 1_000_000_000, feed: feed() }), 1_000), null, 'data no futuro');
  assert.equal(loadSavedFeed(store({ savedAt: 1, feed: { categories: { a: { tracks: [], total: 0, nextIndex: null } } } }), 2), null, 'sem nenhuma faixa');
  assert.equal(loadSavedFeed(store({ savedAt: 1, feed: { categories: { a: { tracks: 'x', total: 0, nextIndex: null } } } }), 2), null, 'página malformada');
  assert.equal(loadSavedFeed(store({ savedAt: 'ontem', feed: feed() }), 2), null);
  assert.equal(FEED_CACHE_KEY, 'aurastream_feed_cache');
});

test('loadSavedFeed aceita feed sem destaque', () => {
  const storage = memory(JSON.stringify({ savedAt: 1, feed: { categories: feed().categories } }));
  assert.equal(loadSavedFeed(storage, 2)?.feed.featured, null);
});

test('saveFeed não quebra quando o armazenamento recusa', () => {
  assert.doesNotThrow(() => saveFeed({ setItem: () => { throw new Error('quota'); } }, feed()));
});

test('formatAge diz há quanto tempo foi salvo', () => {
  const now = 10 * 24 * 60 * 60 * 1000;
  assert.equal(formatAge(now - 20_000, now), 'há instantes');
  assert.equal(formatAge(now - 5 * 60_000, now), 'há 5 min');
  assert.equal(formatAge(now - 3 * 60 * 60_000, now), 'há 3 h');
  assert.equal(formatAge(now - 24 * 60 * 60_000, now), 'há 1 dia');
  assert.equal(formatAge(now - 3 * 24 * 60 * 60_000, now), 'há 3 dias');
  assert.equal(formatAge(now + 99_999, now), 'há instantes');
});
