import { expect, test } from '@playwright/test';
import { nav, stubApi } from './fixtures';
import { EXPIRED_CODE_PREFIX, HOURLY_LIMIT_PREFIX, INVITED_DOMAIN, NO_COOLDOWN_PREFIX, testUser, VALID_CODE } from './supabaseMock';

test('sem sessão o app mostra o login e não pede nada ao servidor', async ({ page }) => {
  const requests = await stubApi(page, { signedIn: false });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'AuraStream' })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await expect(nav(page, 'Início')).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('um e-mail sem convite recebe a mesma resposta, e nenhum código vale (não revela quem tem convite)', async ({ page }) => {
  await stubApi(page, { signedIn: false });
  await page.goto('/');
  await page.getByLabel('E-mail').fill('curioso@exemplo.com');
  await page.getByRole('button', { name: 'Receber código' }).click();
  await expect(page.getByText(/tiver convite, o código chega em instantes/)).toBeVisible();

  await page.getByLabel('Código').fill(VALID_CODE);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('incorreto ou expirado');
});

test('com convite: e-mail, código e o app abre; as chamadas levam o login', async ({ page }) => {
  await stubApi(page, { signedIn: false });
  const authorized: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/feed') authorized.push(request.headers().authorization ?? '');
  });

  await page.goto('/');
  await page.getByLabel('E-mail').fill(testUser('ana').email);
  await page.getByRole('button', { name: 'Receber código' }).click();

  await page.getByLabel('Código').fill('000000');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('incorreto ou expirado');

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

test('o código mostra quanto tempo falta, expira e só pode ser pedido de novo depois de 1 minuto', async ({ page }) => {
  await page.clock.install();
  await stubApi(page, { signedIn: false });
  await page.goto('/');
  await page.getByLabel('E-mail').fill(testUser('ana').email);
  await page.getByRole('button', { name: 'Receber código' }).click();

  await expect(page.getByTestId('code-status')).toHaveText('O código vale por 1:30');
  const resend = page.getByRole('button', { name: /Reenviar código/ });
  await expect(resend).toBeDisabled();
  await expect(resend).toContainText('1:00');

  // 60 s later another code may be asked for, but the server still refuses: it counts the real time
  await page.clock.fastForward(61_000);
  await expect(page.getByTestId('code-status')).toHaveText('O código vale por 0:29');
  await expect(resend).toBeEnabled();
  await resend.click();
  await expect(page.getByRole('alert')).toContainText('Aguarde');

  await page.clock.fastForward(30_000);
  await expect(page.getByTestId('code-status')).toHaveText('Código expirado. Peça um novo.');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeDisabled();
});

test('reenviar depois do tempo traz um código novo e reinicia a contagem', async ({ page }) => {
  await page.clock.install();
  await stubApi(page, { signedIn: false });
  await page.goto('/');
  await page.getByLabel('E-mail').fill(testUser(NO_COOLDOWN_PREFIX).email);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await page.clock.fastForward(61_000);
  await page.getByRole('button', { name: 'Reenviar código' }).click();
  await expect(page.getByTestId('code-status')).toHaveText('O código vale por 1:30');
  await expect(page.getByRole('button', { name: /Reenviar código em/ })).toBeDisabled();

  await page.getByLabel('Código').fill(VALID_CODE);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
});

test('um código que o servidor já expirou é recusado', async ({ page }) => {
  await stubApi(page, { signedIn: false });
  await page.goto('/');
  await page.getByLabel('E-mail').fill(testUser(EXPIRED_CODE_PREFIX).email);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await page.getByLabel('Código').fill(VALID_CODE);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('incorreto ou expirado');
});

test('recarregar a página não zera a espera: o e-mail já usado volta ao código sem pedir outro', async ({ page }) => {
  await stubApi(page, { signedIn: false });
  await page.goto('/');
  const { email } = testUser('ana');
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await expect(page.getByLabel('Código')).toBeVisible();

  await page.reload();
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await expect(page.getByLabel('Código')).toBeVisible();
  await page.getByLabel('Código').fill(VALID_CODE);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
});

test('quando acabam os e-mails por hora do servidor, a mensagem diz que não é culpa do usuário', async ({ page }) => {
  await stubApi(page, { signedIn: false });
  await page.goto('/');
  await page.getByLabel('E-mail').fill(testUser(HOURLY_LIMIT_PREFIX).email);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await expect(page.getByRole('alert')).toContainText('limite de e-mails por hora do servidor');
  // Nenhum código foi enviado: continua na tela do e-mail, e dá para tentar de novo
  await expect(page.getByLabel('Código')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Receber código' })).toBeEnabled();
});
