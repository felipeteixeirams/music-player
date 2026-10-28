import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowsWebGlBackground } from '../src/utils/webglBackground';

test('INV-AUTH-05: o fundo WebGL do login fica desligado no Android e ligado no iPhone e no computador', () => {
  const redmi = 'Mozilla/5.0 (Linux; Android 13; 23028RN4DG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const desktop = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  assert.equal(allowsWebGlBackground(redmi), false);
  assert.equal(allowsWebGlBackground(iphone), true);
  assert.equal(allowsWebGlBackground(desktop), true);
});
