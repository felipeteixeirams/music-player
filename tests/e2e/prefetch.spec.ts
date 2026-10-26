import { expect, test, type Page } from '@playwright/test';
import { stubApi, TOP_HITS } from './fixtures';

const CACHED = 'AAAAAAAAAAA';
const SEARCHED = 'BBBBBBBBBBB';
const topHit = (page: Page, index: number) => page.locator('section[aria-label="Top Hits"] [role=button]').nth(index);
const player = (page: Page) => page.locator('youtube-video');

async function openApp(page: Page, options: Parameters<typeof stubApi>[1]) {
  // The hidden YouTube player loads a blank page here; only its address matters
  await page.route(/youtube\.com|ytimg\.com|googlevideo\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '' }));
  const requests = await stubApi(page, options);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  return requests;
}

const resolveCalls = (requests: string[]) => requests.filter((r) => r.startsWith('/api/resolve?') && !r.includes('usage'));

test('a tela pergunta ao cache compartilhado, em lote, por quais faixas já têm vídeo', async ({ page }) => {
  const lookups: string[][] = [];
  await openApp(page, { lookups });
  await expect.poll(() => lookups.length).toBeGreaterThan(0);
  // One request for everything on the Home, not one per list
  expect(lookups.length).toBeLessThanOrEqual(2);
  const asked = lookups.flat();
  expect(asked).toContain(TOP_HITS[0].id);
  expect(new Set(asked).size).toBe(asked.length);
});

test('INV-PLAY-02: faixa que já está no cache toca sem esperar o servidor: nenhuma busca no toque', async ({ page }) => {
  const requests = await openApp(page, { videoIds: [SEARCHED], cachedVideos: { [TOP_HITS[0].id]: [CACHED] }, lookups: [] });
  // Give the lookup time to answer before the tap
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  await page.waitForTimeout(800);

  await topHit(page, 0).click();
  await expect(player(page)).toHaveAttribute('src', new RegExp(CACHED));
  expect(resolveCalls(requests)).toEqual([]);
});

test('faixa que ninguém tocou ainda faz a busca no toque, uma vez só', async ({ page }) => {
  const requests = await openApp(page, { videoIds: [SEARCHED], cachedVideos: { [TOP_HITS[0].id]: [CACHED] }, lookups: [] });
  await page.waitForTimeout(800);

  await topHit(page, 1).click();
  await expect(player(page)).toHaveAttribute('src', new RegExp(SEARCHED));
  expect(resolveCalls(requests)).toHaveLength(1);
});

test('INV-PLAY-02: o que foi descoberto fica no aparelho: tocar de novo depois de recarregar não pergunta nada', async ({ page }) => {
  const requests = await openApp(page, { videoIds: [SEARCHED], lookups: [] });
  await topHit(page, 1).click();
  await expect(player(page)).toHaveAttribute('src', new RegExp(SEARCHED));
  expect(resolveCalls(requests)).toHaveLength(1);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  const before = resolveCalls(requests).length;
  await topHit(page, 1).click();
  await expect(player(page)).toHaveAttribute('src', new RegExp(SEARCHED));
  expect(resolveCalls(requests).length).toBe(before);
});
