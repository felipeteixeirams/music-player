import assert from 'node:assert/strict';
import test from 'node:test';
import { loadChoices, nextVersionIndex, orderVersions, rememberChoice, VIDEO_CHOICE_KEY } from '../src/utils/videoChoice';

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => { data[key] = value; },
    data
  };
};

test('orderVersions põe a escolha na frente, acrescenta se a busca não a devolve e não repete', () => {
  assert.deepEqual(orderVersions(['AAAAAAAAAAA', 'BBBBBBBBBBB', 'CCCCCCCCCCC'], 'BBBBBBBBBBB'), ['BBBBBBBBBBB', 'AAAAAAAAAAA', 'CCCCCCCCCCC']);
  assert.deepEqual(orderVersions(['AAAAAAAAAAA'], 'ZZZZZZZZZZZ'), ['ZZZZZZZZZZZ', 'AAAAAAAAAAA']);
  assert.deepEqual(orderVersions(['AAAAAAAAAAA', 'BBBBBBBBBBB']), ['AAAAAAAAAAA', 'BBBBBBBBBBB']);
  assert.deepEqual(orderVersions([], undefined), []);
});

test('nextVersionIndex avança e volta ao começo', () => {
  assert.equal(nextVersionIndex(0, 3), 1);
  assert.equal(nextVersionIndex(2, 3), 0);
  assert.equal(nextVersionIndex(0, 0), 0);
});

test('rememberChoice grava e loadChoices lê só entradas no formato certo', () => {
  const storage = memory();
  rememberChoice(storage, 'deezer-1', 'AAAAAAAAAAA');
  rememberChoice(storage, 'deezer-2', 'BBBBBBBBBBB');
  assert.deepEqual(loadChoices(storage), { 'deezer-1': 'AAAAAAAAAAA', 'deezer-2': 'BBBBBBBBBBB' });

  const dirty = memory({ [VIDEO_CHOICE_KEY]: JSON.stringify({ ok: 'AAAAAAAAAAA', short: 'abc', number: 5 }) });
  assert.deepEqual(loadChoices(dirty), { ok: 'AAAAAAAAAAA' });
  assert.deepEqual(loadChoices(memory({ [VIDEO_CHOICE_KEY]: 'not json' })), {});
  assert.deepEqual(loadChoices(memory({ [VIDEO_CHOICE_KEY]: '[1,2]' })), {});
});

test('rememberChoice troca a escolha de uma faixa e esquece as mais antigas além do limite', () => {
  const storage = memory();
  rememberChoice(storage, 'deezer-1', 'AAAAAAAAAAA');
  rememberChoice(storage, 'deezer-1', 'BBBBBBBBBBB');
  assert.equal(loadChoices(storage)['deezer-1'], 'BBBBBBBBBBB');

  for (let i = 0; i < 305; i++) rememberChoice(storage, `deezer-${i + 10}`, 'CCCCCCCCCCC');
  const choices = loadChoices(storage);
  assert.equal(Object.keys(choices).length, 300);
  assert.equal(choices['deezer-1'], undefined, 'a mais antiga saiu');
  assert.equal(choices['deezer-314'], 'CCCCCCCCCCC');
});

test('rememberChoice não quebra quando o armazenamento recusa', () => {
  const refusing = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.doesNotThrow(() => rememberChoice(refusing, 'deezer-1', 'AAAAAAAAAAA'));
});
