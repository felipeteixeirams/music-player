import { expect, test, type Page } from '@playwright/test';
import { fakeYouTube, loadedVideo, nav, silentClip, stubApi, TOP_HITS } from './fixtures';

const COLLECTION_NAMES = ['Top Hits', 'Classic Rock', 'Alternative & Indie', 'Lofi Chill', 'Synthwave & Retrowave'];

let apiRequests: string[] = [];

test.beforeEach(async ({ page }) => {
  apiRequests = await stubApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
});

test('a tela Início mostra os cartões personalizados e um carrossel por coleção', async ({ page }) => {
  await expect(page.locator('section[aria-label="Escolhidos para você"]')).toBeVisible();
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

test('INV-UI-06: a busca lista artistas, a página do artista toca as mais tocadas abre os álbuns e os artistas semelhantes', async ({ page }) => {
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

  // Related artists open another artist page; back returns to the first one, then to the results
  await page.locator('section[aria-label="Artistas semelhantes"]').getByRole('button', { name: 'Artista Parecido' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Artista Parecido' })).toBeVisible();
  await expect(page.getByText('Sucesso do Parecido')).toBeVisible();
  await page.getByRole('button', { name: 'Artista Teste' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Artista Teste' })).toBeVisible();

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
    await page.getByLabel('Salvar nos favoritos e em playlists').click();

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

test('INV-OBS-01/03: as chamadas levam os ids de rastreio e um erro não tratado é reportado com o código da sessão', async ({ page }) => {
  const requests = await stubApi(page);
  const headers: Record<string, string>[] = [];
  const reports: { kind: string; message: string; mode: string }[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/feed') headers.push(request.headers());
    if (url.pathname === '/api/report') reports.push(request.postDataJSON());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  expect(requests.some((r) => r.startsWith('/api/feed'))).toBe(true);
  expect(headers[0]['x-request-id']).toMatch(/^[0-9a-f]{10}$/);
  expect(headers[0]['x-session-id']).toMatch(/^[0-9a-f]{12}$/);

  // An error nobody handled: the app tells the server's log, once, however many times it happens
  await page.evaluate(() => {
    for (let i = 0; i < 3; i += 1) setTimeout(() => { throw new Error('falha de teste'); }, 0);
  });
  await expect.poll(() => reports.length).toBe(1);
  expect(reports[0]).toMatchObject({ kind: 'error', message: expect.stringContaining('falha de teste'), mode: 'browser' });
});

test.describe('tocar na aba já aberta', () => {
  const scrollY = (page: import('@playwright/test').Page) => page.evaluate(() => Math.round(window.scrollY));
  const makeTall = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      document.body.style.minHeight = '4000px';
      window.scrollTo(0, 1500);
    });

  test('INV-UI-07: rola ao topo com animação (não de um salto) e sem pedir nada à rede', async ({ page }) => {
    const requests = await stubApi(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
    await makeTall(page);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(1000);
    const before = requests.length;

    // Samples of the position as it travels, taken in the page's own frames
    const samples = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const seen: number[] = [];
          const nav = [...document.querySelectorAll('nav button')].find((b) => b.textContent?.includes('Início')) as HTMLElement;
          nav.click();
          const tick = () => {
            seen.push(Math.round(window.scrollY));
            if (window.scrollY > 0 && seen.length < 200) requestAnimationFrame(tick);
            else resolve(seen);
          };
          requestAnimationFrame(tick);
        })
    );
    expect(samples[samples.length - 1]).toBe(0);
    expect(samples.length).toBeGreaterThan(10);
    // Never goes back down, starts gently (the first step is small) and brakes at the end (the last steps are small)
    expect(samples.every((value, i) => i === 0 || value <= samples[i - 1])).toBe(true);
    const steps = samples.slice(1).map((value, i) => samples[i] - value);
    const biggest = Math.max(...steps);
    expect(steps[0]).toBeLessThan(biggest / 2);
    expect(steps[steps.length - 2] ?? 0).toBeLessThan(biggest / 2);
    // Nothing is reloaded (the shared-cache lookup of the visible tracks is not part of the scroll)
    expect(requests.slice(before).filter((request) => !request.startsWith('/api/resolve'))).toEqual([]);
  });

  test('INV-UI-07: com "reduzir movimento" vai direto ao topo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stubApi(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
    await makeTall(page);
    await nav(page, 'Início').click();
    await expect.poll(() => scrollY(page)).toBe(0);
  });

  test('INV-UI-07: com uma coleção aberta o toque só a fecha, como antes', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Ver todas as faixas de Top Hits' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Top Hits' })).toBeVisible();
    await nav(page, 'Início').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  });
});

