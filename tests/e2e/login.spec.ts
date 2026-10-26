import { expect, test } from '@playwright/test';
import { nav, stubApi } from './fixtures';
import { INVITED_DOMAIN, testUser, VALID_CODE } from './supabaseMock';

test('sem sessão o app mostra o login e não pede nada ao servidor', async ({ page }) => {
  const requests = await stubApi(page, { signedIn: false });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'AuraStream' })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await expect(nav(page, 'Início')).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('um e-mail sem convite é recusado com uma mensagem clara', async ({ page }) => {
  await stubApi(page, { signedIn: false });
  await page.goto('/');
  await page.getByLabel('E-mail').fill('curioso@exemplo.com');
  await page.getByRole('button', { name: 'Receber código' }).click();
  await expect(page.getByRole('alert')).toContainText('não tem convite');
  await expect(page.getByLabel('Código')).toHaveCount(0);
});

test('com convite: e-mail, código e o app abre; as chamadas levam o login', async ({ page }) => {
  await stubApi(page, { signedIn: false });
  const authorized: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/feed') authorized.push(request.headers().authorization ?? '');
  });

  await page.goto('/');
  await page.getByLabel('E-mail').fill(`ana${INVITED_DOMAIN}`);
  await page.getByRole('button', { name: 'Receber código' }).click();

  await page.getByLabel('Código').fill('000000');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('inválido ou expirado');

  await page.getByLabel('Código').fill(VALID_CODE);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await expect.poll(() => authorized.length).toBeGreaterThan(0);
  expect(authorized.every((value) => value.startsWith('Bearer '))).toBe(true);

  // The session survives a reload
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
});

test('Ajustes mostra a conta e Sair volta ao login', async ({ page }) => {
  const user = testUser();
  await stubApi(page, { user });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();

  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await expect(page.getByTestId('account-email')).toHaveText(user.email);
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByLabel('E-mail')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('E-mail')).toBeVisible();
});

test('uma sessão recusada pelo servidor (convite retirado) leva de volta ao login', async ({ page }) => {
  await stubApi(page);
  await page.route('**/api/feed', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Sessão expirada"}' }));
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: '{"msg":"invalid"}' }));
  await page.goto('/');
  await expect(page.getByLabel('E-mail')).toBeVisible();
});
