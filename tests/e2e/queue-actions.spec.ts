import { expect, test } from '@playwright/test';
import { stubApi, TOP_HITS } from './fixtures';

const actionsOf = (page: import('@playwright/test').Page, title: string) => page.getByRole('button', { name: `Mais ações de ${title}`, exact: true });

test('INV-PLAY-28: tocar a seguir e adicionar à fila mudam a ordem da fila, e a faixa que toca não muda', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver todas as faixas de Top Hits' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Top Hits' })).toBeVisible();

  // Start the list at the first track
  await page.locator('main [role=button]', { hasText: TOP_HITS[0].title }).first().click();
  await expect(page.getByRole('button', { name: /Abrir player expandido para Primeira Faixa/ })).toBeVisible();

  // Tocar a seguir: the fifth track plays right after the first
  await actionsOf(page, TOP_HITS[4].title).click();
  const sheet = page.getByRole('dialog', { name: `Ações de ${TOP_HITS[4].title}` });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Tocar a seguir' }).click();
  await expect(sheet).toBeHidden();

  // Adicionar à fila: the sixth track goes to the end
  await actionsOf(page, TOP_HITS[5].title).click();
  await page.getByRole('dialog', { name: `Ações de ${TOP_HITS[5].title}` }).getByRole('button', { name: 'Adicionar à fila' }).click();

  // The queue: the first track (playing), then the fifth (put next), the rest of the list, the sixth again at the end
  await page.getByRole('button', { name: /Abrir player expandido para Primeira Faixa/ }).click();
  await page.getByRole('button', { name: 'Fila de reprodução' }).click();
  const rows = page.getByRole('region', { name: 'Fila de reprodução' }).locator('li');
  await expect(rows).toHaveCount(7);
  await expect(rows.nth(0)).toContainText('Quinta Faixa');
  await expect(rows.nth(1)).toContainText('Segunda Faixa');
  await expect(rows.nth(5)).toContainText('Sexta Faixa');
  await expect(rows.nth(6)).toContainText('Sexta Faixa');
  // The track playing did not change
  await expect(page.getByRole('heading', { level: 2, name: 'Primeira Faixa' })).toBeVisible();
});
