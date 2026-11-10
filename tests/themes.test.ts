// Temas (Ajustes > Tema): o padrão segue a aparência; o Clássico Azul é claro; o Clássico Ferro é escuro.
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTheme, themeFontUrl, themeIsLight, THEMES, THEME_LABELS } from '../src/utils/appearance';

test('um tema desconhecido ou ausente vira o padrão', () => {
  assert.equal(parseTheme(null), 'padrao');
  assert.equal(parseTheme('neon'), 'padrao');
  assert.equal(parseTheme('azul'), 'azul');
  assert.equal(parseTheme('ferro'), 'ferro');
});

test('o padrão segue a aparência escolhida; os clássicos têm claridade fixa', () => {
  assert.equal(themeIsLight('padrao', 'light', false, false), true);
  assert.equal(themeIsLight('padrao', 'dark', true, false), false);
  assert.equal(themeIsLight('padrao', 'auto', true, false), true);
  assert.equal(themeIsLight('padrao', 'auto', true, true), false, 'o app instalado no automático fica escuro');
  assert.equal(themeIsLight('azul', 'dark', false, false), true, 'o azul é claro, qualquer que seja a aparência');
  assert.equal(themeIsLight('ferro', 'light', true, false), false, 'o ferro é escuro, qualquer que seja a aparência');
});

test('os três temas têm nomes que não são marcas registradas', () => {
  assert.deepEqual(THEMES, ['padrao', 'azul', 'ferro']);
  assert.equal(THEME_LABELS.azul, 'Clássico Azul');
  assert.equal(THEME_LABELS.ferro, 'Clássico Ferro');
  for (const label of Object.values(THEME_LABELS)) assert.doesNotMatch(label, /windows|xp|winamp/i);
});

test('só o Clássico Ferro carrega a fonte de pixel; os outros temas não baixam nada a mais', () => {
  assert.equal(themeFontUrl('padrao'), null);
  assert.equal(themeFontUrl('azul'), null);
  assert.match(themeFontUrl('ferro') ?? '', /fonts\.googleapis\.com.*VT323/);
});
