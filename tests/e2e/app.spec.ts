import { expect, test } from '@playwright/test';
import { fakeYouTube, loadedVideo, nav, silentClip, stubApi, TOP_HITS } from './fixtures';

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

test('INV-UI-06: a busca lista artistas, a página do artista toca as mais tocadas e abre os álbuns', async ({ page }) => {
  await nav(page, 'Buscar').click();
  const box = page.getByRole('searchbox', { name: 'Buscar' });
  await box.fill('artista');
  await box.press('Enter');
  const artists = page.locator('section[aria-label="Artistas"]');
  await expect(artists.getByRole('button', { name: 'Artista Teste' })).toBeVisible();

  await artists.getByRole('button', { name: 'Artista Teste' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Artista Teste' })).toBeVisible();
  await expect(page.getByText('1.234.567 ouvintes')).toBeVisible();
  await expect(page.getByText('Músicas mais tocadas')).toBeVisible();
  await expect(page.getByText('Hit Número Dois')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reproduzir', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aleatório' })).toBeVisible();

  await page.getByRole('button', { name: 'Reproduzir', exact: true }).click();
  await expect(page.getByText('Hit Número Um').first()).toBeVisible();

  // Albums: the artist's albums open a page with the tracks in album order; back returns to the artist
  await page.locator('section[aria-label="Álbuns"]').getByRole('button', { name: /Álbum Teste/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Álbum Teste' })).toBeVisible();
  await expect(page.getByText('Artista Teste · 2001')).toBeVisible();
  await expect(page.getByText('Faixa do Álbum Dois')).toBeVisible();
  await page.getByRole('button', { name: 'Artista Teste' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Artista Teste' })).toBeVisible();
  await expect(page.getByText('Hit Número Dois')).toBeVisible();

  // Back goes to the results, still there
  await page.getByRole('button', { name: 'Buscar' }).first().click();
  await expect(artists.getByRole('button', { name: 'Artista Teste' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Ao vivo', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pop', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tocar a rádio Estação Pop' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Ouvir .* ao vivo$/ }).first()).toBeVisible();
});

test('INV-LIVE-04: a Rádio lista emissoras ao vivo por estilo, toca uma delas por áudio nativo e avisa o diretório', async ({ page }) => {
  await nav(page, 'Rádio').click();
  const region = page.getByRole('region', { name: 'Mais rádios ao vivo' });
  await expect(region).toBeVisible();

  await region.getByRole('button', { name: 'Rock' }).click();
  const tile = page.getByRole('button', { name: 'Ouvir Rádio rock Teste ao vivo' });
  await expect(tile).toBeVisible();

  await tile.click();
  await expect(page.getByRole('button', { name: 'Pausar música' })).toBeVisible();
  // The radio plays from an audio tag (no YouTube) and the directory is told, once
  await expect.poll(() => apiRequests.filter((r) => r.startsWith('/api/radio?click=')).length).toBe(1);
  expect(apiRequests.some((r) => r.startsWith('/api/resolve?') && !r.includes('usage'))).toBe(false);
});

test('INV-UI-01: carrosséis e listas não mostram o total de faixas', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Top Hits' })).toBeVisible();
  await expect(page.getByText(/^\d+ (de \d+ )?faixas?$/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Ver todas as faixas de Top Hits' }).click();
  await expect(page.getByRole('heading', { name: 'Top Hits' }).first()).toBeVisible();
  await expect(page.getByText(/^\d+ (de \d+ )?faixas?$/)).toHaveCount(0);
});

test('o menu de ajustes abre o gerenciador de cache', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('button', { name: /Gerenciar cache local/ }).click();
  await expect(page.getByText('Gerenciamento de Cache')).toBeVisible();
});

test('sem outras versões da faixa, o player completo não oferece "Outra versão"', async ({ page }) => {
  await page.locator('section[aria-label="Top Hits"] [role=button]').first().click();
  await page.getByRole('button', { name: /Abrir player expandido/ }).click();
  await expect(page.getByLabel('Minimizar player expandido')).toBeVisible();
  await expect(page.getByLabel('Tocar outra versão desta faixa')).toBeHidden();
});

test.describe('com duas versões da faixa no YouTube', () => {
  const FIRST = 'AAAAAAAAAAA';
  const SECOND = 'BBBBBBBBBBB';

  test.beforeEach(async ({ page }) => {
    // The hidden player is a fake; nothing here may reach YouTube
    await fakeYouTube(page);
    apiRequests = await stubApi(page, { videoIds: [FIRST, SECOND] });
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  });

  test('"Outra versão" troca o vídeo, avisa qual e lembra a escolha depois de recarregar', async ({ page }) => {
    await page.locator('section[aria-label="Top Hits"] [role=button]').first().click();
    await expect.poll(() => loadedVideo(page)).toBe(FIRST);

    await page.getByRole('button', { name: /Abrir player expandido/ }).click();
    await page.getByLabel('Tocar outra versão desta faixa').click();
    await expect.poll(() => loadedVideo(page)).toBe(SECOND);
    await expect(page.getByText('Tocando outra versão (2 de 2).').first()).toBeVisible();

    // Again: wraps around to the first
    await page.getByLabel('Tocar outra versão desta faixa').click();
    await expect.poll(() => loadedVideo(page)).toBe(FIRST);
    await expect(page.getByText('Tocando outra versão (1 de 2).').first()).toBeVisible();

    // Leave it on the second and play the same track after a reload: the second plays first
    await page.getByLabel('Tocar outra versão desta faixa').click();
    await expect.poll(() => loadedVideo(page)).toBe(SECOND);
    await page.reload();
    await page.locator('section[aria-label="Top Hits"] [role=button]').first().click();
    await expect.poll(() => loadedVideo(page)).toBe(SECOND);
  });
});

test.describe('playlists', () => {
  const addToPlaylist = async (page: import('@playwright/test').Page, title: string, playlist: string) => {
    await page.getByRole('button', { name: `Adicionar ${title} a uma playlist`, exact: true }).click();
    await page.getByRole('button', { name: new RegExp(playlist) }).click();
    await page.getByRole('button', { name: 'Pronto' }).click();
  };

  test('criar, adicionar faixas, tocar, remover e manter depois de recarregar', async ({ page }) => {
    await nav(page, 'Biblioteca').click();
    await page.getByRole('button', { name: /^Playlists/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Playlists' })).toBeVisible();

    await page.getByRole('button', { name: 'Nova playlist' }).click();
    await page.getByRole('textbox', { name: 'Nome da playlist' }).fill('Estrada');
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Estrada' })).toBeVisible();
    await expect(page.getByText('Esta playlist está vazia')).toBeVisible();

    // Add two tracks of a collection through the sheet
    await nav(page, 'Início').click();
    await page.getByRole('button', { name: 'Ver todas as faixas de Top Hits' }).click();
    await addToPlaylist(page, TOP_HITS[0].title, 'Estrada');
    await addToPlaylist(page, TOP_HITS[1].title, 'Estrada');

    await nav(page, 'Biblioteca').click();
    await page.getByRole('button', { name: /^Playlists/ }).click();
    await expect(page.getByRole('button', { name: /Estrada/ })).toContainText('2');
    await page.getByRole('button', { name: /Estrada/ }).click();
    const rows = page.locator('main [role=button]');
    await expect(rows).toHaveCount(2);

    await page.getByRole('button', { name: 'Tocar', exact: true }).click();
    await expect(page.getByRole('button', { name: new RegExp(`Abrir player expandido para ${TOP_HITS[0].title}`) })).toBeVisible();

    await page.getByRole('button', { name: `Remover ${TOP_HITS[0].title} da playlist`, exact: true }).click();
    await expect(rows).toHaveCount(1);

    await page.reload();
    await nav(page, 'Biblioteca').click();
    await page.getByRole('button', { name: /^Playlists/ }).click();
    await expect(page.getByRole('button', { name: /Estrada/ })).toContainText('1');
  });

  test('uma faixa pode ir para uma playlist nova direto da folha, e o player completo também a abre', async ({ page }) => {
    await page.locator('section[aria-label="Top Hits"] [role=button]').first().click();
    await page.getByRole('button', { name: /Abrir player expandido/ }).click();
    await page.getByLabel('Adicionar esta faixa a uma playlist').click();

    await page.getByRole('button', { name: 'Nova playlist' }).click();
    await page.getByRole('textbox', { name: 'Nome da playlist' }).fill('Treino');
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByRole('button', { name: /Treino/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Pronto' }).click();

    await page.getByLabel('Minimizar player expandido').click();
    await nav(page, 'Biblioteca').click();
    await page.getByRole('button', { name: /^Playlists/ }).click();
    await expect(page.getByRole('button', { name: /Treino/ })).toContainText('1');
  });

  test('tocar de novo na faixa já adicionada tira da playlist; renomear e apagar funcionam', async ({ page }) => {
    await page.getByRole('button', { name: 'Ver todas as faixas de Top Hits' }).click();
    await page.getByRole('button', { name: `Adicionar ${TOP_HITS[0].title} a uma playlist`, exact: true }).click();
    await page.getByRole('button', { name: 'Nova playlist' }).click();
    await page.getByRole('textbox', { name: 'Nome da playlist' }).fill('Casa');
    await page.getByRole('button', { name: 'Criar' }).click();
    // Tapping a playlist that already has the track takes it out
    await page.getByRole('button', { name: /Casa/ }).click();
    await expect(page.getByRole('button', { name: /Casa/ })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Pronto' }).click();

    await nav(page, 'Biblioteca').click();
    await page.getByRole('button', { name: /^Playlists/ }).click();
    await page.getByRole('button', { name: /Casa/ }).click();

    await page.getByRole('button', { name: 'Renomear playlist' }).click();
    await page.getByRole('textbox', { name: 'Nome da playlist' }).fill('Sala');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sala' })).toBeVisible();

    await page.getByRole('button', { name: 'Apagar playlist' }).click();
    await page.getByRole('button', { name: 'Apagar', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Playlists' })).toBeVisible();
    await expect(page.getByText('Crie uma playlist e adicione faixas')).toBeVisible();
  });
});

test.describe('catálogo fora do ar', () => {
  /** Makes /api/feed fail while `down.value` is true, and otherwise lets the normal stub answer. */
  const feedDown = async (page: import('@playwright/test').Page) => {
    const down = { value: true };
    await page.route('**/api/feed', (route) =>
      down.value
        ? route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Catálogo fora do ar' }) })
        : route.fallback()
    );
    return down;
  };

  test('a home abre com a última lista salva, avisa e atualiza quando o catálogo volta', async ({ page }) => {
    // beforeEach already loaded the home once with the catalog answering, so a copy is saved on the device
    const down = await feedDown(page);
    await page.reload();

    await expect(page.locator('section[aria-label="Top Hits"]')).toBeVisible();
    await expect(page.getByText(TOP_HITS[0].title).first()).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'mostrando a lista salva' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    down.value = false;
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByText('mostrando a lista salva')).toBeHidden();
    await expect(page.locator('section[aria-label="Top Hits"]')).toBeVisible();
  });

  test('sem lista salva, o erro aparece com "Tentar de novo" e a home carrega quando o catálogo volta', async ({ page }) => {
    // The feed of the first load is saved when it arrives: wait for it, or it could be saved again after the removal
    await expect(page.locator('section[aria-label="Top Hits"]')).toBeVisible();
    await page.evaluate(() => localStorage.removeItem('aurastream_feed_cache'));
    const down = await feedDown(page);
    await page.reload();

    await expect(page.getByRole('alert')).toContainText('Catálogo fora do ar');
    await expect(page.locator('section[aria-label="Top Hits"]')).toBeHidden();

    down.value = false;
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.locator('section[aria-label="Top Hits"]')).toBeVisible();
  });

  test('a cópia salva é a do último carregamento que deu certo', async ({ page }) => {
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('aurastream_feed_cache') ?? 'null'));
    expect(saved.feed.categories['top-hits'].tracks).toHaveLength(3);
    expect(typeof saved.savedAt).toBe('number');
  });
});


test.describe('cota diária de faixas novas', () => {
  test('os Ajustes mostram quantas faixas novas já foram trazidas hoje', async ({ page }) => {
    await stubApi(page, { usedToday: 12 });
    await page.reload();
    await page.getByRole('button', { name: 'Abrir ajustes' }).click();
    await expect(page.getByTestId('daily-usage')).toHaveText('Faixas novas hoje: 12 de 30');
  });

  test('com a cota acabada a faixa toca a prévia e avisa o motivo', async ({ page }) => {
    // A real preview lasts 30 s: long enough for the answer about the quota to arrive while it plays
    await stubApi(page, { quotaExceeded: true, previewUrl: silentClip(20) });
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
    await page.locator('section[aria-label="Top Hits"] [role=button]').first().click();
    await expect(page.getByText(/limite de faixas novas de hoje/).first()).toBeVisible();
  });
});

test('INV-UI-04: Ajustes > Aparência troca o esquema e lembra a escolha', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  const root = page.locator('html');
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  const group = page.getByRole('radiogroup', { name: 'Aparência' });
  await group.getByRole('radio', { name: 'Claro' }).click();
  await expect(root).toHaveClass(/scheme-light/);
  await page.reload();
  await expect(root).toHaveClass(/scheme-light/);
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByRole('radiogroup', { name: 'Aparência' }).getByRole('radio', { name: 'Escuro' }).click();
  await expect(root).not.toHaveClass(/scheme-light/);
});
