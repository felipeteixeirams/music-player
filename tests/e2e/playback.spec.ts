import { expect, test, type Page } from '@playwright/test';
import { silentClip, stubApi } from './fixtures';

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

test('INV-PLAY-07: faixa nova com prévia toca a prévia no primeiro toque enquanto o vídeo carrega, e "Ouvir completa" assume', async ({ page }) => {
  await openApp(page, { videoIds: [FIRST], previewUrl: silentClip(20) });
  // The search for a track nobody played yet takes a while: the preview must not wait for it
  await page.route('**/api/resolve?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videoIds: [FIRST] }) });
  });
  await topHit(page).click();
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible();

  // Sound before the video is even known, and no "the iPhone did not let it start" notice
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  await expect(page.getByTestId('playback-log')).toContainText('começou a tocar (áudio do navegador)');
  await page.getByRole('button', { name: 'Fechar ajustes' }).click();
  await expect(page.getByText(/não deixou a música começar sozinha/)).toHaveCount(0);

  // The video's player loads but is not allowed to start: the preview keeps playing and the full track is a button
  const full = page.getByRole('button', { name: 'Ouvir completa' });
  await expect(full).toBeVisible({ timeout: 15_000 });
  await expect(miniPlay(page)).toHaveAccessibleName('Pausar música');

  await full.click();
  await expect(full).toHaveCount(0);
  await expect(miniPlay(page)).toHaveAccessibleName('Pausar música');
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
