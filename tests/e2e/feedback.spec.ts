import { expect, test } from '@playwright/test';
import { stubApi } from './fixtures';

const openFeedback = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('dialog', { name: 'Ajustes' }).getByRole('button', { name: 'Enviar feedback' }).click();
  await expect(page.getByRole('dialog', { name: 'Enviar feedback' })).toBeVisible();
};

test('INV-FB-01: a pessoa envia feedback pelos Ajustes e a linha vai para a conta, com o tipo, a mensagem e a versão', async ({ page }) => {
  await stubApi(page);
  await openFeedback(page);
  const sheet = page.getByRole('dialog', { name: 'Enviar feedback' });
  const send = sheet.getByRole('button', { name: 'Enviar', exact: true });
  await expect(send).toBeDisabled();

  await sheet.getByRole('radio', { name: 'Algo não funciona' }).click();
  await sheet.getByLabel('Mensagem').fill('A busca some quando giro o aparelho');
  await expect(send).toBeEnabled();

  const sent = page.waitForRequest((request) => request.url().includes('/rest/v1/app_feedback') && request.method() === 'POST');
  await send.click();
  const rows = (await sent).postDataJSON() as { user_id: string; kind: string; message: string; version: string }[];
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ kind: 'bug', message: 'A busca some quando giro o aparelho' });
  expect(rows[0].user_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(rows[0].version).not.toBe('');

  await expect(sheet.getByText('Obrigado!')).toBeVisible();
  await sheet.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(sheet).toBeHidden();
});

test('INV-FB-01: se a gravação falha, a folha diz que não foi enviado e mantém o texto para tentar de novo', async ({ page }) => {
  await stubApi(page);
  // Registered after stubApi, so it answers first
  await page.route('**/rest/v1/app_feedback', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"falha"}' }));
  await openFeedback(page);
  const sheet = page.getByRole('dialog', { name: 'Enviar feedback' });
  await sheet.getByLabel('Mensagem').fill('Sugiro um modo noturno');
  await sheet.getByRole('button', { name: 'Enviar', exact: true }).click();

  await expect(sheet.getByRole('alert')).toContainText('Não foi possível enviar');
  await expect(sheet.getByLabel('Mensagem')).toHaveValue('Sugiro um modo noturno');
  await expect(sheet.getByRole('button', { name: 'Enviar', exact: true })).toBeEnabled();
});
