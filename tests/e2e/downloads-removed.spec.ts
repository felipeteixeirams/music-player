import { expect, test } from '@playwright/test';
import { nav, stubApi } from './fixtures';

test('INV-UI-02: o app não oferece download: sem botão nas faixas e sem a seção Downloads na Biblioteca', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();

  await page.getByRole('button', { name: 'Ver todas as faixas de Top Hits' }).click();
  await expect(page.getByRole('button', { name: 'Adicionar aos favoritos' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /offline/i })).toHaveCount(0);

  await nav(page, 'Biblioteca').click();
  await expect(page.getByRole('navigation', { name: 'Seções da biblioteca' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Downloads/ })).toHaveCount(0);
});

test('INV-UI-03: o que o download de prévia deixou no aparelho é removido uma vez (áudio guardado e listas de todas as pessoas)', async ({ page }) => {
  await stubApi(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('seeded-legacy')) return;
    localStorage.setItem('seeded-legacy', '1');
    localStorage.setItem('aurastream_offline_track_ids', '["deezer-1"]');
    localStorage.setItem('aurastream_offline_track_ids:ana', '["deezer-1","deezer-2"]');
    localStorage.setItem('aurastream_offline_track_meta:ana', '{}');
    localStorage.setItem('aurastream_liked_track_objects:ana', '[]');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  // The cache entry is made after the first load of the page (the init script runs before the app)
  await page.evaluate(async () => {
    const cache = await caches.open('aurastream_offline_tracks_v1');
    await cache.put('/offline-audio/deezer-1', new Response('x'));
    localStorage.removeItem('aurastream_downloads_purged_v1');
  });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();

  await expect.poll(() => page.evaluate(() => caches.has('aurastream_offline_tracks_v1'))).toBe(false);
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('aurastream_offline_')));
  expect(keys).toEqual([]);
  // Only the downloads go: what is the person's own stays
  expect(await page.evaluate(() => localStorage.getItem('aurastream_liked_track_objects:ana'))).toBe('[]');
  expect(await page.evaluate(() => localStorage.getItem('aurastream_downloads_purged_v1'))).toBe('1');
});
