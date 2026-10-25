import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RADIO_GENRES, findRadioStation } from '../../api/_radios';
import { fetchRadioTracks, mapRadioGenres } from '../../api/_deezer';

const deezerGenres = (ids: number[], extra: Record<string, unknown> = {}) => ({
  data: [{ id: 152, title: 'Rock', radios: ids.map((id) => ({ id, title: `Station ${id}`, picture_medium: `https://cdn.example/${id}.jpg`, ...extra })) }]
});

const allIds = RADIO_GENRES.flatMap((genre) => genre.stations.map((station) => station.id));

test('the curated radio list has no repeated station or empty name', () => {
  assert.equal(new Set(allIds).size, allIds.length);
  assert.ok(RADIO_GENRES.length >= 5);
  for (const genre of RADIO_GENRES) {
    assert.ok(genre.id && genre.name && genre.stations.length > 0, genre.id);
    for (const station of genre.stations) assert.ok(station.name.trim(), String(station.id));
  }
});

test('findRadioStation accepts curated ids only', () => {
  assert.equal(findRadioStation('37765')?.name, 'Rock Clássico');
  assert.equal(findRadioStation(['37765'])?.id, 37765);
  for (const bad of [undefined, null, 42, '', 'abc', '37765x', ' 37765', '-1', '1.5', '99999999999', '12345', ['x']]) {
    assert.equal(findRadioStation(bad), null, String(bad));
  }
});

test('mapRadioGenres keeps our names and groups, with Deezer covers, and drops stations Deezer no longer lists', () => {
  const rock = RADIO_GENRES.find((genre) => genre.id === 'rock')!;
  const [first, second] = rock.stations;
  const genres = mapRadioGenres(deezerGenres([first.id, second.id, 999999]));

  assert.deepEqual(genres.map((genre) => genre.id), ['rock']);
  assert.deepEqual(genres[0].stations, [
    { id: first.id, name: first.name, picture: `https://cdn.example/${first.id}.jpg` },
    { id: second.id, name: second.name, picture: `https://cdn.example/${second.id}.jpg` }
  ]);
});

test('mapRadioGenres finds a station listed under any Deezer genre and tolerates a missing cover', () => {
  const sertanejo = RADIO_GENRES[0].stations[0];
  const payload = { data: [{ radios: [{ id: sertanejo.id, picture_medium: 'javascript:alert(1)' }] }] };
  const genres = mapRadioGenres(payload);
  assert.equal(genres[0].id, RADIO_GENRES[0].id);
  assert.equal(genres[0].stations[0].picture, null);
});

test('mapRadioGenres returns nothing for payloads without radios', () => {
  for (const payload of [null, 'x', {}, { data: 'x' }, { data: [null, {}, { radios: 'x' }] }, deezerGenres([])]) {
    assert.deepEqual(mapRadioGenres(payload), []);
  }
});

test('fetchRadioTracks maps one batch with the station as style and no paging', async () => {
  let requested = '';
  const fetchImpl = (async (url: string) => {
    requested = String(url);
    return Response.json({
      data: [
        { id: 1, title: 'One', duration: 200, preview: 'https://cdn.example/1.mp3', artist: { name: 'A' }, album: { title: 'X' } },
        { id: 2, title: 'Two', duration: 210, preview: '', artist: { name: 'B' }, album: { title: 'Y' } },
        null
      ]
    });
  }) as unknown as typeof fetch;

  const page = await fetchRadioTracks({ id: 37765, name: 'Rock Clássico' }, fetchImpl);
  assert.equal(requested, 'https://api.deezer.com/radio/37765/tracks?limit=40');
  assert.deepEqual(page.tracks.map((t) => t.id), ['deezer-1', 'deezer-2']);
  assert.ok(page.tracks.every((t) => t.style === 'Rock Clássico'));
  assert.equal(page.total, 2);
  assert.equal(page.nextIndex, null);
});

test('fetchRadioTracks rejects when Deezer fails', async () => {
  const fetchImpl = (async () => new Response('', { status: 503 })) as unknown as typeof fetch;
  await assert.rejects(fetchRadioTracks({ id: 1, name: 'X' }, fetchImpl), /Deezer HTTP 503/);
});
