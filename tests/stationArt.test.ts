import assert from 'node:assert/strict';
import test from 'node:test';
import { stationColor, stationInitials } from '../src/utils/stationArt';

test('stationColor é estável para a mesma estação e sempre uma cor da paleta', () => {
  assert.equal(stationColor('mix-fm'), stationColor('mix-fm'));
  assert.match(stationColor('kiss-fm'), /^#[0-9a-f]{6}$/);
});

test('stationInitials usa as palavras que identificam a estação', () => {
  assert.equal(stationInitials('Mix FM'), 'MI');
  assert.equal(stationInitials('Antena 1'), 'A1');
  assert.equal(stationInitials('Metropolitana Pop'), 'MP');
  assert.equal(stationInitials('89 FM A Rádio Rock'), '8R');
  assert.equal(stationInitials('Cidade 102.9'), 'CI');
  assert.equal(stationInitials('Clube FM 105.5'), 'CL');
  assert.equal(stationInitials('FM'), 'FM');
  assert.equal(stationInitials('  '), '·');
});
