import type { Page, Route } from '@playwright/test';
import { STORAGE_KEY, testUser } from './supabaseMock';

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

/** A silent half-second clip, so a track can have a catalog preview without any request leaving the machine. */
export const SILENT_PREVIEW =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

/** What a stubbed track plays: a preview URL, and optionally a short length (so a "play" is over in seconds). */
export interface PlayableOverride {
  previewUrl: string;
  durationSeconds?: number;
}

/** Gives every track in a response a preview URL (and length). */
function withPreview<T>(value: T, override: PlayableOverride): T {
  if (Array.isArray(value)) return value.map((item) => withPreview(item, override)) as T;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if ('sources' in object && object.sources && typeof object.sources === 'object') {
      return {
        ...object,
        ...(override.durationSeconds ? { duration: override.durationSeconds } : {}),
        sources: { ...(object.sources as object), previewUrl: override.previewUrl }
      } as T;
    }
    return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, withPreview(item, override)])) as T;
  }
  return value;
}

/** A silent clip of the given length (8 kHz, 8-bit mono), as a data URL: it really plays, with no request. */
export function silentClip(seconds: number): string {
  const samples = 8000 * seconds;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(8000, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(samples, 40);
  const body = Buffer.alloc(samples, 128);
  return `data:audio/wav;base64,${Buffer.concat([header, body]).toString('base64')}`;
}

/** Stubs every catalog route of the app. Returns the list of API requests the page made. */
export async function stubApi(target: Page, options: { videoIds?: string[]; signedIn?: boolean; user?: ReturnType<typeof testUser>; quotaExceeded?: boolean; usedToday?: number; previewUrl?: string; shortTracks?: boolean } = {}): Promise<string[]> {
  const requests: string[] = [];

  // Signed in by default, as a person of its own (so parallel tests never share an account). Seeded once per tab, so signing out (and reloading) stays signed out
  if (options.signedIn !== false) {
    await target.addInitScript(
      ([key, session]) => {
        if (sessionStorage.getItem('e2e-seeded')) return;
        sessionStorage.setItem('e2e-seeded', '1');
        localStorage.setItem(key, session);
      },
      [STORAGE_KEY, JSON.stringify((options.user ?? testUser()).session)]
    );
  }

  await target.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const override: PlayableOverride | null = options.shortTracks
      ? { previewUrl: silentClip(4), durationSeconds: 4 }
      : options.previewUrl
      ? { previewUrl: options.previewUrl }
      : null;
    const reply = (route: Route, body: unknown) => json(route, override ? withPreview(body, override) : body);
    requests.push(`${url.pathname}${url.search}`);

    if (url.pathname === '/api/feed') {
      const categories = Object.fromEntries(Object.keys(COLLECTIONS).map((id) => [id, collectionPage(id, 0)]));
      return reply(route, { categories, featured: TOP_HITS[0] });
    }
    if (url.pathname === '/api/category') {
      return reply(route, collectionPage(url.searchParams.get('id') ?? '', Number(url.searchParams.get('index') ?? 0)));
    }
    if (url.pathname === '/api/search') {
      const q = url.searchParams.get('q') ?? '';
      return reply(route, page([track(101, `${q} - Ao Vivo`, 'Intérprete Busca'), track(102, `${q} - Acústico`, 'Intérprete Busca')]));
    }
    if (url.pathname === '/api/radio') {
      if (url.searchParams.has('id')) return reply(route, page([track(201, 'Faixa da Rádio', 'Artista Rádio')]));
      return reply(route, {
        genres: [{ id: 'pop', name: 'Pop', stations: [{ id: 1, name: 'Estação Pop', picture: null }, { id: 2, name: 'Estação Hits', picture: null }] }]
      });
    }
    // The same-origin copy of a catalog preview, for the Downloads
    if (url.pathname === '/api/audio') {
      return route.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.from(SILENT_PREVIEW.split(',')[1], 'base64') });
    }
    if (url.pathname === '/api/resolve') {
      if (route.request().method() === 'POST') return json(route, { ok: true });
      if (url.searchParams.has('usage')) return json(route, { enabled: true, used: options.usedToday ?? 4, limit: 30 });
      if (options.quotaExceeded) return json(route, { videoIds: [], quota: { used: 30, limit: 30, exceeded: true } });
      return json(route, { videoIds: options.videoIds ?? [] });
    }
    return route.continue();
  });

  // Lyrics are looked up on a third-party service when the full-screen player opens
  await target.route('https://lrclib.net/**', (route) => route.fulfill({ status: 404, body: '[]' }));

  return requests;
}

export const nav = (target: Page, tab: 'Início' | 'Rádio' | 'Biblioteca' | 'Buscar') =>
  target.locator(`nav[aria-label="Navegação Principal"] button[aria-label="${tab}"]`);
