import { expect, test, type Page } from '@playwright/test';
import { nav, stubApi } from './fixtures';

const openSheetFromLibrary = async (page: Page) => {
  await nav(page, 'Biblioteca').click();
  await page.getByRole('button', { name: /^Playlists/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Playlists' })).toBeVisible();
  await page.getByRole('button', { name: 'Criar com IA' }).click();
  await expect(page.getByRole('heading', { name: 'Criar com IA' })).toBeVisible();
};

test('INV-SMART-10: criar com IA gera 10 músicas, deixa ouvir e remover, adiciona mais e salva com o nome escolhido', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  await openSheetFromLibrary(page);

  // Describe and create: one field, one button
  await page.locator('#smart-prompt').fill('Rock clássico para viagem');
  await page.getByRole('button', { name: 'Criar playlist' }).click();

  // The list shows up with a 30 s preview per track and the name ready to change
  await expect(page.getByText('Bohemian Rhapsody')).toBeVisible();
  await expect(page.getByLabel('Nome da playlist')).toHaveValue('Seleção Rock Clássico');
  await expect(page.getByText('10 músicas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ouvir prévia de Bohemian Rhapsody' })).toBeVisible();

  // Remove one track: it goes from the list
  await page.getByRole('button', { name: 'Remover Hotel California' }).click();
  await expect(page.getByText('Hotel California')).toHaveCount(0);
  await expect(page.getByText('9 músicas')).toBeVisible();

  // Add five more with the same description: the removed track does not come back
  await page.getByRole('button', { name: 'Adicionar 5 músicas' }).click();
  await expect(page.getByText('Sweet Child O Mine')).toBeVisible();
  await expect(page.getByText('Hotel California')).toHaveCount(0);
  await expect(page.getByText('14 músicas')).toBeVisible();

  // Name it and save: the new playlist opens in the library
  await page.getByLabel('Nome da playlist').fill('Rock para viagem');
  await page.getByRole('button', { name: 'Salvar na Biblioteca' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Rock para viagem' })).toBeVisible();
  await expect(page.getByText('Bohemian Rhapsody')).toBeVisible();
});

test('INV-SMART-08: não salva com um nome que já é de outra playlist sua (maiúsculas contam como diferentes)', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  await openSheetFromLibrary(page);
  await page.locator('#smart-prompt').fill('Rock clássico para viagem');
  await page.getByRole('button', { name: 'Criar playlist' }).click();
  await page.getByLabel('Nome da playlist').fill('Rock para viagem');
  await page.getByRole('button', { name: 'Salvar na Biblioteca' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Rock para viagem' })).toBeVisible();

  // Second playlist with the same name: blocked
  await nav(page, 'Biblioteca').click();
  await page.getByRole('button', { name: /^Playlists/ }).click();
  await page.getByRole('button', { name: 'Criar com IA' }).click();
  await page.locator('#smart-prompt').fill('Rock clássico para viagem');
  await page.getByRole('button', { name: 'Criar playlist' }).click();
  await page.getByLabel('Nome da playlist').fill('Rock para viagem');
  await expect(page.getByText('Você já tem uma playlist com esse nome')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar na Biblioteca' })).toBeDisabled();

  // Only the capitalization differs: a different name, allowed
  await page.getByLabel('Nome da playlist').fill('rock para viagem');
  await expect(page.getByText('Você já tem uma playlist com esse nome')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Salvar na Biblioteca' })).toBeEnabled();
});

test('INV-SMART-09: o cartão "Criar playlist com IA" na Início abre a mesma folha', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await page.getByTestId('home-create-ai').click();
  await expect(page.getByRole('heading', { name: 'Criar com IA' })).toBeVisible();
  await expect(page.locator('#smart-prompt')).toBeVisible();
});
