import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Track, TrackPage } from '../src/types/music';
import type { PlayEntry } from '../src/utils/playHistory';
import { buildDiscovery, buildFavorites, buildForYou, buildMood, buildRediscover, dayKey, interleave, moodFor, rankArtists, seededShuffle } from '../src/utils/personalMixes';
import { fetchMixSources, loadMixSources, saveMixSources } from '../src/utils/personalMixSources';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 28, 20, 0, 0).getTime();

const track = (id: number, artist = 'Artista', title = `Faixa ${id}`): Track => ({
  id: `deezer-${id}`, title, artist, album: 'Álbum', duration: 180, coverUrl: '', style: 's', categoryId: 'web', sources: { localUrl: '' }
});
const play = (id: number, artist: string, daysAgo: number): PlayEntry => ({ track: track(id, artist), playedAt: NOW - daysAgo * DAY });
const tracks = (from: number, count: number, artist = 'Artista') => Array.from({ length: count }, (_, i) => track(from + i, artist));
const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
};

test('INV-HOME-01: a ordem de um mix é a mesma o dia todo e muda no dia seguinte', () => {
  const list = tracks(1, 20);
  assert.deepEqual(seededShuffle(list, 'x:2026-10-28'), seededShuffle(list, 'x:2026-10-28'));
  assert.notDeepEqual(seededShuffle(list, 'x:2026-10-28').map((t) => t.id), seededShuffle(list, 'x:2026-10-29').map((t) => t.id));
  assert.equal(seededShuffle(list, 'x').length, 20);
  assert.equal(dayKey(NOW), '2026-10-28');
});

test('os artistas mais ouvidos vêm primeiro, o que foi tocado nos últimos 30 dias vale o dobro e "feat." conta para o primeiro nome', () => {
  const entries = [
    play(1, 'Antigo', 90), play(2, 'Antigo', 91), play(3, 'Antigo', 92),
    play(4, 'Recente feat. Alguém', 2), play(5, 'Recente', 3),
    play(6, 'Outro', 1)
  ];
  const ranked = rankArtists(entries, NOW);
  assert.deepEqual(ranked.map((a) => a.name), ['Recente', 'Antigo', 'Outro']);
  assert.equal(ranked[0].score, 4);
});

test('interleave alterna entre as listas, sem repetir faixa e respeitando exclusões e o limite', () => {
  const a = [track(1), track(2), track(3)];
  const b = [track(10), track(2), track(11)];
  assert.deepEqual(interleave([a, b]).map((t) => t.id), ['deezer-1', 'deezer-10', 'deezer-2', 'deezer-3', 'deezer-11']);
  assert.deepEqual(interleave([a, b], 3).map((t) => t.id), ['deezer-1', 'deezer-10', 'deezer-2']);
  assert.deepEqual(interleave([a], 10, new Set(['deezer-2'])).map((t) => t.id), ['deezer-1', 'deezer-3']);
});

test('INV-HOME-01: "Mix para você" e "Estação de descoberta" só aparecem com faixas suficientes, e a descoberta não repete o que já tocou', () => {
  const tops = [tracks(1, 6, 'A'), tracks(100, 6, 'B'), tracks(200, 6, 'C')];
  const mix = buildForYou(['A', 'B', 'C'], tops, '2026-10-28');
  assert.equal(mix?.title, 'Mix para você');
  assert.match(mix?.description ?? '', /A, B e C/);
  assert.equal(buildForYou(['A'], [tracks(1, 3)], '2026-10-28'), null);

  const played = new Set(['deezer-300', 'deezer-301', 'deezer-302']);
  const discovery = buildDiscovery(['X', 'Y'], [tracks(300, 8, 'X'), tracks(400, 8, 'Y')], played, '2026-10-28');
  assert.ok(discovery);
  assert.ok(discovery.tracks.every((t) => !played.has(t.id)));
  assert.equal(buildDiscovery(['X'], [tracks(300, 8, 'X')], new Set(tracks(300, 8).map((t) => t.id)), '2026-10-28'), null);
});

