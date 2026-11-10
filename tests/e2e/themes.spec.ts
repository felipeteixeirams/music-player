import { expect, test } from '@playwright/test';
import { nav, stubApi } from './fixtures';

const canvas = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim());

async function chooseTheme(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('radio', { name }).click();
  await page.getByRole('button', { name: 'Fechar ajustes' }).click().catch(() => undefined);
}

test('escolher o Clássico Azul muda as cores e a escolha fica depois de recarregar', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  await chooseTheme(page, 'Clássico Azul');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('azul');
  expect(await canvas(page)).toBe('#eef3fa');
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('scheme-light'))).toBe(true);

  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('azul');
});

test('o Clássico Ferro é escuro com a cor própria, e o padrão volta quando escolhido', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  const standard = await canvas(page);
  await chooseTheme(page, 'Clássico Ferro');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('ferro');
  expect(await canvas(page)).toBe('#15181c');
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('scheme-light'))).toBe(false);

  await chooseTheme(page, 'Padrão');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('padrao');
  expect(await canvas(page)).toBe(standard);
});
