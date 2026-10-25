import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchDeployedVersion, isNewVersionAvailable } from '../src/utils/appVersion';

const json = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

test('só avisa quando a versão publicada é conhecida e diferente', () => {
  assert.equal(isNewVersionAvailable('a1', 'b2'), true);
  assert.equal(isNewVersionAvailable('a1', 'a1'), false);
  assert.equal(isNewVersionAvailable('a1', null), false);
});

test('fetchDeployedVersion lê a versão e ignora respostas inválidas', async () => {
  assert.equal(await fetchDeployedVersion(json({ version: 'abc' })), 'abc');
  assert.equal(await fetchDeployedVersion(json({ version: 3 })), null);
  assert.equal(await fetchDeployedVersion(json({}, 404)), null);
  const html = (async () => new Response('<!doctype html>', { status: 200 })) as unknown as typeof fetch;
  assert.equal(await fetchDeployedVersion(html), null);
  const offline = (async () => { throw new TypeError('offline'); }) as unknown as typeof fetch;
  assert.equal(await fetchDeployedVersion(offline), null);
});
