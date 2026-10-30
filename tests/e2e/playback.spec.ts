import { expect, test, type Page } from '@playwright/test';
import { fakeYouTube, loadedVideo, silentClip, stubApi, TOP_HITS } from './fixtures';

const FIRST = 'AAAAAAAAAAA';
const topHit = (page: Page) => page.locator('section[aria-label="Top Hits"] [role=button]').first();
const miniPlay = (page: Page) => page.getByRole('button', { name: /^(Pausar|Reproduzir|Carregando) música$/ });

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
  // Until the sound starts the button says "loading", not "playing"
  await expect(page.getByRole('button', { name: 'Carregando música' })).toBeVisible();

  // Seconds of silence: the screen admits it, and shows ▶ so the next tap (allowed by the browser) can start it
  await expect(page.getByText(/não deixou a música começar sozinha/).first()).toBeVisible({ timeout: 12_000 });
  await expect(miniPlay(page)).toHaveAccessibleName('Reproduzir música');

  // The tap on ▶ takes the notice away at once and asks the player to play (loading again until sound)
  await miniPlay(page).click();
  await expect(page.getByText(/não deixou a música começar sozinha/)).toHaveCount(0);
  await expect(miniPlay(page)).toHaveAccessibleName('Carregando música');
});

test('INV-PLAY-07: faixa nova não toca a prévia como ponte: o botão mostra carregamento e a faixa completa começa pelo player do YouTube', async ({ page }) => {
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST], previewUrl: silentClip(20) });
  // The search for a track nobody played yet takes a while
  await page.route('**/api/resolve?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videoIds: [FIRST] }) });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await topHit(page).click();

  // While the video is searched and the player starts: loading (a ring), no text, no preview
  const button = page.getByRole('button', { name: 'Carregando música' });
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(button.locator('[data-state="loading"]')).toHaveCount(1);

  // The full track starts: the same button now says "playing"
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('button [data-state="playing"]').first()).toBeAttached();

  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  const log = page.getByTestId('playback-log');
  await expect(log).toContainText('começou a tocar (player do YouTube)');
  await expect(log).not.toContainText('áudio do navegador');
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

test('INV-PLAY-10: o player fica pronto antes do toque, sem tocar nada; no toque de uma faixa nova ele é liberado com o vídeo-reserva mudo e o vídeo real, achado depois, entra no mesmo player com som', async ({ page }) => {
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
  // In the tap itself the frame is released (the reserve video plays muted); the real video is still being searched
  await expect(page.getByRole('button', { name: 'Carregando música' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__yt.log)).toEqual(['mute', 'play']);
  // The real video loads into the same frame and the sound comes back
  await expect.poll(() => page.evaluate(() => (window as any).__yt.log.slice(2, 4))).toEqual([`load:${FIRST}`, 'unmute']);
  expect(await page.evaluate(() => (window as any).__yt.created)).toBe(1);
});

test('INV-PLAY-10: uma faixa de vídeo já conhecido carrega no toque, sem vídeo-reserva', async ({ page }) => {
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST], cachedVideos: { [TOP_HITS[0].id]: [FIRST] }, lookups: [] });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__yt?.created ?? 0), { timeout: 8000 }).toBe(1);
  await page.waitForTimeout(800);
  await topHit(page).click();
  await expect.poll(() => page.evaluate(() => (window as any).__yt.log[0])).toBe(`load:${FIRST}`);
  expect(await page.evaluate(() => (window as any).__yt.log)).not.toContain('mute');
});

test('INV-PLAY-10: o player é criado assim que o app abre, sem esperar: um toque logo depois da abertura já o encontra', async ({ page }) => {
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST] });
  await page.goto('/');
  // Not after a pause of seconds: a tap one second after launch (seen on a device) must find the frame already made
  await expect.poll(() => page.evaluate(() => (window as any).__yt?.created ?? 0), { timeout: 1500 }).toBe(1);
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  await expect(page.getByTestId('playback-log')).toContainText(/player do YouTube criado ao abrir o app \(\d+ ms depois de a página abrir\)/);
});

