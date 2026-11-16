import { expect, test } from '@playwright/test';
import { stubApi, TOP_HITS } from './fixtures';

test('INV-MEDIA-04: uma capa que não carrega vira o desenho padrão, sem pedir foto a terceiros', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await stubApi(page);
  // A cover that cannot be decoded (the CDN answered with something that is not a picture)
  await page.route('**/api/category**', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const t of body.tracks ?? []) t.coverUrl = 'data:image/png;base64,AAAA';
    await route.fulfill({ response, json: body });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver todas as faixas de Top Hits' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Top Hits' })).toBeVisible();

  const cover = page.locator('main img').first();
  await expect(cover).toHaveAttribute('src', /^data:image\/svg\+xml/);
  expect(requests.filter((url) => url.includes('unsplash'))).toEqual([]);
  // The row still reads: the title is there next to the picture
  await expect(page.locator('main [role=button]', { hasText: TOP_HITS[0].title }).first()).toBeVisible();
});
