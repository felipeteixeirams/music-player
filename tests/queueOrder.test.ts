import assert from 'node:assert/strict';
import test from 'node:test';
import { moveQueueItem } from '../src/utils/queueOrder';

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
