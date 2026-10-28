import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cubicBezier, easeScroll, scrollDuration } from '../src/utils/smoothScroll';

test('INV-UI-07: a rolagem ao topo começa devagar, acelera no meio e freia no fim, sem passar de 0 a 1', () => {
  assert.equal(easeScroll(0), 0);
  assert.equal(easeScroll(1), 1);
  let previous = 0;
  for (let i = 1; i <= 100; i += 1) {
    const value = easeScroll(i / 100);
    assert.ok(value >= previous - 1e-9 && value <= 1, `monótona e dentro de 0..1 em ${i}%`);
    previous = value;
  }
  assert.ok(easeScroll(0.1) < 0.08, 'começo suave: no primeiro décimo do tempo anda menos de 8% do caminho');
  assert.ok(easeScroll(0.5) > 0.6, 'o meio é rápido');
  assert.ok(easeScroll(0.9) > 0.97 && easeScroll(0.9) < 1, 'chega quase lá e termina devagar');
});

test('cubicBezier reproduz a curva linear e uma curva conhecida do CSS (ease-in-out)', () => {
  const linear = cubicBezier(0, 0, 1, 1);
  for (const t of [0.1, 0.4, 0.75]) assert.ok(Math.abs(linear(t) - t) < 1e-3);
  const easeInOut = cubicBezier(0.42, 0, 0.58, 1);
  assert.ok(Math.abs(easeInOut(0.5) - 0.5) < 1e-3, 'simétrica no meio');
});

test('a duração cresce com a distância, dentro de 450 a 750 ms', () => {
  assert.equal(scrollDuration(0), 450);
  assert.ok(scrollDuration(2000) > scrollDuration(500));
  assert.equal(scrollDuration(100000), 750);
});
