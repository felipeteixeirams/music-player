import { expect, test, type Page } from '@playwright/test';
import { fakeYouTube, silentClip, stubApi } from './fixtures';

const FIRST = 'AAAAAAAAAAA';
const topHit = (page: Page) => page.locator('section[aria-label="Top Hits"] [role=button]').first();
const miniPlay = (page: Page) => page.getByRole('button', { name: /^(Pausar|Reproduzir) música$/ });

async function openApp(page: Page, options: Parameters<typeof stubApi>[1]) {
  // The hidden YouTube player loads a blank page here: it never plays, like an iPhone that refuses to start it
  await page.route(/youtube\.com|ytimg\.com|googlevideo\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '' }));
  await stubApi(page, options);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
}

test('INV-PLAY-01: a faixa completa que o navegador não deixa começar sozinha não finge que toca: avisa e o ▶ resolve', async ({ page }) => {
  await openApp(page, { videoIds: [FIRST] });
  await topHit(page).click();
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible();

  // Seconds of silence: the screen admits it, and shows ▶ so the next tap (allowed by the browser) can start it
  await expect(page.getByText(/não deixou a música começar sozinha/).first()).toBeVisible({ timeout: 12_000 });
  await expect(miniPlay(page)).toHaveAccessibleName('Reproduzir música');

  // The tap on ▶ takes the notice away at once and asks the player to play
  await miniPlay(page).click();
  await expect(page.getByText(/não deixou a música começar sozinha/)).toHaveCount(0);
  await expect(miniPlay(page)).toHaveAccessibleName('Pausar música');
});

test('INV-PLAY-07: faixa nova com prévia toca a prévia no primeiro toque, e a faixa completa assume sozinha quando o player começa', async ({ page }) => {
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST], previewUrl: silentClip(20) });
  // The search for a track nobody played yet takes a while: the preview must not wait for it
  await page.route('**/api/resolve?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videoIds: [FIRST] }) });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await topHit(page).click();
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible();

  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  const log = page.getByTestId('playback-log');
  await expect(log).toContainText('começou a tocar (áudio do navegador)');
  await expect(log).toContainText('faixa completa assumiu no lugar da prévia', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Fechar ajustes' }).click();
  await expect(page.getByText(/não deixou a música começar sozinha/)).toHaveCount(0);
  await expect(miniPlay(page)).toHaveAccessibleName('Pausar música');
});

test('INV-PLAY-08: o player do YouTube é criado no toque, antes de o vídeo ser conhecido, e as faixas seguintes reaproveitam o mesmo', async ({ page }) => {
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST] });
  await page.route('**/api/resolve?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videoIds: [FIRST] }) });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  expect(await page.locator('iframe[src*="youtube.com/embed"]').count()).toBe(0);

  await topHit(page).click();
  // The tap itself made the frame; the search (1.2 s) is still running and no video was asked for yet
  await expect(page.locator('iframe[src*="youtube.com/embed"]')).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).__yt?.loads ?? [])).toEqual([]);

  // The video is loaded into that frame once it is known
  await expect.poll(() => page.evaluate(() => (window as any).__yt.loads)).toEqual([FIRST]);

  await page.locator('section[aria-label="Top Hits"] [role=button]').nth(1).click();
  await expect.poll(() => page.evaluate(() => (window as any).__yt.loads.length)).toBe(2);
  expect(await page.evaluate(() => (window as any).__yt.created)).toBe(1);
  await expect(page.locator('iframe[src*="youtube.com/embed"]')).toHaveCount(1);
});

test('INV-PLAY-09: se o navegador não deixa a faixa completa começar, o app tenta de novo sozinho, sem botão nem aviso de ação', async ({ page }) => {
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST], previewUrl: silentClip(25) });
  await page.addInitScript(() => { (window as any).__ytMode = 'blocked'; });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await topHit(page).click();
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible();

  // Blocked: the preview plays and the player is asked again by itself
  await expect.poll(() => page.evaluate(() => (window as any).__yt?.plays ?? 0), { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('button', { name: 'Ouvir completa' })).toHaveCount(0);
  await expect(miniPlay(page)).toHaveAccessibleName('Pausar música');

  // The browser lets it through (the next try works): the full track takes over without any tap
  await page.evaluate(() => { (window as any).__ytAllow = true; });
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  await expect(page.getByTestId('playback-log')).toContainText('faixa completa assumiu no lugar da prévia', { timeout: 10_000 });
});

test('a prévia toca no primeiro toque, sem aviso nem segundo toque', async ({ page }) => {
  await openApp(page, { previewUrl: silentClip(8) });
  await topHit(page).click();
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible();
  await page.waitForTimeout(3500);
  await expect(page.getByText(/não deixou a música começar sozinha/)).toHaveCount(0);
  await expect(miniPlay(page)).toHaveAccessibleName('Pausar música');
});

test('o diagnóstico de reprodução conta o que aconteceu, nos Ajustes', async ({ page }) => {
  await openApp(page, { previewUrl: silentClip(8) });
  await topHit(page).click();
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible();
  await expect.poll(async () => (await page.evaluate(() => document.title)).length).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  // The report opens with the build and whether this is the installed app or a browser tab
  await expect(page.getByTestId('playback-environment')).toContainText(/versão .+ · NAVEGADOR · /);
  const log = page.getByTestId('playback-log');
  await expect(log).toContainText('toque em "Primeira Faixa"');
  await expect(log).toContainText('começou a tocar (áudio do navegador)');
});

test('INV-PLAY-05: sair do app e voltar com a prévia tocando não pausa a faixa nem avisa nada', async ({ page }) => {
  await openApp(page, { previewUrl: silentClip(12) });
  await topHit(page).click();
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible();

  const setVisibility = (state: 'hidden' | 'visible') =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await setVisibility('hidden');
  await page.waitForTimeout(1200);
  await setVisibility('visible');
  await page.waitForTimeout(2200);

  await expect(miniPlay(page)).toHaveAccessibleName('Pausar música');
  await expect(page.getByText(/pausou a faixa completa ao sair do app/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  await expect(page.getByTestId('playback-log')).toContainText('app em segundo plano (tocando');
});
