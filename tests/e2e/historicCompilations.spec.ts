import { expect, test } from '@playwright/test';
import { nav, stubApi } from './fixtures';

test('historic compilation recognition surfaces Lovy Metal card and allows play and saving', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');

  // Navigate to Search tab
  await nav(page, 'Buscar').click();
  const searchInput = page.getByRole('searchbox', { name: 'Buscar' });
  await expect(searchInput).toBeVisible();

  // Type "love metal" in search input
  await searchInput.fill('love metal');

  // Compilation banner should be visible immediately
  await expect(page.getByText('Coletânea Histórica Detectada')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Lovy Metal/i })).toBeVisible();
  await expect(page.getByText(/CD Som Livre/i)).toBeVisible();

  // Test expanding tracklist
  await page.getByRole('button', { name: /Ver faixas/i }).click();
  await expect(page.getByText('Silent Lucidity')).toBeVisible();
  await expect(page.getByText('Still Loving You')).toBeVisible();

  // Test saving to library
  await page.getByRole('button', { name: /Salvar Playlist/i }).click();
  await expect(page.getByText('Salvo na Biblioteca!')).toBeVisible();
});

test('historic compilation recognition works for Good Times and Classic Metal', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');

  await nav(page, 'Buscar').click();
  const searchInput = page.getByRole('searchbox', { name: 'Buscar' });
  await expect(searchInput).toBeVisible();

  // Test "good times"
  await searchInput.fill('good times som livre');
  await expect(page.getByRole('heading', { name: /Good Times/i })).toBeVisible();
  await expect(page.getByText('CD Som Livre · 98 FM')).toBeVisible();

  // Test "classic metal"
  await searchInput.fill('classic metal');
  await expect(page.getByRole('heading', { name: /Classic Metal/i })).toBeVisible();
});

test('salvar a mesma coletânea de novo não cria outra playlist com o mesmo nome', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  await nav(page, 'Buscar').click();
  const searchInput = page.getByRole('searchbox', { name: 'Buscar' });
  await searchInput.fill('love metal');
  await page.getByRole('button', { name: /Salvar Playlist/i }).click();
  await expect(page.getByText('Salvo na Biblioteca!')).toBeVisible();

  // A new visit (the same account, after a reload): the card offers saving again, the name is already taken
  await page.reload();
  await nav(page, 'Buscar').click();
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('love metal');
  await page.getByRole('button', { name: /Salvar Playlist/i }).click();
  await expect(page.getByText('Salvo na Biblioteca!')).toBeVisible();

  await nav(page, 'Biblioteca').click();
  await page.getByRole('button', { name: /^Playlists/ }).click();
  await expect(page.getByText('Lovy Metal (Som Livre)')).toHaveCount(1);
});
