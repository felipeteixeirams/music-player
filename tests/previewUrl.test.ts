import assert from 'node:assert/strict';
import test from 'node:test';
import { isPreviewStale, previewExpiresAt } from '../src/utils/previewUrl';

const signed = (exp: number) => `https://cdnt-preview.dzcdn.net/api/1/1/a/b/c/hash.mp3?hdnea=exp=${exp}~acl=/api/1/1/a/b/c/hash.mp3*~data=abc~hmac=def`;

test('INV-PREV-01: o vencimento sai do link assinado da prévia, e link sem assinatura nunca é dado como vencido', () => {
  assert.equal(previewExpiresAt(signed(1793082003)), 1793082003);
  assert.equal(previewExpiresAt('https://cdnt-preview.dzcdn.net/x.mp3?hdnea=exp%3D1793082003~acl=/x'), 1793082003);
  assert.equal(previewExpiresAt('https://audio-ssl.itunes.apple.com/x.m4a'), null);
  assert.equal(isPreviewStale('https://audio-ssl.itunes.apple.com/x.m4a'), false);
});

test('o link vence com uma margem para carregar: faltando menos de 90 s já conta como vencido', () => {
  const now = 1_800_000_000;
  assert.equal(isPreviewStale(signed(now + 600), now), false);
  assert.equal(isPreviewStale(signed(now + 89), now), true);
  assert.equal(isPreviewStale(signed(now - 5), now), true);
});
