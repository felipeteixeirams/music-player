import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isPublicFeedUrl, mapShow, parseDuration, parseFeed, PodcastError, searchShows, showWithEpisodes } from '../../api/_podcasts';

const FEED = readFileSync(new URL('../fixtures/podcast-feed.xml', import.meta.url), 'utf8');

test('INV-POD-01: parseFeed devolve os episódios com áudio, do mais novo ao mais antigo, com título, data, duração e endereço corretos', () => {
  const { show, episodes } = parseFeed(FEED, '42');
  assert.equal(show.language, 'pt-br');
  assert.equal(show.coverUrl, 'https://img.example/zen.jpg');
  assert.match(show.description ?? '', /^Palestras da mestra/);

  // "Sem áudio" and the video item are left out; the newest comes first
  assert.deepEqual(episodes.map((episode) => episode.title), ['Curto', 'Propósito da Espiritualidade', 'Purificar Karmas & Conhecer a Mente | Monja Coen']);
  const [short, purpose, karmas] = episodes;
  assert.equal(short.durationSeconds, 572);
  assert.equal(purpose.durationSeconds, 4205);
  assert.equal(karmas.durationSeconds, 4108);
  assert.equal(karmas.publishedAt, '2020-05-18T10:00:19.000Z');
  assert.equal(karmas.audioUrl, 'https://cdn.example/a.mp3?x=1&y=2', 'entidades do atributo decodificadas');
  assert.equal(purpose.audioUrl, 'https://cdn.example/b.mp3', 'http vira https');
  assert.equal(purpose.coverUrl, 'https://img.example/b.jpg', 'capa do próprio episódio');
  assert.equal(karmas.coverUrl, 'https://img.example/zen.jpg', 'sem capa própria usa a do programa');
  assert.equal(karmas.description, 'Uma palestra longa .');
  assert.ok(episodes.every((episode) => /^pod-42-[0-9a-f]{10}$/.test(episode.id)));
  assert.equal(new Set(episodes.map((episode) => episode.id)).size, 3, 'ids distintos e estáveis');
  assert.deepEqual(parseFeed(FEED, '42').episodes.map((e) => e.id), episodes.map((e) => e.id));
});

test('INV-POD-01: parseFeed não quebra com lixo, e parseDuration aceita HH:MM:SS, MM:SS e segundos', () => {
  assert.deepEqual(parseFeed('não é xml', '1').episodes, []);
  assert.deepEqual(parseFeed('<rss><channel><item></item></channel></rss>', '1').episodes, []);
  assert.equal(parseDuration('01:10:05'), 4205);
  assert.equal(parseDuration('70:05'), 4205);
  assert.equal(parseDuration('4205'), 4205);
  for (const bad of ['', 'abc', '1:2:3:4', '-5', '12:xx']) assert.equal(parseDuration(bad), 0, bad);
});

test('INV-POD-02: o servidor só busca feeds públicos: nada de localhost, rede privada, IP de metadados nem credenciais', () => {
  for (const ok of ['https://feeds.example.com/rss', 'http://anchor.fm/s/1/podcast/rss']) assert.equal(isPublicFeedUrl(ok), true, ok);
  for (const bad of [
    'ftp://x.example/rss', 'file:///etc/passwd', 'not a url', 'https://user:pw@x.example/rss',
    'http://localhost/rss', 'http://127.0.0.1/rss', 'http://10.0.0.5/rss', 'http://172.16.4.1/rss', 'http://192.168.0.9/rss',
    'http://169.254.169.254/latest', 'http://0.0.0.0/', 'http://[::1]/rss', 'http://intranet.local/rss', 'http://svc.internal/rss'
  ]) {
    assert.equal(isPublicFeedUrl(bad), false, bad);
  }
});

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
const ITUNES_SHOW = { collectionId: 42, collectionName: 'Despertar Zen', artistName: 'Monja Coen', artworkUrl100: 'http://img.example/100x100bb.jpg', feedUrl: 'https://feeds.example/zen' };

test('INV-POD-01: searchShows mapeia os resultados do iTunes e valida o texto', async () => {
  let asked = '';
  const shows = await searchShows('monja coen', (async (url: string) => {
    asked = url;
    return json({ results: [ITUNES_SHOW, { collectionId: 'x', collectionName: 'sem id numérico' }, null] });
  }) as unknown as typeof fetch);
  assert.match(asked, /media=podcast/);
  assert.deepEqual(shows, [{ id: '42', title: 'Despertar Zen', author: 'Monja Coen', coverUrl: 'https://img.example/600x600bb.jpg' }]);
  await assert.rejects(searchShows('   '), (err: unknown) => err instanceof PodcastError && err.status === 400);
  await assert.rejects(searchShows('x'.repeat(201)), (err: unknown) => err instanceof PodcastError && err.status === 400);
  assert.equal(mapShow({ collectionId: 7 }), null);
});

test('INV-POD-02: showWithEpisodes só aceita id numérico, pega o feed do iTunes (não do cliente) e confere cada redirecionamento', async () => {
  for (const bad of ['abc', '1;2', '', undefined, '../x']) {
    await assert.rejects(showWithEpisodes(bad), (err: unknown) => err instanceof PodcastError && err.status === 400, String(bad));
  }

  const calls: string[] = [];
  const good = (async (url: string) => {
    calls.push(url);
    if (url.startsWith('https://itunes.apple.com/lookup')) return json({ results: [ITUNES_SHOW] });
    if (url === 'https://feeds.example/zen') return new Response(null, { status: 302, headers: { location: 'https://cdn.example/zen.xml' } });
    return new Response(FEED, { headers: { 'content-type': 'application/rss+xml' } });
  }) as unknown as typeof fetch;
  const { show, episodes } = await showWithEpisodes('42', good);
  assert.equal(show.title, 'Despertar Zen');
  assert.equal(show.description?.startsWith('Palestras'), true);
  assert.equal(episodes.length, 3);
  assert.deepEqual(calls.slice(1), ['https://feeds.example/zen', 'https://cdn.example/zen.xml']);

  // A feed that redirects to the machine's own network is refused
  const evil = (async (url: string) => {
    if (url.startsWith('https://itunes.apple.com/lookup')) return json({ results: [ITUNES_SHOW] });
    return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } });
  }) as unknown as typeof fetch;
  await assert.rejects(showWithEpisodes('42', evil), (err: unknown) => err instanceof PodcastError);

  // Unknown show / no feed
  const none = (async () => json({ results: [] })) as unknown as typeof fetch;
  await assert.rejects(showWithEpisodes('42', none), (err: unknown) => err instanceof PodcastError && err.status === 404);
});
