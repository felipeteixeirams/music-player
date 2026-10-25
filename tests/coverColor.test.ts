import assert from 'node:assert/strict';
import test from 'node:test';
import { darkenForText, pickDominantColor } from '../src/utils/coverColor';

const pixels = (...rgba: number[][]) => rgba.flat();

test('pickDominantColor escolhe a cor mais presente e ignora pixels transparentes', () => {
  const data = pixels(
    ...Array(10).fill([220, 30, 40, 255]),
    ...Array(3).fill([20, 20, 200, 255]),
    ...Array(50).fill([0, 255, 0, 0])
  );
  const [r, g, b] = pickDominantColor(data)!;
  assert.ok(r > 180 && g < 80 && b < 80, `esperava vermelho, veio ${[r, g, b]}`);
});

test('pickDominantColor prefere uma cor viva a um fundo quase preto', () => {
  const data = pixels(...Array(12).fill([5, 5, 5, 255]), ...Array(8).fill([40, 120, 220, 255]));
  const [r, , b] = pickDominantColor(data)!;
  assert.ok(b > r, 'esperava azul');
});

test('pickDominantColor devolve null sem pixels visíveis', () => {
  assert.equal(pickDominantColor([]), null);
  assert.equal(pickDominantColor(pixels([10, 10, 10, 0])), null);
});

test('darkenForText escurece cores claras e preserva as escuras', () => {
  const [r, g, b] = darkenForText([255, 200, 100]);
  assert.ok(Math.max(r, g, b) <= 108);
  assert.deepEqual(darkenForText([40, 20, 10]), [40, 20, 10]);
});
