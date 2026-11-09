import { expect, test, type Page } from '@playwright/test';
import { nav, stubApi } from './fixtures';

// The catalog files are published as static files (public/historic); the test serves a small copy of them, so it does
// not depend on the generated catalog (scripts/build-historic-compilations.mjs) changing.
const INDEX = {
  generatedAt: '2026-11-08',
  source: 'teste',
  compilations: [
    { id: 'm3', title: 'Lovy Metal 1', base: 'lovy metal', year: 2001, catno: '23282', tracks: 2, matched: 1 },
    { id: 'm4', title: 'Lovy Metal 3', base: 'lovy metal', year: 2003, catno: '23284', tracks: 1, matched: 0 }
  ]
};
const RECORD_3 = {
  id: 'm3',
  title: 'Lovy Metal 1',
  base: 'lovy metal',
  year: 2001,
  catno: '23282',
  label: 'Som Livre',
  country: 'Brazil',
  tracks: 2,
  matched: 1,
  // The first track has a Deezer id (the catalog's track); the second plays by title and artist
  trackList: [
    { position: '1', title: 'Silent Lucidity', artist: 'Queensrÿche', duration: '5:07', deezerId: 1234 },
    { position: '2', title: 'Still Loving You', artist: 'Scorpions', duration: '6:23', deezerId: null }
  ]
};

async function serveCatalog(page: Page) {
  await page.route('**/historic/index.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(INDEX) }));
  await page.route('**/historic/t/m3.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...RECORD_3, tracks: RECORD_3.trackList }) })
  );
  await page.route('**/historic/t/m4.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...RECORD_3, id: 'm4', title: 'Lovy Metal 3', year: 2003, tracks: [] }) })
  );
}

test('INV-CAT-02: buscar o nome da série mostra os CDs dela, com as faixas e a opção de salvar', async ({ page }) => {
  await stubApi(page);
  await serveCatalog(page);
  await page.goto('/');
  await nav(page, 'Buscar').click();
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('lovy metal');

  await expect(page.getByRole('heading', { name: 'Lovy Metal 1' })).toBeVisible();
  await expect(page.getByText('CD Som Livre · 2001')).toBeVisible();
  await page.getByRole('button', { name: /Ver faixas/i }).first().click();
  await expect(page.getByText('Silent Lucidity')).toBeVisible();

  await page.getByRole('button', { name: 'Salvar Playlist' }).first().click();
  await expect(page.getByText('Salvo na Biblioteca!').first()).toBeVisible();
});

test('INV-CAT-03: uma busca por artista não mostra nenhum CD', async ({ page }) => {
  await stubApi(page);
  await serveCatalog(page);
  await page.goto('/');
  await nav(page, 'Buscar').click();
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('love metal iron maiden');

  await expect(page.getByLabel(/Coletânea histórica/)).toHaveCount(0);
});

test('salvar o mesmo CD de novo não cria outra playlist com o mesmo nome', async ({ page }) => {
  await stubApi(page);
  await serveCatalog(page);
  await page.goto('/');
  await nav(page, 'Buscar').click();
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('lovy metal');
  await page.getByRole('button', { name: 'Salvar Playlist' }).first().click();
  await expect(page.getByText('Salvo na Biblioteca!').first()).toBeVisible();

  // A new visit (the same account, after a reload): the name is already taken, so nothing is created
  await page.reload();
  await nav(page, 'Buscar').click();
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('lovy metal');
  await page.getByRole('button', { name: 'Salvar Playlist' }).first().click();
  await expect(page.getByText('Salvo na Biblioteca!').first()).toBeVisible();

  await nav(page, 'Biblioteca').click();
  await page.getByRole('button', { name: /^Playlists/ }).click();
  await expect(page.getByText('Lovy Metal 1 (Som Livre)')).toHaveCount(1);
});
