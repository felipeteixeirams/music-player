import assert from 'node:assert/strict';
import test from 'node:test';
import { moveQueueItem, queueWithAppended, queueWithNext } from '../src/utils/queueOrder';

const LIST = ['atual', 'a', 'b', 'c', 'd'];

test('INV-UI-12: mover uma faixa da fila para baixo e para cima mantém as outras na ordem', () => {
  assert.deepEqual(moveQueueItem(LIST, 1, 3, 1), ['atual', 'b', 'c', 'a', 'd']);
  assert.deepEqual(moveQueueItem(LIST, 4, 1, 1), ['atual', 'd', 'a', 'b', 'c']);
});

test('INV-UI-12: a faixa que toca e as já tocadas não se movem, e posições inválidas devolvem a mesma lista', () => {
  assert.equal(moveQueueItem(LIST, 0, 2, 1), LIST, 'a atual não sai do lugar');
  assert.equal(moveQueueItem(LIST, 2, 0, 1), LIST, 'nada passa para antes da atual');
  assert.equal(moveQueueItem(LIST, 2, 9, 1), LIST);
  assert.equal(moveQueueItem(LIST, 2, 2, 1), LIST);
  assert.equal(moveQueueItem(LIST, 1.5, 2, 1), LIST);
});

test('INV-PLAY-28: tocar a seguir põe a faixa logo depois da que toca; adicionar à fila põe no fim; sem faixa tocando, vai para o fim', () => {
  const list = ['a', 'b', 'c'];
  assert.deepEqual(queueWithNext(list, 0, 'x'), ['a', 'x', 'b', 'c']);
  assert.deepEqual(queueWithNext(list, 2, 'x'), ['a', 'b', 'c', 'x']);
  assert.deepEqual(queueWithNext(list, -1, 'x'), ['a', 'b', 'c', 'x']);
  assert.deepEqual(queueWithNext(list, 9, 'x'), ['a', 'b', 'c', 'x']);
  assert.deepEqual(queueWithAppended(list, 'x'), ['a', 'b', 'c', 'x']);
  // The list it was given is not changed
  assert.deepEqual(list, ['a', 'b', 'c']);
});
