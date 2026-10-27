import assert from 'node:assert/strict';
import test from 'node:test';
import { radioEndpoint } from '../../api/_endpoints';
import { fetchLiveStations, findLiveStyle, LIVE_STYLES, MAX_STATIONS, toLiveStations } from '../../api/_radioBrowser';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const station = (n: number, over: Record<string, unknown> = {}) => ({
  stationuuid: UUID(n),
  name: `Rádio ${n}`,
  url_resolved: `https://stream.example/${n}`,
  codec: 'AAC+',
  lastcheckok: 1,
  state: 'São Paulo',
  country: 'Brazil',
  ...over
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('INV-LIVE-01: só entram emissoras verificadas, em HTTPS, num formato que o celular toca, sem repetir o nome', () => {
  const result = toLiveStations([
    station(1),
    station(2, { url_resolved: 'http://insecure.example/2' }),
    station(3, { lastcheckok: 0 }),
    station(4, { codec: 'OGG' }),
    station(5, { name: 'rádio 1' }),
    station(6, { stationuuid: 'not-a-uuid' }),
    station(7, { codec: 'mp3' }),
    { nothing: true }
  ]);
  assert.deepEqual(result.map((s) => s.name), ['Rádio 1', 'Rádio 7']);
  assert.deepEqual(result[0], { id: `rb-${UUID(1)}`, name: 'Rádio 1', location: 'São Paulo', streamUrl: 'https://stream.example/1' });
});

test('uma resposta que não é lista não dá emissora nenhuma', () => {
  assert.deepEqual(toLiveStations({ error: 'x' }), []);
  assert.deepEqual(toLiveStations(null), []);
});

test('no máximo 12 emissoras por estilo', () => {
  const many = Array.from({ length: 40 }, (_, i) => station(i + 1));
  assert.equal(toLiveStations(many).length, MAX_STATIONS);
});

test('a busca vai com tag exata, país, só emissoras no ar, as mais ouvidas primeiro e um User-Agent próprio', async () => {
  const seen: { url: string; agent: string | null }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(input), agent: new Headers(init?.headers).get('User-Agent') });
    return json([station(1)]);
  }) as typeof fetch;
  const result = await fetchLiveStations(findLiveStyle('rock')!, fetchImpl);
  assert.equal(result.length, 1);
  const url = new URL(seen[0].url);
  assert.equal(url.hostname, 'de1.api.radio-browser.info');
  assert.equal(url.searchParams.get('tag'), 'rock');
  assert.equal(url.searchParams.get('tagExact'), 'true');
  assert.equal(url.searchParams.get('countrycode'), 'BR');
  assert.equal(url.searchParams.get('hidebroken'), 'true');
  assert.equal(url.searchParams.get('order'), 'clickcount');
  assert.match(seen[0].agent ?? '', /^music-player\//);
});

test('estilos sem emissoras no Brasil (jazz) buscam no mundo todo', async () => {
  let url = '';
  const fetchImpl = (async (input: RequestInfo | URL) => {
    url = String(input);
    return json([]);
  }) as typeof fetch;
  await fetchLiveStations(findLiveStyle('jazz')!, fetchImpl);
  assert.equal(new URL(url).searchParams.has('countrycode'), false);
});

test('INV-LIVE-02: se um servidor do diretório falha, o próximo é tentado; se todos falham, a rota responde 502 sem derrubar a tela', async () => {
  const hosts: string[] = [];
  const failFirst = (async (input: RequestInfo | URL) => {
    const host = new URL(String(input)).hostname;
    hosts.push(host);
    if (host.startsWith('de1')) throw new TypeError('fetch failed');
    return json([station(1)]);
  }) as typeof fetch;
  const ok = await radioEndpoint({ live: 'rock' }, failFirst);
  assert.equal(ok.status, 200);
  assert.deepEqual(hosts.slice(0, 2), ['de1.api.radio-browser.info', 'nl1.api.radio-browser.info']);
  assert.match(ok.cacheControl ?? '', /s-maxage=3600/);

  const allDown = (async () => json({}, 503)) as typeof fetch;
  const down = await radioEndpoint({ live: 'rock' }, allDown);
  assert.equal(down.status, 502);
  assert.equal(down.cacheControl, undefined);
});

test('INV-LIVE-03: a rota só aceita os estilos da lista e uuids de emissora válidos', async () => {
  const never = (async () => {
    throw new Error('não devia chamar o diretório');
  }) as typeof fetch;
  assert.equal((await radioEndpoint({ live: 'qualquer-coisa' }, never)).status, 400);
  assert.equal((await radioEndpoint({ live: '../../etc' }, never)).status, 400);
  assert.equal((await radioEndpoint({ click: 'x' }, never)).status, 400);
  assert.equal((await radioEndpoint({ click: `${UUID(1)}/../..` }, never)).status, 400);

  const calls: string[] = [];
  const spy = (async (input: RequestInfo | URL) => {
    calls.push(new URL(String(input)).pathname);
    return json({ ok: true });
  }) as typeof fetch;
  const click = await radioEndpoint({ click: UUID(1) }, spy);
  assert.equal(click.status, 200);
  assert.deepEqual(calls, [`/json/url/${UUID(1)}`]);
});

test('o clique que o diretório não recebeu não vira erro para quem ouve', async () => {
  const down = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  assert.equal((await radioEndpoint({ click: UUID(2) }, down)).status, 200);
});

test('sem valor, a rota devolve a lista de estilos (e só id e nome)', async () => {
  const result = await radioEndpoint({ live: '' });
  assert.equal(result.status, 200);
  const styles = (result.body as { styles: { id: string; name: string }[] }).styles;
  assert.equal(styles.length, LIVE_STYLES.length);
  assert.deepEqual(Object.keys(styles[0]).sort(), ['id', 'name']);
  assert.equal(new Set(styles.map((s) => s.id)).size, styles.length);
});
