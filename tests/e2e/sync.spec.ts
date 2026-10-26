import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { nav, stubApi, track } from './fixtures';
import { MOCK_URL, testUser } from './supabaseMock';

const PHONE = { viewport: { width: 414, height: 896 }, serviceWorkers: 'block', colorScheme: 'dark' } as const;

async function account(request: APIRequestContext, userId: string) {
  return (await request.get(`${MOCK_URL}/__state/${userId}`)).json() as Promise<{
    favorites: { track_id: string }[];
    playlists: { id: string; name: string }[];
    playlist_tracks: { playlist_id: string; track_id: string; position: number }[];
    video_choices: { track_id: string; video_id: string }[];
  }>;
}

const likeFirstTopHit = (page: Page) =>
  page.locator('section[aria-label="Top Hits"]').getByRole('button', { name: /^Favoritar/ }).first().click();

async function openApp(page: Page, user: ReturnType<typeof testUser>) {
  await stubApi(page, { user });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
}

test('um favorito vai para a conta e aparece em outro aparelho', async ({ page, browser, request }) => {
  const user = testUser();
  await openApp(page, user);
  await likeFirstTopHit(page);
  await expect.poll(async () => (await account(request, user.id)).favorites.map((f) => f.track_id)).toEqual(['deezer-1']);

  // A second device: its own, empty storage
  const other = await browser.newContext(PHONE);
  const otherPage = await other.newPage();
  await openApp(otherPage, user);
  await nav(otherPage, 'Biblioteca').click();
  await expect(otherPage.getByRole('button', { name: /Músicas favoritas/ })).toContainText('1');
  await other.close();
});

test('INV-DATA-01: dois usuários no mesmo aparelho não misturam favoritos', async ({ page, context }) => {
  const ana = testUser('ana');
  const bia = testUser('bia');
  const favorites = (target: Page) => target.getByRole('button', { name: /Músicas favoritas/ });

  await openApp(page, ana);
  await likeFirstTopHit(page);
  await nav(page, 'Biblioteca').click();
  await expect(favorites(page)).toContainText('1');
  // Let the favorite settle before the tab goes away
  await page.waitForTimeout(1200);
  await page.close();

  // Another person on the same browser (one tab at a time: the login is shared between tabs, as in any browser)
  const biaPage = await context.newPage();
  await openApp(biaPage, bia);
  await nav(biaPage, 'Biblioteca').click();
  await expect(favorites(biaPage)).not.toContainText('1');
  await biaPage.close();

  const anaAgain = await context.newPage();
  await openApp(anaAgain, ana);
  await nav(anaAgain, 'Biblioteca').click();
  await expect(favorites(anaAgain)).toContainText('1');
});

test('os dados de antes das contas vão para quem entra primeiro, e saem das chaves antigas', async ({ page, request }) => {
  const user = testUser();
  const favorite = track(7, 'Faixa Antiga', 'Artista Velho');
  await page.addInitScript(
    ([favorites, playlists]) => {
      if (localStorage.getItem('legacy-seeded')) return;
      localStorage.setItem('legacy-seeded', '1');
      localStorage.setItem('aurastream_liked_track_objects', favorites);
      localStorage.setItem('aurastream_playlists', playlists);
    },
    [
      JSON.stringify([favorite]),
      JSON.stringify([{ id: 'playlist-antiga', name: 'Antiga', createdAt: 1_700_000_000_000, tracks: [favorite] }])
    ]
  );
  await openApp(page, user);

  await nav(page, 'Biblioteca').click();
  await expect(page.getByRole('button', { name: /Músicas favoritas/ })).toContainText('1');
  await page.getByRole('button', { name: /^Playlists/ }).click();
  await expect(page.getByRole('button', { name: /Antiga/ })).toContainText('1');

  await expect
    .poll(async () => {
      const state = await account(request, user.id);
      return [state.favorites.map((f) => f.track_id), state.playlists.map((p) => p.name), state.playlist_tracks.length];
    })
    .toEqual([['deezer-7'], ['Antiga'], 1]);
  // The playlist got a real id, and nobody else on this device inherits the old data
  expect((await account(request, user.id)).playlists[0].id).toMatch(/^[0-9a-f-]{36}$/);
  expect(await page.evaluate(() => localStorage.getItem('aurastream_liked_track_objects'))).toBeNull();
});

test('INV-DATA-02: uma alteração feita sem conexão chega à conta na próxima abertura', async ({ page, request }) => {
  const user = testUser();
  await openApp(page, user);

  await page.route('**/rest/v1/**', (route) => route.abort());
  await likeFirstTopHit(page);
  await page.waitForTimeout(1500);
  expect((await account(request, user.id)).favorites).toHaveLength(0);

  await page.unroute('**/rest/v1/**');
  await page.reload();
  await expect.poll(async () => (await account(request, user.id)).favorites.map((f) => f.track_id)).toEqual(['deezer-1']);
  // And the account's older copy did not wipe the favorite from the device
  await nav(page, 'Biblioteca').click();
  await expect(page.getByRole('button', { name: /Músicas favoritas/ })).toContainText('1');
});
