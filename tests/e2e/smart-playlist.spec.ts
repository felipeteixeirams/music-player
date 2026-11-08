import { expect, test } from '@playwright/test';
import { nav, stubApi } from './fixtures';

test('encomendar playlist inteligente com IA, validar e salvar na Biblioteca', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');

  // 1. Navegar até Biblioteca -> Playlists
  await nav(page, 'Biblioteca').click();
  await page.getByRole('button', { name: /^Playlists/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Playlists' })).toBeVisible();

  // 2. Clicar em "Playlist Inteligente"
  const aiButton = page.getByRole('button', { name: /Playlist Inteligente/ });
  await expect(aiButton).toBeVisible();
  await aiButton.click();

  // 3. O modal de playlist inteligente abre
  await expect(page.getByRole('heading', { name: 'Playlist Inteligente' })).toBeVisible();

  // 4. Preencher prompt e gerar
  const textarea = page.locator('#smart-prompt');
  await textarea.fill('Rock clássico para viagem');

  const generateButton = page.getByRole('button', { name: 'Gerar Playlist' });
  await expect(generateButton).toBeEnabled();
  await generateButton.click();

  // 5. O resultado com checklist de validação é exibido
  await expect(page.getByText('Montagem verificada e aprovada')).toBeVisible();
  await expect(page.getByText('Bohemian Rhapsody')).toBeVisible();
  await expect(page.getByText('Hotel California')).toBeVisible();

  // 6. Salvar na biblioteca
  const saveButton = page.getByRole('button', { name: /Salvar na Biblioteca/ });
  await expect(saveButton).toBeVisible();
  await saveButton.click();

  // 7. A nova playlist abre na tela com suas faixas
  await expect(page.getByText('Bohemian Rhapsody')).toBeVisible();
  await expect(page.getByText('Hotel California')).toBeVisible();
});