test('INV-PLAY-10: o player é liberado de novo em todo toque de faixa nova com o player parado, não só no primeiro da sessão', async ({ page }) => {
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST] });
  await page.route('**/api/resolve?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videoIds: [FIRST] }) });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__yt?.created ?? 0), { timeout: 8000 }).toBe(1);
  const muted = () => page.evaluate(() => (window as any).__yt.log.filter((entry: string) => entry === 'mute').length);

  await topHit(page).click();
  await expect.poll(muted).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as any).__yt.loads.length)).toBe(1);

  // The track plays; the person pauses it. The frame is no longer playing: the next new track must release it again
  await page.getByRole('button', { name: 'Pausar música' }).first().click();
  await page.locator('section[aria-label="Top Hits"] [role=button]').nth(1).click();
  await expect.poll(muted, { timeout: 8000 }).toBe(2);
  await expect.poll(() => page.evaluate(() => (window as any).__yt.loads.length)).toBe(2);
});

test('INV-PLAY-20: pausar e tocar de novo retoma a mesma faixa no mesmo vídeo, com som, sem vídeo-reserva e sem avançar para a próxima (o clipe mudo do toque não conta como fim de faixa)', async ({ page }) => {
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST] });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__yt?.created ?? 0), { timeout: 8000 }).toBe(1);
  await topHit(page).click();
  await expect(page.getByRole('button', { name: 'Pausar música' }).first()).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => (window as any).__yt.loads.length)).toBe(1);
  const title = await page.getByRole('button', { name: /Abrir player expandido/ }).textContent();

  await miniPlay(page).click();
  await expect(miniPlay(page)).toHaveAccessibleName('Reproduzir música');
  const before = await page.evaluate(() => (window as any).__yt.log.length);
  await miniPlay(page).click();
  await expect(miniPlay(page)).toHaveAccessibleName('Pausar música');
  await page.waitForTimeout(1500);

  const after = await page.evaluate(() => (window as any).__yt.log.slice(0));
  // Resuming asks the player to play, and nothing else: no mute, no new video
  expect(after.slice(before)).toEqual(['play']);
  expect(await page.evaluate(() => (window as any).__yt.loads.length)).toBe(1);
  expect(await page.getByRole('button', { name: /Abrir player expandido/ }).textContent()).toBe(title);
});

test('o tempo da faixa não fica com a duração do vídeo-reserva: a barra segue a duração real do player', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__ytStaleLength = true;
  });
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST] });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await topHit(page).click();
  await expect(page.getByRole('button', { name: /Abrir player expandido/ })).toBeVisible();
  await page.getByRole('button', { name: /Abrir player expandido/ }).click();
  // Right after the load the player answers 0:19; a moment later its own length, 3:00, replaces it
  await expect(page.getByText(/^-0[23]:\d\d$/)).toBeVisible({ timeout: 6000 });
  await expect(page.getByText('-00:00')).toHaveCount(0);
});

test('INV-PLAY-11: a prévia, que só toca quando não há faixa completa, se for recusada pelo navegador aparece no relatório', async ({ page }) => {
  await fakeYouTube(page);
  // No video found for the track: the preview is the fallback
  await stubApi(page, { videoIds: [], previewUrl: silentClip(20) });
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      // The real preview is refused (as the iPhone does outside a tap); the tiny unlock clip is not
      if (this.src.length > 5000) return Promise.reject(new DOMException('refused', 'NotAllowedError'));
      return original.call(this);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await topHit(page).click();

  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  await expect(page.getByTestId('playback-log')).toContainText('a prévia foi recusada pelo navegador (NotAllowedError)');
});

test('INV-PLAY-12: uma rádio ao vivo que demora 7 s a começar toca sem o aviso de "o iPhone não deixou"', async ({ page }) => {
  await stubApi(page);
  await page.route('https://stream.example/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 7000));
    await route.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.from(silentClip(20).split(',')[1], 'base64') });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await page.locator('nav[aria-label="Navegação Principal"] button[aria-label="Rádio"]').click();
  await page.getByRole('region', { name: 'Mais rádios ao vivo' }).getByRole('button', { name: 'Rock' }).click();
  await page.getByRole('button', { name: 'Ouvir Rádio rock Teste ao vivo' }).click();

  // Past the 6 s of an ordinary track: still waiting, no notice
  await page.waitForTimeout(6500);
  await expect(page.getByText(/não deixou a música começar sozinha/)).toHaveCount(0);

  // The stream starts at 7 s: playing, and still no notice
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  await expect(page.getByTestId('playback-log')).toContainText('começou a tocar (áudio do navegador)', { timeout: 10_000 });
  await expect(page.getByTestId('playback-log')).not.toContainText('sem som');
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

test('INV-PLAY-21: uma duração do player muito menor que a do catálogo não vai para a barra: ela segue a do catálogo e o diagnóstico registra', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__ytBogusLength = true;
  });
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST] });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await topHit(page).click();
  await page.getByRole('button', { name: /Abrir player expandido/ }).click();
  // After a couple of seconds the player starts answering "the time played so far" as the length
  await page.waitForTimeout(3500);
  await expect(page.getByText('-00:00')).toHaveCount(0);
  await expect(page.getByText(/^-0[23]:\d\d$/)).toBeVisible();
  await page.getByRole('button', { name: 'Minimizar player expandido' }).click();
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  await expect(page.getByTestId('playback-log')).toContainText(/duração do player ignorada|barra com a duração do catálogo/);
});

