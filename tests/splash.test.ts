import assert from 'node:assert/strict';
import test from 'node:test';
import { SPLASH_MIN_MS, splashWait } from '../src/utils/splash';

test('INV-UI-14: a abertura fica pelo menos SPLASH_MIN_MS desde o início da página, e nunca tem espera negativa', () => {
  assert.equal(splashWait(0), SPLASH_MIN_MS);
  assert.equal(splashWait(300), SPLASH_MIN_MS - 300);
  assert.equal(splashWait(SPLASH_MIN_MS), 0);
  assert.equal(splashWait(5000), 0);
  assert.equal(splashWait(100, 500), 400);
});
