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
  synthwave: [track(41, 'Synth Um', 'Duo Z'), track(42, 'Synth Dois', 'Duo Z'), track(43, 'Synth Três', 'Duo W')],
  // The "Humor para você" card takes its collection from the hour of the day (mpb in the morning, pop-internacional in the
  // afternoon, top-hits at night, lofi-chill at dawn): all four must exist here or the home test fails at some hours
  mpb: [track(51, 'MPB Um', 'Cantor M'), track(52, 'MPB Dois', 'Cantor M'), track(53, 'MPB Três', 'Cantora N')],
  'pop-internacional': [track(61, 'Pop Um', 'Star P'), track(62, 'Pop Dois', 'Star P'), track(63, 'Pop Três', 'Star Q')]
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

/** A preview address whose signature expired long ago, and the new one the server hands out. */
export const STALE_PREVIEW = 'https://cdn-preview.example/t.mp3?hdnea=exp=1000000000~acl=/t.mp3*~hmac=old';
export const FRESH_PREVIEW = 'https://cdn-preview.example/t.mp3?hdnea=exp=9999999999~acl=/t.mp3*~hmac=new&fresh=1';

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
export async function stubApi(target: Page, options: { videoIds?: string[]; signedIn?: boolean; user?: ReturnType<typeof testUser>; quotaExceeded?: boolean; warmSkipped?: boolean; usedToday?: number; admin?: boolean; lyrics?: boolean; otherVideoIds?: string[]; avoids?: string[]; reports?: string[]; previewUrl?: string; stalePreview?: boolean; shortTracks?: boolean; cachedVideos?: Record<string, string[]>; lookups?: string[][]; warms?: string[] } = {}): Promise<string[]> {
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
    const override: PlayableOverride | null = options.stalePreview
      ? { previewUrl: STALE_PREVIEW }
      : options.shortTracks
      ? { previewUrl: silentClip(4), durationSeconds: 4 }
      : options.previewUrl
      ? { previewUrl: options.previewUrl }
      : null;
    const reply = (route: Route, body: unknown) => json(route, override ? withPreview(body, override) : body);
    requests.push(`${url.pathname}${url.search}`);

    if (url.pathname === '/api/report') return route.fulfill({ status: 204 });
    if (url.pathname === '/api/admin') {
      if (url.searchParams.has('me')) return json(route, { admin: options.admin === true });
      if (!options.admin) return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Acesso restrito"}' });
      return json(route, {
        day: '2026-10-29',
        youtube: { search: 'suspended', reason: 'quota', until: Date.parse('2026-10-29T07:00:00Z'), searchesToday: 12, unitsUpperBound: 1200 },
        limits: { dailyNewTracks: 30 },
        people: { counted: 2, accounts: 3, perPerson: [{ email: 'ana@example.com', used: 9 }, { email: 'felipe@example.com', used: 3 }] },
        cache: { tracks: 120 },
        config: [{ id: 'service-key', level: 'warn', message: 'chave de serviço ausente' }],
        database: 'ok'
      });
    }
    if (url.pathname === '/api/feed') {
      const categories = Object.fromEntries(Object.keys(COLLECTIONS).map((id) => [id, collectionPage(id, 0)]));
      return reply(route, { categories, featured: TOP_HITS[0] });
    }
    if (url.pathname === '/api/category') {
      return reply(route, collectionPage(url.searchParams.get('id') ?? '', Number(url.searchParams.get('index') ?? 0)));
    }
    if (url.pathname === '/api/search' && url.searchParams.has('preview')) {
      return json(route, { id: url.searchParams.get('preview'), previewUrl: FRESH_PREVIEW });
    }
    if (url.pathname === '/api/search' && url.searchParams.has('artists')) {
      return json(route, { artists: [{ id: '1783', name: 'Artista Teste', pictureUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', fans: 1234567 }] });
    }
    if (url.pathname === '/api/search' && url.searchParams.has('album')) {
      return reply(route, {
        album: { id: url.searchParams.get('album'), title: 'Álbum Teste', coverUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', year: 2001, artist: 'Artista Teste' },
        tracks: page([track(401, 'Faixa do Álbum Um', 'Artista Teste', 'Álbum Teste'), track(402, 'Faixa do Álbum Dois', 'Artista Teste', 'Álbum Teste')])
      });
    }
    if (url.pathname === '/api/search' && url.searchParams.has('artist')) {
      const id = url.searchParams.get('artist');
      if (id === '2222') {
        return reply(route, {
          artist: { id, name: 'Artista Parecido', pictureUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', fans: 10 },
          top: page([track(311, 'Sucesso do Parecido', 'Artista Parecido')]),
          albums: [],
          related: []
        });
      }
      return reply(route, {
        related: [{ id: '2222', name: 'Artista Parecido', pictureUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', fans: 10 }],
        artist: { id, name: 'Artista Teste', pictureUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', fans: 1234567 },
        albums: [{ id: '777', title: 'Álbum Teste', coverUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', year: 2001, artist: 'Artista Teste' }],
        top: page([track(301, 'Hit Número Um', 'Artista Teste'), track(302, 'Hit Número Dois', 'Artista Teste'), track(303, 'Hit Número Três', 'Artista Teste')])
      });
    }
    if (url.pathname === '/api/search') {
      const q = url.searchParams.get('q') ?? '';
      return reply(route, page([track(101, `${q} - Ao Vivo`, 'Intérprete Busca'), track(102, `${q} - Acústico`, 'Intérprete Busca')]));
    }
    if (url.pathname === '/api/radio' && url.searchParams.has('click')) return json(route, { ok: true });
    if (url.pathname === '/api/radio' && url.searchParams.has('live')) {
      const style = url.searchParams.get('live');
      if (!style) return json(route, { styles: [{ id: 'rock', name: 'Rock' }, { id: 'jazz', name: 'Jazz' }] });
      return json(route, { style, stations: [{ id: 'rb-00000000-0000-4000-8000-000000000001', name: `Rádio ${style} Teste`, location: 'São Paulo', streamUrl: 'https://stream.example/1' }] });
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
      if (route.request().method() === 'POST') {
        // The app asks which tracks the shared cache already has a video for (no search, no quota)
        const body = route.request().postDataJSON() as { lookup?: { id: string }[]; videoId?: string } | null;
        if (body?.lookup) {
          options.lookups?.push(body.lookup.map((item) => item.id));
          const found = Object.fromEntries(body.lookup.filter((item) => options.cachedVideos?.[item.id]).map((item) => [item.id, options.cachedVideos![item.id]]));
          return json(route, { found });
        }
        // "Não é esta música" / a video that would not play: the video is reported
        if ((body as { videoId?: string } | null)?.videoId) options.reports?.push((body as { videoId: string }).videoId);
        return json(route, { ok: true });
      }
      if (url.searchParams.has('avoid')) {
        options.avoids?.push(url.searchParams.get('avoid') ?? '');
        return json(route, { videoIds: options.otherVideoIds ?? [] });
      }
      if (url.searchParams.has('usage')) return json(route, { enabled: true, used: options.usedToday ?? 4, limit: 30 });
      if (url.searchParams.get('warm') === '1') {
        options.warms?.push(url.searchParams.get('id') ?? '');
        return json(route, options.warmSkipped ? { videoIds: [], warm: 'skipped' } : { videoIds: options.videoIds ?? [], warm: 'searched' });
      }
      if (options.quotaExceeded) return json(route, { videoIds: [], quota: { used: 30, limit: 30, exceeded: true } });
      return json(route, { videoIds: options.videoIds ?? [] });
    }
    return route.continue();
  });

  // Preview links signed by the catalog: the expired one is refused (as the real CDN does), the new one plays
  await target.route('https://cdn-preview.example/**', (route) =>
    route.request().url().includes('fresh=1')
      ? route.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.from(silentClip(20).split(',')[1], 'base64') })
      : route.fulfill({ status: 403, body: 'expired' })
  );

  // The live stations the directory stub names: a silent stream, so playing one needs no network
  await target.route('https://stream.example/**', (route) =>
    route.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.from(silentClip(20).split(',')[1], 'base64') })
  );

  // Lyrics are looked up on a third-party service when the full-screen player opens
  await target.route('https://lrclib.net/**', (route) =>
    options.lyrics
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify([{ syncedLyrics: '[00:00.00]Primeira linha\n[00:02.00]Segunda linha\n[00:08.00]Terceira linha\n[00:12.00]Quarta linha' }])
        })
      : route.fulfill({ status: 404, body: '[]' })
  );

  return requests;
}

export const nav = (target: Page, tab: 'Início' | 'Rádio' | 'Biblioteca' | 'Buscar') =>
  target.locator(`nav[aria-label="Navegação Principal"] button[aria-label="${tab}"]`);

/**
 * A stand-in for the YouTube iframe API (the real one never answers a test): `window.__yt` records what the app
 * asked of it. `window.__ytMode = 'blocked'` makes a loaded video stay cued, like an iPhone that refuses the
 * automatic start, until `window.__ytAllow = true` (then the next `playVideo()` plays it).
 */
export async function fakeYouTube(target: Page): Promise<void> {
  await target.route(/youtube\.com\/embed\//, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '' }));
  await target.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.__yt = { created: 0, loads: [], plays: 0, cues: [], log: [] };
        class Player {
          constructor(el, options) {
            this.events = options.events; this.state = -1; this.id = ''; this.startedAt = 0; this.base = 0;
            window.__yt.created += 1;
            setTimeout(() => this.events.onReady(), 30);
          }
          set(state) {
            if (state === 1) { this.startedAt = performance.now(); } else if (this.state === 1) { this.base = this.getCurrentTime(); }
            this.state = state; this.events.onStateChange({ data: state });
          }
          loadVideoById(id) {
            window.__yt.log.push('load:' + id);
            this.id = id; this.base = 0; this.loadedAt = performance.now(); window.__yt.loads.push(id); this.set(3);
            setTimeout(() => this.set(window.__ytMode === 'blocked' && !window.__ytAllow ? 5 : 1), 60);
          }
          cueVideoById(id) { this.id = id; this.base = 0; window.__yt.cues.push(id); this.set(5); }
          playVideo() { window.__yt.log.push('play'); window.__yt.plays += 1; if (this.id && !(window.__ytMode === 'blocked' && !window.__ytAllow)) this.set(1); }
          mute() { window.__yt.log.push('mute'); }
          unMute() { window.__yt.log.push('unmute'); }
          pauseVideo() { this.set(2); }
          stopVideo() { this.id = ''; this.set(5); }
          seekTo(s) { this.base = s; this.startedAt = performance.now(); }
          setVolume() {}
          getCurrentTime() { return this.base + (this.state === 1 ? (performance.now() - this.startedAt) / 1000 : 0); }
          // __ytStaleLength: right after a load the player still answers with the length of the video before (19 s, the reserve one)
          getDuration() { if (this.id && window.__ytBogusLength && this.state === 1 && this.getCurrentTime() > 1) return Math.max(8, Math.floor(this.getCurrentTime())); return this.id ? (window.__ytStaleLength && performance.now() - (this.loadedAt || 0) < 1500 ? 19 : 180) : 0; }
          getPlayerState() { return this.state; }
        }
        window.YT = { Player };
        if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady();
      `
    })
  );
}

/** The video the app last loaded into the (fake) YouTube player. Use with `expect.poll`. */
export const loadedVideo = (target: Page) => target.evaluate(() => (window as unknown as { __yt?: { loads: string[] } }).__yt?.loads.at(-1) ?? '');
