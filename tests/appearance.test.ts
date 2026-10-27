import test from 'node:test';
import assert from 'node:assert/strict';
import { isLightScheme, parseAppearance } from '../src/utils/appearance';

test('INV-UI-04: Automático segue o sistema só no navegador; Claro e Escuro valem sempre', () => {
  assert.equal(isLightScheme('auto', true, false), true);
  assert.equal(isLightScheme('auto', true, true), false);
  assert.equal(isLightScheme('auto', false, false), false);
  assert.equal(isLightScheme('light', false, true), true);
  assert.equal(isLightScheme('dark', true, false), false);
});

test('a escolha guardada inválida vira Automático', () => {
  assert.equal(parseAppearance('light'), 'light');
  assert.equal(parseAppearance('dark'), 'dark');
  assert.equal(parseAppearance('x'), 'auto');
  assert.equal(parseAppearance(null), 'auto');
});
