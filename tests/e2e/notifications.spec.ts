import { expect, test } from '@playwright/test';
import { nav, openLibrary, stubApi } from './fixtures';

const UNREAD = { id: '11111111-1111-4111-8111-111111111111', kind: 'invite', payload: { title: 'Ana convidou você', body: 'Festa de sábado' }, created_at: '2026-11-18T12:00:00.000Z', read_at: null };
const READ = { id: '22222222-2222-4222-8222-222222222222', kind: 'invite', payload: { title: 'Bruno recusou' }, created_at: '2026-11-10T12:00:00.000Z', read_at: '2026-11-10T13:00:00.000Z' };

test('INV-NOT-01: um aviso novo aparece no Início, a caixa mostra a lista e marca como lido ao abrir', async ({ page }) => {
  const reads: string[] = [];
  await stubApi(page, { notices: [UNREAD, READ], noticeReads: reads });
  await page.goto('/');

  const banner = page.getByRole('button', { name: 'Você tem 1 aviso novo' });
  await expect(banner).toBeVisible();
  await banner.click();

  const box = page.getByRole('list', { name: 'Avisos' });
  await expect(box.getByText('Ana convidou você')).toBeVisible();
  await expect(box.getByText('Festa de sábado')).toBeVisible();
  await expect(box.getByText('Bruno recusou')).toBeVisible();
  // Only the one that arrived since the last visit is marked "Novo"
  await expect(box.getByText('Novo', { exact: true })).toHaveCount(1);

  // The read is sent for that notice alone, and the banner goes away
  await expect.poll(() => reads.length).toBe(1);
  expect(reads[0]).toContain(`id=in.(${UNREAD.id})`);
  expect(reads[0]).toContain('read_at=is.null');
  await nav(page, 'Início').click();
  await expect(page.getByRole('button', { name: /aviso novo/ })).toBeHidden();
});

test('INV-NOT-02: a linha Avisos na Biblioteca mostra só a contagem de não lidos', async ({ page }) => {
  await stubApi(page, { notices: [UNREAD, READ] });
  await page.goto('/');
  await openLibrary(page);
  await expect(page.getByRole('button', { name: /^Avisos\s+1/ })).toBeVisible();
});

test('INV-NOT-01: sem avisos, a caixa diz que não há nenhum', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  await openLibrary(page);
  await page.getByRole('button', { name: /^Avisos\s+0/ }).click();
  await expect(page.getByText('Nenhum aviso por enquanto.')).toBeVisible();
  await expect(page.getByRole('button', { name: /aviso novo/ })).toHaveCount(0);
});

test('INV-NOT-01: sem a tabela no banco, a caixa diz que está indisponível e o app segue', async ({ page }) => {
  await stubApi(page);
  // Registered after stubApi, so it answers first
  await page.route('**/rest/v1/user_notifications*', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"relation does not exist"}' })
  );
  await page.goto('/');
  await openLibrary(page);
  await page.getByRole('button', { name: /^Avisos/ }).click();
  await expect(page.getByText('Avisos indisponíveis')).toBeVisible();
  // The screen is the box itself: the menu of the library is no longer on it
  await expect(page.getByRole('button', { name: /^Avisos/ })).toBeHidden();
});
