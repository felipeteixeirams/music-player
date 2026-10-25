import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudioProxyError, fetchAllowedAudio, isAllowedAudioUrl } from '../../api/_audioProxy';

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