test.describe('"Não é esta música"', () => {
  const SECOND = 'BBBBBBBBBBB';
  const OTHER = 'CCCCCCCCCCC';

  async function playAndExpand(page: Page, options: Parameters<typeof stubApi>[1]) {
    await fakeYouTube(page);
    await stubApi(page, options);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__yt?.created ?? 0), { timeout: 8000 }).toBe(1);
    await topHit(page).click();
    await expect.poll(() => loadedVideo(page)).toBe(options?.videoIds?.[0]);
    await page.getByRole('button', { name: /Abrir player expandido/ }).click();
  }

  test('INV-PLAY-22: com uma só versão, o app denuncia o vídeo, procura de novo sem ele e toca o novo', async ({ page }) => {
    const reports: string[] = [];
    const avoids: string[] = [];
    await playAndExpand(page, { videoIds: [FIRST], otherVideoIds: [OTHER], reports, avoids });
    await page.getByRole('button', { name: 'Mais opções' }).click();
    await page.getByRole('menuitem', { name: 'Não é esta música' }).click();
    await expect.poll(() => loadedVideo(page)).toBe(OTHER);
    expect(reports).toEqual([FIRST]);
    expect(avoids).toEqual([FIRST]);
  });

  test('INV-PLAY-22: havendo outra versão já conhecida, toca a seguinte sem nova busca', async ({ page }) => {
    const reports: string[] = [];
    const avoids: string[] = [];
    await playAndExpand(page, { videoIds: [FIRST, SECOND], reports, avoids });
    await page.getByRole('button', { name: 'Mais opções' }).click();
    await page.getByRole('menuitem', { name: 'Não é esta música' }).click();
    await expect.poll(() => loadedVideo(page)).toBe(SECOND);
    expect(reports).toEqual([FIRST]);
    expect(avoids).toEqual([]);
  });

  test('INV-PLAY-22: sem outra versão a faixa segue tocando e o app avisa', async ({ page }) => {
    const loads = () => page.evaluate(() => (window as any).__yt.loads.length);
    await playAndExpand(page, { videoIds: [FIRST], otherVideoIds: [], reports: [], avoids: [] });
    const before = await loads();
    await page.getByRole('button', { name: 'Mais opções' }).click();
    await page.getByRole('menuitem', { name: 'Não é esta música' }).click();
    await expect(page.getByText('Não encontrei outra versão desta faixa.').first()).toBeVisible();
    expect(await loads()).toBe(before);
  });
});

test('INV-PLAY-24: ao sair do app e voltar, o Diagnóstico mostra o que o player do YouTube fazia e quando ele mudou de estado', async ({ page }) => {
  await fakeYouTube(page);
  await stubApi(page, { videoIds: [FIRST] });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__yt?.created ?? 0), { timeout: 8000 }).toBe(1);
  await topHit(page).click();
  await expect.poll(() => loadedVideo(page)).toBe(FIRST);
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible({ timeout: 10_000 });

  const setVisibility = (state: 'hidden' | 'visible') =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await setVisibility('hidden');
  // While the app is away the system pauses the video
  await page.evaluate(() => (window as any).__ytPlayer.set(2));
  await page.waitForTimeout(1100);
  await setVisibility('visible');

  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  const log = page.getByTestId('playback-log');
  await expect(log).toContainText(/player do YouTube ao sair do app: tocando em \d+ s/);
  await expect(log).toContainText(/player do YouTube mudou para pausado \d+ s depois de o app sair/);
  await expect(log).toContainText(/player do YouTube ao voltar \(fora \d+ s\): pausado em \d+ s/);
});
