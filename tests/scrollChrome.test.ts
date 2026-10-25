import assert from 'node:assert/strict';
import test from 'node:test';
import { nextCompact, swipeAction } from '../src/utils/scrollChrome';

test('nextCompact recolhe ao rolar para baixo e volta ao rolar para cima ou perto do topo', () => {
  assert.equal(nextCompact(false, 200, 100), true);
  assert.equal(nextCompact(true, 150, 200), false);
  assert.equal(nextCompact(true, 20, 30), false);
});

test('nextCompact ignora movimentos pequenos', () => {
  assert.equal(nextCompact(false, 204, 200), false);
  assert.equal(nextCompact(true, 196, 200), true);
});

test('swipeAction: esquerda avança, direita volta, respeitando o que é permitido', () => {
  const all = { next: true, previous: true };
  assert.equal(swipeAction(-90, 5, all), 'next');
  assert.equal(swipeAction(90, 5, all), 'previous');
  assert.equal(swipeAction(90, 5, { next: true, previous: false }), null);
  assert.equal(swipeAction(-90, 5, { next: false, previous: false }), null);
});

test('swipeAction ignora arrastos curtos ou mais verticais que horizontais', () => {
  const all = { next: true, previous: true };
  assert.equal(swipeAction(-30, 0, all), null);
  assert.equal(swipeAction(-80, 70, all), null);
});