test('INV-HOME-01: favoritos pedem 5 curtidas; Redescubra só traz o que não toca há mais de 14 dias', () => {
  assert.equal(buildFavorites(tracks(1, 4), 'd'), null);
  assert.equal(buildFavorites(tracks(1, 5), 'd')?.title, 'Seus favoritos');

  const entries = [
    ...[1, 2, 3, 4, 5, 6].map((id) => play(id, 'A', 30 + id)),
    play(2, 'A', 1), // played again yesterday: not old any more
    play(7, 'A', 3)
  ];
  const mix = buildRediscover(entries, NOW, 'd');
  assert.ok(mix);
  const ids = mix.tracks.map((t) => t.id).sort();
  assert.deepEqual(ids, ['deezer-1', 'deezer-3', 'deezer-4', 'deezer-5', 'deezer-6']);
  assert.equal(buildRediscover([play(1, 'A', 30)], NOW, 'd'), null);
});

test('INV-HOME-01: o humor segue a hora do dia e usa a coleção correspondente; sem a coleção não há cartão', () => {
  assert.equal(moodFor(8).categoryId, 'mpb');
  assert.equal(moodFor(15).categoryId, 'pop-internacional');
  assert.equal(moodFor(20).categoryId, 'top-hits');
  assert.equal(moodFor(2).categoryId, 'lofi-chill');
  const page = (list: Track[]): TrackPage => ({ tracks: list, total: list.length, nextIndex: null });
  assert.equal(buildMood({ 'top-hits': page(tracks(1, 6)) }, 20, 'd')?.title, 'Para a noite');
  assert.equal(buildMood({ 'top-hits': page(tracks(1, 6)) }, 8, 'd'), null);
  assert.equal(buildMood(undefined, 20, 'd'), null);
});

test('as fontes do mix: só o artista de mesmo nome entra, os parecidos não incluem quem a pessoa já ouve, e o dia guarda o resultado', async () => {
  const artistPages: Record<string, { name: string; top: Track[]; related: { id: string; name: string }[] }> = {
    '1': { name: 'Creed', top: tracks(1, 5, 'Creed'), related: [{ id: '2', name: 'Nickelback' }, { id: '9', name: 'Queen' }, { id: '3', name: 'Staind' }] },
    '2': { name: 'Nickelback', top: tracks(20, 12, 'Nickelback'), related: [] },
    '3': { name: 'Staind', top: tracks(40, 12, 'Staind'), related: [] },
    '9': { name: 'Queen', top: tracks(60, 5, 'Queen'), related: [] }
  };
  const deps = {
    searchArtists: async (name: string) => (name === 'Creed' ? [{ id: '7', name: 'Creed Tribute', pictureUrl: '', fans: 1 }, { id: '1', name: 'Creed', pictureUrl: '', fans: 9 }] : []),
    artistPage: async (id: string) => ({ artist: { id, name: artistPages[id].name, pictureUrl: '', fans: 1 }, top: { tracks: artistPages[id].top, total: 5, nextIndex: null }, albums: [], related: artistPages[id].related.map((r) => ({ ...r, pictureUrl: '', fans: 1 })) })
  };
  const made = await fetchMixSources('2026-10-28', ['Creed', 'Desconhecido'], new Set(['queen']), undefined, deps as never);
  assert.deepEqual(made.forYou.names, ['Creed']);
  assert.deepEqual(made.discovery.names, ['Nickelback', 'Staind'], 'Queen já é ouvida e fica de fora');
  assert.equal(made.discovery.tops[0].length, 8, 'no máximo 8 faixas de cada artista parecido');

  const storage = memory();
  saveMixSources(storage, made);
  assert.ok(loadMixSources(storage, '2026-10-28', ['Creed', 'Desconhecido']));
  assert.equal(loadMixSources(storage, '2026-10-29', ['Creed', 'Desconhecido']), null, 'outro dia: refaz');
  assert.equal(loadMixSources(storage, '2026-10-28', ['Queen']), null, 'outros artistas favoritos: refaz');
});
