import { expect, test, type Page } from '@playwright/test';
import { nav, stubApi } from './fixtures';

async function openShow(page: Page, options: Parameters<typeof stubApi>[1] = {}) {
  await stubApi(page, options);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await nav(page, 'Buscar').click();
  await page.getByRole('button', { name: 'Podcasts' }).click();
  await page.getByLabel('Buscar podcasts').fill('zen');
  await page.getByRole('button', { name: /Despertar Zen/ }).click();
  await expect(page.getByTestId('podcast-page')).toBeVisible();
}

const rows = (page: Page) => page.getByRole('list', { name: 'Episódios' }).getByRole('listitem');
const titles = (page: Page) => rows(page).evaluateAll((items) => items.map((item) => item.querySelector('span.font-semibold')?.textContent ?? ''));

test('INV-POD-04: o cartão Podcasts da Buscar abre a busca de programas; um programa abre com os episódios do mais novo ao mais antigo', async ({ page }) => {
  await openShow(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Despertar Zen' })).toBeVisible();
  expect(await titles(page)).toEqual(['Palestra Três', 'Palestra Dois', 'Palestra Um']);
  // Nothing found: said so
  await page.getByRole('button', { name: /Voltar|Podcasts/ }).first().click();
  await page.getByLabel('Buscar podcasts').fill('xyzxyz');
  await expect(page.getByText(/Nenhum podcast encontrado/)).toBeVisible();
});

test('INV-POD-04: a ordem dos episódios se inverte, o "Continuar" segue a ordem e a escolha fica lembrada do programa', async ({ page }) => {
  await openShow(page);
  await expect(page.getByRole('button', { name: /^Ouvir: Palestra Três/ })).toBeVisible();
  await page.getByRole('button', { name: 'Mais antigos' }).click();
  expect(await titles(page)).toEqual(['Palestra Um', 'Palestra Dois', 'Palestra Três']);
  await expect(page.getByRole('button', { name: /^Ouvir: Palestra Um/ })).toBeVisible();
  await page.reload();
  await nav(page, 'Buscar').click();
  await page.getByRole('button', { name: 'Podcasts' }).click();
  await page.getByLabel('Buscar podcasts').fill('zen');
  await page.getByRole('button', { name: /Despertar Zen/ }).click();
  await expect(page.getByRole('button', { name: 'Mais antigos' })).toHaveAttribute('aria-pressed', 'true');
  expect(await titles(page)).toEqual(['Palestra Um', 'Palestra Dois', 'Palestra Três']);
});

test('INV-POD-05: tocar um episódio toca o arquivo do feed; o player mostra os controles de podcast e episódio anterior e próximo seguem a lista', async ({ page }) => {
  const audio: string[] = [];
  await openShow(page, { podcastAudioUrls: audio });
  await page.getByRole('button', { name: /^Tocar Palestra Dois/ }).click();
  await expect.poll(() => audio.length).toBeGreaterThan(0);
  expect(audio[0]).toBe('https://podcast.example/2.mp3');
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: /Abrir player expandido/ }).click();
  for (const name of ['Episódio anterior', 'Voltar 15 segundos', 'Avançar 30 segundos', 'Próximo episódio']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  // What only music has is not there
  for (const name of [/modo aleatório/, /Repetição|Repetindo/, /favoritos/]) await expect(page.getByRole('button', { name })).toHaveCount(0);

  // Next: the following row of the list (the older episode)
  await page.getByRole('button', { name: 'Próximo episódio' }).click();
  await expect.poll(() => audio.at(-1)).toBe('https://podcast.example/1.mp3');
  await expect(page.getByRole('button', { name: 'Próximo episódio' })).toBeDisabled();
  // Previous: back to the one before in the list
  await page.getByRole('button', { name: 'Episódio anterior' }).click();
  await expect.poll(() => audio.at(-1)).toBe('https://podcast.example/2.mp3');
});

test('INV-POD-05: a velocidade alterna entre 1×, 1,25×, 1,5×, 2× e 0,8× e fica lembrada', async ({ page }) => {
  await openShow(page);
  await page.getByRole('button', { name: /^Tocar Palestra Três/ }).click();
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Abrir player expandido/ }).click();
  const speed = page.getByRole('button', { name: /^Velocidade de reprodução/ });
  await expect(speed).toHaveText('1×');
  await speed.click();
  await expect(speed).toHaveText('1,25×');
  await speed.click();
  await expect(speed).toHaveText('1,5×');
  await speed.click();
  await speed.click();
  await expect(speed).toHaveText('0,8×');
  await speed.click();
  await expect(speed).toHaveText('1×');
  await speed.click();
  expect(await page.evaluate(() => localStorage.getItem('aurastream_podcast_speed'))).toBe('1.25');
});

test('INV-POD-05: o episódio volta 15 s e avança 30 s pelos botões, sem passar do fim', async ({ page }) => {
  await openShow(page);
  await page.getByRole('button', { name: /^Tocar Palestra Três/ }).click();
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Abrir player expandido/ }).click();
  await page.getByRole('button', { name: 'Voltar 15 segundos' }).click();
  await expect(page.getByText(/^00:0\d$/).first()).toBeVisible();
});

test('INV-POD-03: o episódio guarda onde a pessoa parou, mostra o progresso na lista e o Continuar retoma dali', async ({ page }) => {
  await openShow(page);
  await page.getByRole('button', { name: /^Tocar Palestra Três/ }).click();
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible({ timeout: 10_000 });
  // A resume point only counts after 10 s: listen for 12
  await page.waitForTimeout(12_500);
  await page.getByRole('button', { name: 'Pausar música' }).click();
  await expect(page.getByRole('button', { name: 'Reproduzir música' })).toBeVisible();

  // Back to the list: the episode shows how much was heard, and Continue names it
  await expect(page.getByRole('progressbar', { name: 'Progresso do episódio' })).toBeVisible();
  const share = Number(await page.getByRole('progressbar', { name: 'Progresso do episódio' }).getAttribute('aria-valuenow'));
  expect(share).toBeGreaterThanOrEqual(55);
  await expect(page.getByRole('button', { name: /^Continuar: Palestra Três/ })).toBeVisible();

  // Reload and continue: it resumes near where it stopped
  await page.reload();
  await nav(page, 'Buscar').click();
  await page.getByRole('button', { name: 'Podcasts' }).click();
  await page.getByLabel('Buscar podcasts').fill('zen');
  await page.getByRole('button', { name: /Despertar Zen/ }).click();
  await page.getByRole('button', { name: /^Continuar: Palestra Três/ }).click();
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: 'Diagnóstico de reprodução' }).click();
  await expect(page.getByTestId('playback-log')).toContainText(/episódio retomado em 1[2-9] s/);
});

test('INV-POD-04: na busca online os programas aparecem numa seção Podcasts e voltam para os resultados', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  await nav(page, 'Buscar').click();
  await page.getByRole('searchbox').or(page.getByPlaceholder(/Buscar|Artistas|ouvir/i)).first().fill('zen');
  await page.keyboard.press('Enter');
  const section = page.getByRole('region', { name: 'Podcasts' });
  await expect(section).toBeVisible({ timeout: 8000 });
  await section.getByRole('button', { name: /Despertar Zen/ }).click();
  await expect(page.getByTestId('podcast-page')).toBeVisible();
  await page.getByRole('button', { name: /Buscar/ }).first().click();
  await expect(page.getByRole('region', { name: 'Podcasts' })).toBeVisible();
});
