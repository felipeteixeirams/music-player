import assert from 'node:assert/strict';
import test from 'node:test';
import { RESOLVED_KEY, ResolvedStore } from '../src/utils/resolvedStore';

const A = 'AAAAAAAAAAA';
const B = 'BBBBBBBBBBB';

function memoryStorage(initial?: string) {
  const data = new Map<string, string>(initial ? [[RESOLVED_KEY, initial]] : []);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

test('o que se descobre fica guardado e volta no próximo carregamento', () => {
  const storage = memoryStorage();
  new ResolvedStore(storage).set('deezer-1', [A, B]);
  assert.deepEqual(new ResolvedStore(storage).get('deezer-1'), [A, B]);
  assert.equal(new ResolvedStore(storage).get('deezer-2'), undefined);
});

test('lista vazia ou ids inválidos não são guardados ("não achei" é do servidor)', () => {
  const storage = memoryStorage();
  const store = new ResolvedStore(storage);
  store.set('deezer-1', []);
  store.set('deezer-2', ['curto', 'tem espaço!!']);
  assert.equal(store.size, 0);
  assert.equal(storage.data.size, 0);
  store.set('deezer-3', ['curto', A]);
  assert.deepEqual(store.get('deezer-3'), [A]);
});

test('passado o prazo (30 dias) a entrada some', () => {
  let now = 1_000_000;
  const storage = memoryStorage();
  const store = new ResolvedStore(storage, () => now);
  store.set('deezer-1', [A]);
  now += 29 * 24 * 3600 * 1000;
  assert.deepEqual(store.get('deezer-1'), [A]);
  now += 2 * 24 * 3600 * 1000;
  assert.equal(store.get('deezer-1'), undefined);
  assert.equal(new ResolvedStore(storage, () => now).size, 0, 'nem no carregamento seguinte');
});

test('guarda no máximo 500 faixas, descartando as mais antigas', () => {
  const store = new ResolvedStore(memoryStorage());
  for (let i = 0; i < 520; i++) store.set(`deezer-${i}`, [A]);
  assert.equal(store.size, 500);
  assert.equal(store.get('deezer-0'), undefined);
  assert.deepEqual(store.get('deezer-519'), [A]);
});

test('apagar (vídeo denunciado) tira também do armazenamento', () => {
  const storage = memoryStorage();
  const store = new ResolvedStore(storage);
  store.set('deezer-1', [A]);
  store.delete('deezer-1');
  assert.equal(new ResolvedStore(storage).get('deezer-1'), undefined);
});

test('armazenamento ilegível, ausente ou que recusa gravar não derruba nada', () => {
  assert.equal(new ResolvedStore(memoryStorage('{não é json')).size, 0);
  assert.equal(new ResolvedStore(memoryStorage('[1,2]')).size, 0);
  const sem = new ResolvedStore(null);
  sem.set('deezer-1', [A]);
  assert.deepEqual(sem.get('deezer-1'), [A]);
  const recusa = new ResolvedStore({ getItem: () => null, setItem: () => { throw new Error('cheio'); } });
  recusa.set('deezer-1', [A]);
  assert.deepEqual(recusa.get('deezer-1'), [A]);
});

test('INV-PLAY-18: a lista guardada antes da porta de identidade (chave antiga) é descartada, não lida', () => {
  const data = new Map<string, string>([['aurastream_resolved_videos', JSON.stringify({ 'deezer-1': { ids: ['AAAAAAAAAAA'], at: Date.now() } })]]);
  const store = new ResolvedStore({ getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) });
  assert.equal(store.get('deezer-1'), undefined);
  assert.equal(data.has('aurastream_resolved_videos'), false);
});
