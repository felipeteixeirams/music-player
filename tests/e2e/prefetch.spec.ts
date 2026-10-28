import { expect, test, type Page } from '@playwright/test';
import { fakeYouTube, loadedVideo, stubApi, TOP_HITS } from './fixtures';

const CACHED = 'AAAAAAAAAAA';
const SEARCHED = 'BBBBBBBBBBB';
const topHit = (page: Page, index: number) => page.locator('section[aria-label="Top Hits"] [role=button]').nth(index);

async function openApp(page: Page, options: Parameters<typeof stubApi>[1]) {
  // The hidden YouTube player is a fake here; only the video it is asked to load matters
  await fakeYouTube(page);
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
  await expect.poll(() => loadedVideo(page)).toBe(CACHED);
  expect(resolveCalls(requests)).toEqual([]);
});

test('faixa que ninguém tocou ainda faz a busca no toque, uma vez só', async ({ page }) => {
  const requests = await openApp(page, { videoIds: [SEARCHED], cachedVideos: { [TOP_HITS[0].id]: [CACHED] }, lookups: [] });
  await page.waitForTimeout(800);

  await topHit(page, 1).click();
  await expect.poll(() => loadedVideo(page)).toBe(SEARCHED);
  expect(resolveCalls(requests)).toHaveLength(1);
});

test('INV-PLAY-02: o que foi descoberto fica no aparelho: tocar de novo depois de recarregar não pergunta nada', async ({ page }) => {
  const requests = await openApp(page, { videoIds: [SEARCHED], lookups: [] });
  await topHit(page, 1).click();
  await expect.poll(() => loadedVideo(page)).toBe(SEARCHED);
  expect(resolveCalls(requests)).toHaveLength(1);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  const before = resolveCalls(requests).length;
  await topHit(page, 1).click();
  await expect.poll(() => loadedVideo(page)).toBe(SEARCHED);
  expect(resolveCalls(requests).length).toBe(before);
});

test.describe('pré-resolução antes do toque', () => {
  const VIDEO = 'aaaaaaaaaaa';

  test('INV-PLAY-14: as 2 primeiras faixas do cartão do Humor são procuradas em tempo ocioso, uma por vez, e tocar a primeira não pergunta de novo', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 9, 28, 20, 0, 0));
    const warms: string[] = [];
    const requests = await stubApi(page, { videoIds: [VIDEO], warms });
    await page.goto('/');
    await expect(page.locator('[data-mix="mood"]')).toBeVisible();

    // After the pause the app asks, one by one, with warm=1 (the first two of the card)
    await expect.poll(() => warms.length, { timeout: 15_000 }).toBe(2);
    expect(requests.filter((r) => r.startsWith('/api/resolve?') && r.includes('warm=1')).length).toBe(2);
    expect(warms.every((id) => /^deezer-\d+$/.test(id))).toBe(true);
    // It stays at two: the rest of the card is for the tap
    await page.waitForTimeout(3500);
    expect(warms.length).toBe(2);

    // The first track of the card was looked up ahead: tapping Reproduzir asks the server for nothing more
    const searchesBefore = requests.filter((r) => r.startsWith('/api/resolve?') && !r.includes('warm=1')).length;
    await page.locator('[data-mix="mood"]').click();
    await page.getByRole('button', { name: 'Reproduzir', exact: true }).click();
    await page.waitForTimeout(800);
    expect(requests.filter((r) => r.startsWith('/api/resolve?') && !r.includes('warm=1')).length).toBe(searchesBefore);
  });

  test('INV-PLAY-14: quando o servidor diz que a parte da cota para isso acabou, o app para e não insiste', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 9, 28, 20, 0, 0));
    const warms: string[] = [];
    await stubApi(page, { warmSkipped: true, warms });
    await page.goto('/');
    await expect(page.locator('[data-mix="mood"]')).toBeVisible();
    await expect.poll(() => warms.length, { timeout: 15_000 }).toBe(1);
    await page.waitForTimeout(3500);
    expect(warms.length, 'uma recusa encerra a pré-resolução do dia').toBe(1);
    // The day is remembered on the device: after a reload nothing is asked
    await page.reload();
    await expect(page.locator('[data-mix="mood"]')).toBeVisible();
    await page.waitForTimeout(4500);
    expect(warms.length).toBe(1);
  });
});

test.describe('fila com o limite de faixas novas esgotado', () => {
  test('INV-PLAY-16: a fila pula as faixas sem vídeo, vai para a próxima de vídeo conhecido e avisa uma vez; a faixa tocada pelo dedo nunca é pulada', async ({ page }) => {
    // Tracks 1 and 4 have a known video; the allowance of new tracks is spent (any other track is refused)
    const requests = await openApp(page, { quotaExceeded: true, cachedVideos: { [TOP_HITS[0].id]: [CACHED], [TOP_HITS[3].id]: [SEARCHED] }, lookups: [] });
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    await page.waitForTimeout(800);

    await topHit(page, 0).click();
    await expect.poll(() => loadedVideo(page)).toBe(CACHED);
    // The rest of the list (track 4 among it) is loaded and looked up while the first plays
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: 'Avançar para a próxima faixa' }).click();
    // Track 2 has no video and no allowance: passed over; the queue goes to track 4, whose video is known
    await expect.poll(() => loadedVideo(page), { timeout: 8000 }).toBe(SEARCHED);
    await expect(page.getByText(/Puladas \d+ faixas? sem vídeo: você chegou ao limite de faixas novas de hoje/)).toBeVisible();
  });

  test('INV-PLAY-16: tocar uma faixa sem vídeo com o limite esgotado ainda toca a prévia, com o aviso de sempre', async ({ page }) => {
    await fakeYouTube(page);
    await stubApi(page, { quotaExceeded: true, previewUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
    await topHit(page, 1).click();
    await expect(page.getByText(/limite de faixas novas de hoje\. Tocando a prévia de 30s/)).toBeVisible();
  });
});
