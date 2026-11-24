import { expect, test } from '@playwright/test';
import { stubApi } from './fixtures';

// INV-UI-15: no navegador comum a página segue com viewport-fit=cover e sem as marcas do app instalado no iPhone.
test('INV-UI-15: no navegador a página mantém viewport-fit=cover e não recebe as marcas do app instalado', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Abrir ajustes' })).toBeVisible();

  const state = await page.evaluate(() => ({
    viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
    standalone: document.documentElement.hasAttribute('data-standalone'),
    editing: document.documentElement.hasAttribute('data-editing')
  }));
  expect(state.viewport).toContain('viewport-fit=cover');
  expect(state.standalone).toBe(false);
  expect(state.editing).toBe(false);
});
