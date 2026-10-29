import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudioProxyError, fetchAllowedAudio, fetchAllowedImage, IMAGE_HOST_SUFFIXES, isAllowedAudioUrl, isAllowedImageUrl } from '../../api/_mediaProxy';
import { PROXIABLE_HOST_SUFFIXES } from '../../src/utils/imageProxy';

const audio = (bytes = 8, headers: Record<string, string> = {}) =>
  new Response(Buffer.alloc(bytes), { headers: { 'content-type': 'audio/mpeg', ...headers } });

test('isAllowedAudioUrl accepts only https catalog preview CDNs', () => {
  assert.equal(isAllowedAudioUrl('https://cdnt-preview.dzcdn.net/api/1/1/a.mp3?hdnea=x'), true);
  assert.equal(isAllowedAudioUrl('https://audio-ssl.itunes.apple.com/a.m4a'), true);
  for (const bad of [
    undefined, 42, '', 'not a url',
    'http://cdnt-preview.dzcdn.net/a.mp3',
    'https://evil.example/a.mp3',
    'https://dzcdn.net.evil.example/a.mp3',
    'https://evil.example/?u=https://x.dzcdn.net/a.mp3',
    'https://user:pw@x.dzcdn.net/a.mp3',
    'file:///etc/passwd',
    'https://169.254.169.254/latest'
  ]) {
    assert.equal(isAllowedAudioUrl(bad), false, String(bad));
  }
});

test('fetchAllowedAudio returns the bytes and content type of an allowed preview', async () => {
  const result = await fetchAllowedAudio('https://x.dzcdn.net/a.mp3', (async () => audio(16)) as unknown as typeof fetch);
  assert.equal(result.contentType, 'audio/mpeg');
  assert.equal(result.body.length, 16);
});

test('fetchAllowedAudio refuses disallowed hosts without making a request', async () => {
  let calls = 0;
  const fetchImpl = (async () => { calls += 1; return audio(); }) as unknown as typeof fetch;
  await assert.rejects(
    fetchAllowedAudio('https://evil.example/a.mp3', fetchImpl),
    (err: unknown) => err instanceof AudioProxyError && err.status === 400
  );
  assert.equal(calls, 0);
});

test('fetchAllowedAudio rejects upstream errors, non-audio bodies and oversized files', async () => {
  const url = 'https://x.dzcdn.net/a.mp3';
  await assert.rejects(
    fetchAllowedAudio(url, (async () => new Response('', { status: 404 })) as unknown as typeof fetch),
    (err: unknown) => err instanceof AudioProxyError && err.status === 502
  );
  await assert.rejects(
    fetchAllowedAudio(url, (async () => new Response('<html>', { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch),
    /não devolveu áudio/
  );
  await assert.rejects(
    fetchAllowedAudio(url, (async () => audio(8, { 'content-length': String(10 * 1024 * 1024) })) as unknown as typeof fetch),
    (err: unknown) => err instanceof AudioProxyError && err.status === 413
  );
  await assert.rejects(
    fetchAllowedAudio(url, (async () => audio(5 * 1024 * 1024)) as unknown as typeof fetch),
    (err: unknown) => err instanceof AudioProxyError && err.status === 413
  );
});

const image = (bytes = 8, type = 'image/jpeg', headers: Record<string, string> = {}) =>
  new Response(Buffer.alloc(bytes), { headers: { 'content-type': type, ...headers } });

test('INV-MEDIA-01: a lista de hosts de capa do servidor e a do app são a mesma', () => {
  assert.deepEqual([...IMAGE_HOST_SUFFIXES].sort(), [...PROXIABLE_HOST_SUFFIXES].sort());
});

test('INV-MEDIA-01: isAllowedImageUrl só aceita https dos CDNs de capa do catálogo', () => {
  assert.equal(isAllowedImageUrl('https://e-cdns-images.dzcdn.net/images/cover/x/250x250.jpg'), true);
  assert.equal(isAllowedImageUrl('https://is1-ssl.mzstatic.com/image/thumb/a/100x100.jpg'), true);
  for (const bad of [
    undefined, 7, '', 'x',
    'http://e-cdns-images.dzcdn.net/a.jpg',
    'https://evil.example/a.jpg',
    'https://dzcdn.net.evil.example/a.jpg',
    'https://user:pw@x.dzcdn.net/a.jpg',
    'https://169.254.169.254/latest',
    'https://audio-ssl.itunes.apple.com/a.jpg'
  ]) {
    assert.equal(isAllowedImageUrl(bad), false, String(bad));
  }
});

test('INV-MEDIA-01: fetchAllowedImage devolve os bytes e o tipo; recusa SVG, o que não é imagem e o grande demais', async () => {
  const ok = await fetchAllowedImage('https://x.dzcdn.net/a.jpg', (async () => image(16)) as unknown as typeof fetch);
  assert.equal(ok.contentType, 'image/jpeg');
  assert.equal(ok.body.length, 16);

  for (const [type, status] of [['image/svg+xml', 502], ['text/html', 502]] as const) {
    await assert.rejects(
      fetchAllowedImage('https://x.dzcdn.net/a', (async () => image(8, type)) as unknown as typeof fetch),
      (err: unknown) => err instanceof AudioProxyError && err.status === status
    );
  }
  await assert.rejects(
    fetchAllowedImage('https://x.dzcdn.net/a.jpg', (async () => image(8, 'image/jpeg', { 'content-length': String(5 * 1024 * 1024) })) as unknown as typeof fetch),
    (err: unknown) => err instanceof AudioProxyError && err.status === 413
  );
  await assert.rejects(fetchAllowedImage('https://evil.example/a.jpg', (async () => image()) as unknown as typeof fetch), (err: unknown) => err instanceof AudioProxyError && err.status === 400);
});