test.describe('cartões personalizados da home', () => {
  test('INV-HOME-01: o humor da hora aparece sem histórico, os favoritos entram com 5 curtidas e o cartão abre a lista', async ({ page }) => {
    // Evening: the mood is the Top Hits collection, which the stubbed feed has
    await page.clock.setFixedTime(new Date(2026, 9, 28, 20, 0, 0));
    await stubApi(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();

    const cards = page.locator('section[aria-label="Escolhidos para você"]');
    await expect(cards.getByRole('heading', { name: 'Escolhidos para você' })).toBeVisible();
    await expect(cards.locator('[data-mix]')).toHaveCount(1);
    // The old "top of Brazil" highlight is gone: the cards are the top of the home
    await expect(page.getByText('NO TOPO DO BRASIL AGORA')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Reproduzir Primeira Faixa$/ })).toHaveCount(0);
    const mood = cards.locator('[data-mix="mood"]');
    await expect(mood).toContainText('Humor para você');
    await expect(mood).toContainText('Para a noite');
    // Nothing to build the others from yet
    await expect(cards.locator('[data-mix="favorites"]')).toHaveCount(0);

    // Five favorites (the carousels of Top Hits and Classic Rock show three each)
    const hits = page.locator('section[aria-label="Top Hits"]');
    for (const hit of TOP_HITS.slice(0, 3)) await hits.getByRole('button', { name: `Favoritar ${hit.title}`, exact: true }).click();
    const rock = page.locator('section[aria-label="Classic Rock"]');
    await rock.getByRole('button', { name: /^Favoritar/ }).nth(0).click();
    await rock.getByRole('button', { name: /^Favoritar/ }).nth(1).click();
    await expect(cards.locator('[data-mix="favorites"]')).toBeVisible();

    // Open one: its page has the header, Reproduzir and Aleatório and the tracks; back returns to the home
    await cards.locator('[data-mix="favorites"]').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Seus favoritos' })).toBeVisible();
    await expect(page.getByTestId('mix-page')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reproduzir', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aleatório' })).toBeVisible();
    await page.getByRole('button', { name: 'Início' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
    await expect(cards.locator('[data-mix="mood"]')).toBeVisible();
  });
});

test('INV-UI-08: Ajustes é uma tela com seções (conta, aparência, armazenamento, ajuda, sobre) e o OK volta ao app', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajustes' });
  for (const name of ['Conta', 'Aparência', 'Armazenamento e dados', 'Ajuda', 'Sobre']) {
    await expect(dialog.getByRole('region', { name })).toBeVisible();
  }
  await expect(page.getByTestId('app-version')).not.toBeEmpty();
  await expect(page.getByTestId('session-code')).not.toBeEmpty();
  await page.getByRole('button', { name: 'Fechar ajustes' }).click();
  await expect(dialog).toBeHidden();
});

test.describe('painel de administrador', () => {
  test('INV-ADMIN-01: quem não é administrador não vê a linha "Administração" em Ajustes', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Abrir ajustes' }).click();
    await expect(page.getByTestId('app-version')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Administração' })).toHaveCount(0);
  });

  test('INV-ADMIN-02: o administrador abre o painel com a busca do YouTube, o uso por pessoa, o cache e a configuração', async ({ page }) => {
    await stubApi(page, { admin: true });
    await page.goto('/');
    await page.getByRole('button', { name: 'Abrir ajustes' }).click();
    await page.getByRole('button', { name: 'Painel de administrador' }).click();
    const panel = page.getByRole('dialog', { name: 'Administração' });
    await expect(page.getByTestId('admin-youtube')).toContainText('Suspensa (quota)');
    await expect(page.getByTestId('admin-searches')).toHaveText('12');
    await expect(page.getByTestId('admin-cache')).toHaveText('120');
    await expect(panel.getByText('ana@example.com')).toBeVisible();
    await expect(panel.getByText('9 de 30')).toBeVisible();
    await expect(panel.getByText('Aviso: service-key')).toBeVisible();
    await page.getByRole('button', { name: 'Fechar administração' }).click();
    await expect(panel).toBeHidden();
  });
});

