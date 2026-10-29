import assert from 'node:assert/strict';
import test from 'node:test';
import { PODCAST_PROGRESS_KEY, progressShare, readProgress, resumePosition, saveProgress } from '../src/utils/podcastProgress';

function memory(initial?: string) {
  const data = new Map<string, string>(initial ? [[PODCAST_PROGRESS_KEY, initial]] : []);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

test('INV-POD-03: o ponto em que a pessoa parou é guardado e o episódio retoma dali', () => {
  const storage = memory();
  saveProgress(storage, 'pod-1-a', 1500, 4205, 1000);
  const entry = readProgress(storage)['pod-1-a'];
  assert.deepEqual(entry, { position: 1500, duration: 4205, updatedAt: 1000 });
  assert.equal(resumePosition(entry), 1500);
  assert.equal(Math.round(progressShare(entry) * 100), 36);
});

test('INV-POD-03: nos últimos 20 s o episódio conta como ouvido e recomeça do zero; perto do início não retoma', () => {
  const storage = memory();
  saveProgress(storage, 'a', 4200, 4205, 1);
  const done = readProgress(storage).a;
  assert.equal(done.done, true);
  assert.equal(resumePosition(done), 0);
  assert.equal(progressShare(done), 1);
  saveProgress(storage, 'b', 6, 4205, 1);
  assert.equal(resumePosition(readProgress(storage).b), 0, 'menos de 10 s: começa do início');
  assert.equal(resumePosition(undefined), 0);
});

test('INV-POD-03: guarda no máximo 300 episódios (os mais recentes) e ignora dado corrompido', () => {
  const storage = memory();
  for (let i = 0; i < 305; i += 1) saveProgress(storage, `e${i}`, 100, 3000, i);
  const map = readProgress(storage);
  assert.equal(Object.keys(map).length, 300);
  assert.ok(map.e304 && !map.e0);
  assert.deepEqual(readProgress(memory('não é json')), {});
  assert.deepEqual(readProgress(memory('[1,2]')), {});
  assert.deepEqual(readProgress(null), {});
});
