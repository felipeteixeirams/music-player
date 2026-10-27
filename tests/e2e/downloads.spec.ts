import { expect, test, type Page } from '@playwright/test';
import { nav, SILENT_PREVIEW, stubApi } from './fixtures';
import { testUser } from './supabaseMock';

async function openApp(page: Page, user: ReturnType<typeof testUser>) {
  await stubApi(page, { user, previewUrl: SILENT_PREVIEW });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
}

/** The list view of a collection: the Home carousels have no download button. */
const openTopHits = (page: Page) => page.getByRole('button', { name: 'Ver todas as faixas de Top Hits' }).click();

const downloadsRow = (page: Page) => page.getByRole('button', { name: /^Downloads/ });

test('INV-DATA-01: os downloads são de cada usuário: duas pessoas no mesmo aparelho não veem os um do outro', async ({ page, context }) => {
  const ana = testUser('ana');
  const bia = testUser('bia');

  await openApp(page, ana);
  await openTopHits(page);
  await page.getByRole('button', { name: 'Baixar para ouvir offline', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Disponível offline (Clique para remover)', exact: true }).first()).toBeVisible();
  await nav(page, 'Biblioteca').click();
  await expect(downloadsRow(page)).toContainText('1');
  await page.close();

  // Another person on the same browser: the downloads of the first are not hers
  const biaPage = await context.newPage();
  await openApp(biaPage, bia);
  await nav(biaPage, 'Biblioteca').click();
  await expect(downloadsRow(biaPage)).toContainText('0');
  await biaPage.close();

  const anaAgain = await context.newPage();
  await openApp(anaAgain, ana);
  await nav(anaAgain, 'Biblioteca').click();
  await expect(downloadsRow(anaAgain)).toContainText('1');
});

test('remover o download de uma pessoa não apaga o áudio que outra pessoa do aparelho ainda tem', async ({ page, context }) => {
  const ana = testUser('ana');
  const bia = testUser('bia');
  const cacheHas = (target: Page) =>
    target.evaluate(async () => {
      const cache = await caches.open('aurastream_offline_tracks_v1');
      return (await cache.keys()).some((request) => request.url.endsWith('/offline-audio/deezer-1'));
    });
  const toggle = async (target: Page) => {
    await openTopHits(target);
    await target.getByRole('button', { name: /^(Baixar para ouvir offline|Disponível offline \(Clique para remover\))$/ }).first().click();
  };

  await openApp(page, ana);
  await toggle(page);
  await expect(page.getByRole('button', { name: 'Disponível offline (Clique para remover)', exact: true }).first()).toBeVisible();
  await page.close();

  const biaPage = await context.newPage();
  await openApp(biaPage, bia);
  await toggle(biaPage);
  await expect(biaPage.getByRole('button', { name: 'Disponível offline (Clique para remover)', exact: true }).first()).toBeVisible();
  await biaPage.close();

  // Ana removes hers: Bia still has the file
  const anaAgain = await context.newPage();
  await openApp(anaAgain, ana);
  await openTopHits(anaAgain);
  await expect(anaAgain.getByRole('button', { name: 'Disponível offline (Clique para remover)', exact: true }).first()).toBeVisible();
  await anaAgain.getByRole('button', { name: /^(Baixar para ouvir offline|Disponível offline \(Clique para remover\))$/ }).first().click();
  await expect(anaAgain.getByRole('button', { name: 'Baixar para ouvir offline', exact: true }).first()).toBeVisible();
  expect(await cacheHas(anaAgain)).toBe(true);

  // Bia removes hers too: now nobody lists it and the file goes
  await anaAgain.close();
  const biaAgain = await context.newPage();
  await openApp(biaAgain, bia);
  await toggle(biaAgain);
  await expect(biaAgain.getByRole('button', { name: 'Baixar para ouvir offline', exact: true }).first()).toBeVisible();
  expect(await cacheHas(biaAgain)).toBe(false);
});

test('os downloads de antes das contas passam para quem entra primeiro', async ({ page }) => {
  const user = testUser();
  const stored = { id: 'deezer-1', title: 'Primeira Faixa', artist: 'Artista Um', album: 'A', duration: 180, coverUrl: '', style: 'x', categoryId: 'web', sources: { localUrl: '' } };
  await page.addInitScript(
    (meta) => {
      if (localStorage.getItem('legacy-seeded')) return;
      localStorage.setItem('legacy-seeded', '1');
      localStorage.setItem('aurastream_offline_track_ids', '["deezer-1"]');
      localStorage.setItem('aurastream_offline_track_meta', meta);
    },
    JSON.stringify({ 'deezer-1': stored })
  );
  await openApp(page, user);
  await nav(page, 'Biblioteca').click();
  await expect(downloadsRow(page)).toContainText('1');
  expect(await page.evaluate(() => localStorage.getItem('aurastream_offline_track_ids'))).toBeNull();
});

test('INV-PREV-04: baixar uma prévia cujo link venceu pede um link novo antes de copiar o áudio', async ({ page }) => {
  const requests = await stubApi(page, { user: testUser('vencida'), stalePreview: true });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await openTopHits(page);
  await page.getByRole('button', { name: 'Baixar para ouvir offline', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Disponível offline (Clique para remover)', exact: true }).first()).toBeVisible();

  // The copy went through the proxy with the new address, not the expired one
  expect(requests.some((r) => r.startsWith('/api/search?preview='))).toBe(true);
  const copies = requests.filter((r) => r.startsWith('/api/audio?url='));
  expect(copies).toHaveLength(1);
  expect(decodeURIComponent(copies[0])).toContain('fresh=1');
});