test.describe('player expandido', () => {
  const openExpanded = async (page: Page, options: Parameters<typeof stubApi>[1] = {}) => {
    await stubApi(page, options);
    await page.goto('/');
    await page.locator('section[aria-label="Top Hits"] [role=button]').first().click();
    await page.getByRole('button', { name: /Abrir player expandido/ }).click();
  };

  test('INV-UI-09: o player expandido não tem abas Capa/Frequência/Letra nem controle de volume', async ({ page }) => {
    await openExpanded(page);
    await expect(page.getByRole('button', { name: 'Minimizar player expandido' })).toBeVisible();
    for (const name of ['Capa', 'Frequência', 'Letra']) await expect(page.getByRole('button', { name: name, exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Volume da reprodução')).toHaveCount(0);
    await expect(page.getByLabel('Silenciar')).toHaveCount(0);
    await expect(page.getByAltText(/Capa do álbum/)).toBeVisible();
  });

  test('INV-UI-09: um botão só salva: o primeiro toque curte a faixa e abre a folha "Conteúdo salvo em:" com Músicas curtidas marcada e as playlists', async ({ page }) => {
    await openExpanded(page);
    await page.getByRole('button', { name: 'Salvar nos favoritos e em playlists' }).click();
    const sheet = page.getByRole('dialog', { name: 'Salvar em favoritos e playlists' });
    await expect(sheet.getByText('Conteúdo salvo em:')).toBeVisible();
    await expect(sheet.getByRole('button', { name: /Músicas curtidas/ })).toHaveAttribute('aria-pressed', 'true');
    // New playlist from the sheet puts the song in it right away
    await sheet.getByRole('button', { name: 'Nova playlist' }).click();
    await page.getByRole('textbox', { name: 'Nome da playlist' }).fill('Treino');
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(sheet.getByRole('button', { name: /Treino/ })).toHaveAttribute('aria-pressed', 'true');
    await sheet.getByRole('button', { name: 'Pronto' }).click();
    // Saved now: the button says so, and the next tap manages instead of toggling
    await expect(page.getByRole('button', { name: 'Salvo: gerenciar favoritos e playlists' })).toBeVisible();
    await page.getByRole('button', { name: 'Salvo: gerenciar favoritos e playlists' }).click();
    await sheet.getByRole('button', { name: /Músicas curtidas/ }).click();
    await expect(sheet.getByRole('button', { name: /Músicas curtidas/ })).toHaveAttribute('aria-pressed', 'false');
  });

  test('INV-UI-10: o botão Letra (embaixo, à esquerda) põe a letra no lugar da capa; tocar numa linha pula para ela; tocar de novo volta à capa', async ({ page }) => {
    await openExpanded(page, { lyrics: true, previewUrl: silentClip(20) });
    await expect(page.getByAltText(/Capa do álbum/).first()).toBeVisible();
    const toggle = page.getByRole('button', { name: 'Letra', exact: true });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const lyrics = page.getByRole('region', { name: 'Letra da música' });
    await expect(lyrics.getByText('Terceira linha')).toBeVisible();
    // The cover shrinks to the header with the song and the save button; the controls stay
    await expect(page.getByRole('button', { name: 'Salvar nos favoritos e em playlists' })).toBeVisible();
    await expect(page.getByLabel('Linha do tempo da música')).toBeVisible();
    await lyrics.getByText('Terceira linha').click();
    await expect(lyrics.locator('[data-active]')).toHaveText('Terceira linha');
    await toggle.click();
    await expect(lyrics).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('INV-UI-10: o botão Fila (embaixo, à direita) mostra "Continue tocando" com as próximas faixas; tocar numa toca; tocar de novo volta à capa', async ({ page }) => {
    await openExpanded(page);
    const toggle = page.getByRole('button', { name: 'Fila de reprodução', exact: true });
    await toggle.click();
    const queue = page.getByRole('region', { name: 'Fila de reprodução' });
    await expect(queue.getByText('Continue tocando')).toBeVisible();
    await expect(queue.getByText('Segunda Faixa')).toBeVisible();
    await queue.getByRole('button', { name: /Segunda Faixa/ }).click();
    // It plays now, so the list moves on: it no longer lists it among the next ones
    await expect(queue.getByRole('button', { name: /Segunda Faixa/ })).toHaveCount(0);
    await expect(queue.getByRole('button', { name: /Terceira Faixa/ })).toBeVisible();
    await toggle.click();
    await expect(queue).toBeHidden();
  });

  test('INV-UI-10: enquanto a letra é buscada nada aparece; o botão Letra surge só quando ela é encontrada', async ({ page }) => {
    await stubApi(page, { previewUrl: silentClip(20) });
    await page.route('https://lrclib.net/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify([{ syncedLyrics: '[00:00.00]Primeira linha\n[00:02.00]Segunda linha' }]) });
    });
    await page.goto('/');
    await page.locator('section[aria-label="Top Hits"] [role=button]').first().click();
    await page.getByRole('button', { name: /Abrir player expandido/ }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText(/Buscando a letra/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Letra', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Letra', exact: true })).toBeVisible({ timeout: 6000 });
  });

  test('sem letra disponível o botão Letra não aparece', async ({ page }) => {
    await openExpanded(page);
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: 'Letra', exact: true })).toHaveCount(0);
  });
});
