import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { nav, stubApi, TOP_HITS } from './fixtures';
import { MOCK_URL, testUser } from './supabaseMock';

const PHONE = { viewport: { width: 414, height: 896 }, serviceWorkers: 'block', colorScheme: 'dark' } as const;

async function history(request: APIRequestContext, userId: string) {
  const state = (await (await request.get(`${MOCK_URL}/__state/${userId}`)).json()) as { play_history: { track_id: string }[] };
  return state.play_history.map((row) => row.track_id);
}

async function openApp(page: Page, user: ReturnType<typeof testUser>) {
  // Tracks of 4 seconds that really play (silent), so a "play" is over in a couple of seconds
  await stubApi(page, { user, shortTracks: true });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
}

const playFirstTopHit = (page: Page) => page.locator('section[aria-label="Top Hits"] [role=button]').first().click();

const recentRow = (page: Page) => page.getByRole('button', { name: /Reproduzidas recentemente/ });

test('uma faixa ouvida o bastante entra em "Reproduzidas recentemente" e na conta', async ({ page, request }) => {
  const user = testUser();
  await openApp(page, user);
  await nav(page, 'Biblioteca').click();
  await expect(recentRow(page)).toContainText('0');

  await nav(page, 'Início').click();
  await playFirstTopHit(page);
  await expect.poll(async () => history(request, user.id), { timeout: 15_000 }).toContain('deezer-1');

  await nav(page, 'Biblioteca').click();
  await expect(recentRow(page)).not.toContainText('0');
  await recentRow(page).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Recentes' })).toBeVisible();
  await expect(page.getByText(TOP_HITS[0].title).first()).toBeVisible();
});

test('o histórico aparece em outro aparelho e "Limpar histórico" apaga em todos', async ({ page, browser, request }) => {
  const user = testUser();
  await openApp(page, user);
  await playFirstTopHit(page);
  await expect.poll(async () => history(request, user.id), { timeout: 15_000 }).toContain('deezer-1');
  // The player would go on to the next track and count it too: stop it so the clearing below is the last word
  await page.close();

  const other = await browser.newContext(PHONE);
  const otherPage = await other.newPage();
  await openApp(otherPage, user);
  await nav(otherPage, 'Biblioteca').click();
  await expect(recentRow(otherPage)).not.toContainText('0');

  await recentRow(otherPage).click();
  await otherPage.getByRole('button', { name: 'Limpar histórico' }).click();
  await otherPage.getByRole('button', { name: 'Limpar', exact: true }).click();
  await expect(otherPage.getByText(/O que você ouvir aparece aqui/)).toBeVisible();
  await expect.poll(async () => history(request, user.id)).toEqual([]);
  await other.close();
});

test('uma reprodução feita sem conexão chega à conta depois', async ({ page, request }) => {
  const user = testUser();
  await openApp(page, user);
  await page.route('**/rest/v1/**', (route) => route.abort());
  await playFirstTopHit(page);
  await nav(page, 'Biblioteca').click();
  await expect(recentRow(page)).not.toContainText('0', { timeout: 15_000 });
  expect(await history(request, user.id)).toEqual([]);

  await page.unroute('**/rest/v1/**');
  await page.reload();
  await expect.poll(async () => history(request, user.id), { timeout: 15_000 }).toContain('deezer-1');
});
