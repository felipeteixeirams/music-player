import assert from 'node:assert/strict';
import test from 'node:test';
import { searchEndpoint } from '../../api/_endpoints';

const NEW_URL = 'https://cdnt-preview.dzcdn.net/api/1/1/a/b/c/hash.mp3?hdnea=exp=1793082003~acl=/x~hmac=y';
const deezerTrack = (preview: string | null) => ({ id: 42, title: 'Faixa', title_short: 'Faixa', artist: { name: 'Artista' }, album: { title: 'Álbum', cover_big: 'https://img/x.jpg' }, duration: 200, preview });
const reply = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

test('INV-PREV-02: a rota devolve um link novo de prévia para uma faixa do Deezer, sem cache', async () => {
  const urls: string[] = [];
  const spy = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response(JSON.stringify(deezerTrack(NEW_URL)), { status: 200 });
  }) as typeof fetch;
  const result = await searchEndpoint({ preview: 'deezer-42' }, spy);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { id: 'deezer-42', previewUrl: NEW_URL });
  assert.equal(result.cacheControl, undefined);
  assert.equal(new URL(urls[0]).pathname, '/track/42');
});

test('faixa sem prévia dá 404, falha do Deezer dá 502, e só ids do Deezer são aceitos', async () => {
  assert.equal((await searchEndpoint({ preview: 'deezer-42' }, reply(deezerTrack(null)))).status, 404);
  assert.equal((await searchEndpoint({ preview: 'deezer-42' }, reply({}, 500))).status, 502);
  const never = (async () => { throw new Error('não devia chamar o Deezer'); }) as typeof fetch;
  for (const bad of ['itunes-1', 'deezer-', 'deezer-1/../2', '42', 'deezer-99999999999999']) {
    assert.equal((await searchEndpoint({ preview: bad }, never)).status, 400, bad);
  }
});
