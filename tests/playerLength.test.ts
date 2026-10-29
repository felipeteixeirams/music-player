import assert from 'node:assert/strict';
import test from 'node:test';
import { plausiblePlayerLength } from '../src/utils/playerLength';

test('INV-PLAY-21: o tempo do player só vale como duração perto da do catálogo (ou maior)', () => {
  assert.equal(plausiblePlayerLength(565, 8), false);
  assert.equal(plausiblePlayerLength(565, 0), false);
  assert.equal(plausiblePlayerLength(565, NaN), false);
  assert.equal(plausiblePlayerLength(565, 560), true);
  assert.equal(plausiblePlayerLength(565, 546), true);
  assert.equal(plausiblePlayerLength(565, 530), false);
  assert.equal(plausiblePlayerLength(565, 640), true, 'versão mais longa vale');
  assert.equal(plausiblePlayerLength(0, 200), true, 'sem duração de catálogo não há com o que comparar');
});
