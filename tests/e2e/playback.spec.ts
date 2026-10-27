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

  await topHit(page).click();
  // The frame exists by the tap (made at rest or by the tap itself); the search (1.2 s) is still running and no video was asked for yet
  await expect(page.locator('iframe[src*="youtube.com/embed"]')).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).__yt?.loads ?? [])).toEqual([]);

  // The video is loaded into that frame once it is known
  await expect.poll(() => page.evaluate(() => (window as any).__yt.loads)).toEqual([FIRST]);

  await page.locator('section[aria-label="Top Hits"] [role=button]').nth(1).click();
  await expect.poll(() => page.evaluate(() => (window as any).__yt.loads.length)).toBe(2);
  expect(await page.evaluate(() => (window as any).__yt.created)).toBe(1);
  await expect(page.locator('iframe[src*="youtube.com/embed"]')).toHaveCount(1);
});

test('INV-PLAY-08: tocar uma rádio também cria o player do YouTube no toque, antes de as faixas da estação chegarem', async ({ page }) => {
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST] });
  await page.route('**/api/radio?id=*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fallback();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await page.locator('nav[aria-label="Navegação Principal"] button[aria-label="Rádio"]').click();

  await page.getByRole('button', { name: 'Tocar a rádio Estação Pop' }).click();
  // The tap made the frame; the station's tracks are still on their way
  await expect(page.locator('iframe[src*="youtube.com/embed"]')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (window as any).__yt.loads)).toEqual([FIRST]);
});

test('INV-PLAY-10: o player fica pronto antes do toque, sem tocar nada, e o toque só carrega o vídeo real (nada de vídeo-reserva)', async ({ page }) => {
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST], previewUrl: silentClip(20) });
  await page.route('**/api/resolve?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videoIds: [FIRST] }) });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  // At rest the frame is made and gets ready, with no tap and nothing playing
  await expect.poll(() => page.evaluate(() => (window as any).__yt?.created ?? 0), { timeout: 8000 }).toBe(1);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__yt.log)).toEqual([]);

  await topHit(page).click();
  // The preview starts at once; the player is not asked to play anything until the real video is known
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__yt.log)).toEqual([]);
  await expect.poll(() => page.evaluate(() => (window as any).__yt.log[0])).toBe(`load:${FIRST}`);
  expect(await page.evaluate(() => (window as any).__yt.created)).toBe(1);
});

test('INV-PLAY-11: uma prévia recusada pelo navegador aparece no relatório e a faixa segue pelo player do YouTube, sem fingir que a prévia toca', async ({ page }) => {
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST], previewUrl: silentClip(20) });
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      // The real preview is refused (as the iPhone does outside a tap); the tiny unlock clip is not
      if (this.src.length > 5000) return Promise.reject(new DOMException('refused', 'NotAllowedError'));
      return original.call(this);
    };
  });
  await page.route('**/api/resolve?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videoIds: [FIRST] }) });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await topHit(page).click();
  await expect.poll(() => page.evaluate(() => (window as any).__yt?.loads ?? [])).toEqual([FIRST]);

  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  await expect(page.getByTestId('playback-log')).toContainText('a prévia foi recusada pelo navegador (NotAllowedError)');
});

test('INV-PREV-03: uma prévia com o link vencido pede um link novo e toca, sem aviso nem segundo toque', async ({ page }) => {
  await fakeYouTube(page);
  const requests = await stubApi(page, { stalePreview: true });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await topHit(page).click();
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible();
  await expect.poll(() => requests.filter((r) => r.startsWith('/api/search?preview=')).length).toBe(1);

  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  const log = page.getByTestId('playback-log');
  await expect(log).toContainText('o link da prévia tinha vencido: pedi um novo');
  await expect(log).toContainText('começou a tocar (áudio do navegador)');
  await expect(log).not.toContainText('a prévia foi recusada');
});

test('INV-PLAY-09: se o navegador não deixa a faixa completa começar (sem prévia), o app tenta de novo sozinho, sem botão nem aviso de ação', async ({ page }) => {
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST] });
  await page.addInitScript(() => { (window as any).__ytMode = 'blocked'; });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await topHit(page).click();

  // Blocked: the player is asked again by itself
  await expect.poll(() => page.evaluate(() => (window as any).__yt?.plays ?? 0), { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('button', { name: 'Ouvir completa' })).toHaveCount(0);

  // The browser lets it through (the next try works): the track starts without any tap
  await page.evaluate(() => { (window as any).__ytAllow = true; });
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  await expect(page.getByTestId('playback-log')).toContainText('começou a tocar (player do YouTube)', { timeout: 10_000 });
});

test('INV-PLAY-13: com a prévia tocando, o player do YouTube é chamado uma vez só (ao carregar): nem tentativas nem o ▶ o acordam, para não tirar o som da prévia', async ({ page }) => {
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST], previewUrl: silentClip(25) });
  await page.addInitScript(() => { (window as any).__ytMode = 'blocked'; });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await topHit(page).click();
  await expect.poll(() => page.evaluate(() => (window as any).__yt?.log ?? [])).toEqual([`load:${FIRST}`]);

  // Several seconds, touches on the screen and a pause + play: the player is never asked to play again
  await page.waitForTimeout(4500);
  await page.mouse.click(200, 300);
  await miniPlay(page).click();
  await expect(miniPlay(page)).toHaveAccessibleName('Reproduzir música');
  await miniPlay(page).click();
  await expect(miniPlay(page)).toHaveAccessibleName('Pausar música');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).__yt.log)).toEqual([`load:${FIRST}`]);

  // The preview is what plays, and the screen says how to get the full track
  await expect(page.getByText(/Toque na faixa de novo para ouvir a completa/).first()).toBeVisible();
});

test('tocar outra faixa enquanto a anterior ainda renova o link da prévia não vira "recusada pelo navegador" nem pausa a faixa nova', async ({ page }) => {
  await stubApi(page, { stalePreview: true });
  // The renewal of an expired address takes a second: the second tap comes while the first still waits for it
  await page.route('**/api/search?preview=*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.fallback();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await topHit(page).click();
  await page.waitForTimeout(300);
  await page.locator('section[aria-label="Top Hits"] [role=button]').nth(1).click();

  await page.waitForTimeout(3500);
  await expect(miniPlay(page)).toHaveAccessibleName('Pausar música');
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  const log = page.getByTestId('playback-log');
  await expect(log).toContainText('começou a tocar (áudio do navegador)');
  await expect(log).not.toContainText('recusada pelo navegador');
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
