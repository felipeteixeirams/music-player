import { expect, test } from '@playwright/test';
import { nav, stubApi, TOP_HITS } from './fixtures';

const COLLECTION_NAMES = ['Top Hits', 'Classic Rock', 'Alternative & Indie', 'Lofi Chill', 'Synthwave & Retrowave'];

let apiRequests: string[] = [];

test.beforeEach(async ({ page }) => {
  apiRequests = await stubApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
});

test('a tela Início mostra o destaque e um carrossel por coleção', async ({ page }) => {
  await expect(page.getByRole('button', { name: `Reproduzir ${TOP_HITS[0].title}` })).toBeVisible();
  for (const name of COLLECTION_NAMES) {
    await expect(page.locator(`section[aria-label="${name}"]`)).toBeVisible();
  }
});

test('a barra de abas troca de tela e a pílula acompanha a aba ativa', async ({ page }) => {
  for (const [tab, title] of [['Rádio', 'Rádio'], ['Biblioteca', 'Biblioteca'], ['Buscar', 'Buscar'], ['Início', 'Início']] as const) {
    await nav(page, tab).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(nav(page, tab)).toHaveAttribute('aria-current', 'page');

    // The sliding pill settles exactly behind the active tab
    await expect
      .poll(async () => {
        const pill = await page.locator('nav[aria-label="Navegação Principal"] span[aria-hidden]').first().boundingBox();
        const button = await nav(page, tab).boundingBox();
        return pill && button ? Math.abs(pill.x - button.x) : Infinity;
      })
      .toBeLessThan(3);
  }
});

test('Buscar mostra a grade de coleções, busca online e volta à grade ao limpar', async ({ page }) => {
  await nav(page, 'Buscar').click();
  await expect(page.getByRole('heading', { name: 'Explorar tudo' })).toBeVisible();
  for (const name of COLLECTION_NAMES) await expect(page.getByRole('button', { name })).toBeVisible();

  const box = page.getByRole('searchbox', { name: 'Buscar' });
  await box.fill('creed');
  await box.press('Enter');
  await expect(page.getByText('creed - Ao Vivo')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Explorar tudo' })).toBeHidden();

  await box.fill('');
  await expect(page.getByRole('heading', { name: 'Explorar tudo' })).toBeVisible();
});

test('Ver tudo abre a coleção, carrega a próxima página e o botão de voltar retorna', async ({ page }) => {
  await page.getByRole('button', { name: 'Ver todas as faixas de Top Hits' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Top Hits' })).toBeVisible();

  // The feed brought 3 of the 6 tracks; the list asks for the rest by itself as the end of the page comes into view
  const rows = page.locator('main [role=button]');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(rows).toHaveCount(6);
  await expect(page.getByText('Sexta Faixa')).toBeVisible();
  expect(apiRequests).toContain('/api/category?id=top-hits&index=3');
  // ...and stops asking once the collection is complete
  expect(apiRequests.filter((r) => r.startsWith('/api/category'))).toHaveLength(1);

  await page.getByRole('button', { name: 'Início' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
});

test('tocar uma faixa mostra o mini player e abre e fecha o player completo', async ({ page }) => {
  await page.locator('section[aria-label="Top Hits"] [role=button]').first().click();
  const mini = page.getByRole('button', { name: new RegExp(`Abrir player expandido para ${TOP_HITS[0].title}`) });
  await expect(mini).toBeVisible();

  await mini.click();
  await expect(page.getByLabel('Minimizar player expandido')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: TOP_HITS[0].title })).toBeVisible();
  await expect(page.getByLabel('Próxima faixa', { exact: true })).toBeVisible();

  await page.getByLabel('Minimizar player expandido').click();
  await expect(page.getByLabel('Minimizar player expandido')).toBeHidden();
});

test('favoritar leva a faixa à Biblioteca, com Artistas e Álbuns derivados', async ({ page }) => {
  // A favorited heart is renamed "Desfavoritar", so each one is found by its track
  const carousel = page.locator('section[aria-label="Top Hits"]');
  await carousel.getByRole('button', { name: `Favoritar ${TOP_HITS[0].title}`, exact: true }).click();
  await carousel.getByRole('button', { name: `Favoritar ${TOP_HITS[2].title}`, exact: true }).click();

  await nav(page, 'Biblioteca').click();
  await expect(page.getByRole('button', { name: /Músicas favoritas/ })).toContainText('2');
  await expect(page.getByRole('button', { name: /Artistas/ })).toContainText('2');

  await page.getByRole('button', { name: /Artistas/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Artistas' })).toBeVisible();
  await page.getByRole('button', { name: /Artista Dois/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Artista Dois' })).toBeVisible();
  await expect(page.getByText(TOP_HITS[2].title)).toBeVisible();

  // Tapping the tab again goes back to the menu
  await nav(page, 'Biblioteca').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeVisible();
});

test('os favoritos continuam depois de recarregar a página', async ({ page }) => {
  await page.locator('section[aria-label="Top Hits"]').getByRole('button', { name: /^Favoritar/ }).first().click();
  await page.reload();
  await nav(page, 'Biblioteca').click();
  await expect(page.getByRole('button', { name: /Músicas favoritas/ })).toContainText('1');
});

test('a Rádio lista as estações ao vivo e o mix por gênero', async ({ page }) => {
  await nav(page, 'Rádio').click();
  await expect(page.getByRole('heading', { name: 'Ao vivo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pop', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tocar a rádio Estação Pop' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Ouvir .* ao vivo$/ }).first()).toBeVisible();
});

test('o menu de ajustes abre o gerenciador de cache', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: /Gerenciar cache local/ }).click();
  await expect(page.getByText('Gerenciamento de Cache')).toBeVisible();
});
