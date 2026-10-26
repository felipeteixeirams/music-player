import type { Page, Route } from '@playwright/test';
import { STORAGE_KEY, STORED_SESSION } from './supabaseMock';

/** A 1x1 cover, inline, so no test reaches for the network. */
const COVER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="%23e8344b"/></svg>';

export interface FakeTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  style: string;
  categoryId: string;
  sources: { localUrl: string; previewUrl?: string };
}

export function track(id: number, title: string, artist: string, album = 'Álbum de Teste'): FakeTrack {
  return {
    id: `deezer-${id}`,
    title,
    artist,
    album,
    duration: 180,
    coverUrl: COVER,
    style: 'Teste',
    categoryId: 'web',
    sources: { localUrl: '' }
  };
}

const page = (tracks: FakeTrack[], total = tracks.length, nextIndex: number | null = null) => ({ tracks, total, nextIndex });

/** Top Hits has 6 tracks served in two pages of 3, to exercise pagination; the other collections have 3. */
export const TOP_HITS = [
  track(1, 'Primeira Faixa', 'Artista Um'),
  track(2, 'Segunda Faixa', 'Artista Um'),
  track(3, 'Terceira Faixa', 'Artista Dois', 'Outro Álbum'),
  track(4, 'Quarta Faixa', 'Artista Dois', 'Outro Álbum'),
  track(5, 'Quinta Faixa', 'Artista Três'),
  track(6, 'Sexta Faixa', 'Artista Três')
];

const COLLECTIONS: Record<string, FakeTrack[]> = {
  'top-hits': TOP_HITS,
  'classic-rock': [track(11, 'Rock Um', 'Banda A'), track(12, 'Rock Dois', 'Banda A'), track(13, 'Rock Três', 'Banda B')],
  'alternative-pop': [track(21, 'Indie Um', 'Banda C'), track(22, 'Indie Dois', 'Banda C'), track(23, 'Indie Três', 'Banda D')],
  'lofi-chill': [track(31, 'Lofi Um', 'Produtor X'), track(32, 'Lofi Dois', 'Produtor X'), track(33, 'Lofi Três', 'Produtor Y')],
  synthwave: [track(41, 'Synth Um', 'Duo Z'), track(42, 'Synth Dois', 'Duo Z'), track(43, 'Synth Três', 'Duo W')]
};

const PAGE_SIZE = 3;

function collectionPage(id: string, index: number) {
  const all = COLLECTIONS[id] ?? [];
  const tracks = all.slice(index, index + PAGE_SIZE);
  const next = index + PAGE_SIZE;
  return page(tracks, all.length, next < all.length ? next : null);
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Stubs every catalog route of the app. Returns the list of API requests the page made. */
export async function stubApi(target: Page, options: { videoIds?: string[]; signedIn?: boolean } = {}): Promise<string[]> {
  const requests: string[] = [];

  // Signed in by default, as a returning user. Seeded once per tab, so signing out (and reloading) stays signed out
  if (options.signedIn !== false) {
    await target.addInitScript(
      ([key, session]) => {
        if (sessionStorage.getItem('e2e-seeded')) return;
        sessionStorage.setItem('e2e-seeded', '1');
        localStorage.setItem(key, session);
      },
      [STORAGE_KEY, JSON.stringify(STORED_SESSION)]
    );
  }

  await target.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    requests.push(`${url.pathname}${url.search}`);

    if (url.pathname === '/api/feed') {
      const categories = Object.fromEntries(Object.keys(COLLECTIONS).map((id) => [id, collectionPage(id, 0)]));
      return json(route, { categories, featured: TOP_HITS[0] });
    }
    if (url.pathname === '/api/category') {
      return json(route, collectionPage(url.searchParams.get('id') ?? '', Number(url.searchParams.get('index') ?? 0)));
    }
    if (url.pathname === '/api/search') {
      const q = url.searchParams.get('q') ?? '';
      return json(route, page([track(101, `${q} - Ao Vivo`, 'Intérprete Busca'), track(102, `${q} - Acústico`, 'Intérprete Busca')]));
    }
    if (url.pathname === '/api/radio') {
      if (url.searchParams.has('id')) return json(route, page([track(201, 'Faixa da Rádio', 'Artista Rádio')]));
      return json(route, {
        genres: [{ id: 'pop', name: 'Pop', stations: [{ id: 1, name: 'Estação Pop', picture: null }, { id: 2, name: 'Estação Hits', picture: null }] }]
      });
    }
    if (url.pathname === '/api/resolve') return json(route, { videoIds: options.videoIds ?? [] });
    return route.continue();
  });

  // Lyrics are looked up on a third-party service when the full-screen player opens
  await target.route('https://lrclib.net/**', (route) => route.fulfill({ status: 404, body: '[]' }));

  return requests;
}

export const nav = (target: Page, tab: 'Início' | 'Rádio' | 'Biblioteca' | 'Buscar') =>
  target.locator(`nav[aria-label="Navegação Principal"] button[aria-label="${tab}"]`);
