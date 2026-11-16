import { expect, test } from '@playwright/test';
import { stubApi } from './fixtures';

test('INV-UI-14: a abertura aparece já no HTML, enquanto o script do app ainda não chegou, e sai depois que o app monta', async ({ page }) => {
  await stubApi(page);
  // The app's script arrives late: the opening screen is what the person sees until then
  await page.route(/\/assets\/.*\.js$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  const loaded = page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#splash')).toBeVisible();
  await loaded;
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await expect(page.locator('#splash')).toHaveCount(0);
});
