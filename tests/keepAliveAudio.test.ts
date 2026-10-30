import assert from 'node:assert/strict';
import test from 'node:test';
import { KEEPALIVE_KEY, keepAliveEnabled, setKeepAliveEnabled, silentWavDataUri } from '../src/utils/keepAliveAudio';

function decode(uri: string): Uint8Array {
  assert.match(uri, /^data:audio\/wav;base64,/);
  return Uint8Array.from(Buffer.from(uri.split(',')[1], 'base64'));
}

test('INV-PLAY-25: o áudio mudo de manutenção é um WAV de verdade, de silêncio, com o tamanho pedido', () => {
  const bytes = decode(silentWavDataUri(2));
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...bytes.slice(8, 12)), 'WAVE');
  assert.equal(String.fromCharCode(...bytes.slice(36, 40)), 'data');
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(24, true), 8000, 'taxa de amostragem');
  assert.equal(view.getUint32(40, true), 16000, '2 s a 8 kHz, 8 bits, mono');
  assert.equal(bytes.length, 44 + 16000);
  assert.ok(bytes.slice(44).every((byte) => byte === 0x80), 'silêncio em PCM de 8 bits é o valor do meio');
});

test('INV-PLAY-25: o experimento fica desligado por padrão e a escolha vale só neste aparelho', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  assert.equal(keepAliveEnabled(storage), false);
  setKeepAliveEnabled(true, storage);
  assert.equal(data.get(KEEPALIVE_KEY), '1');
  assert.equal(keepAliveEnabled(storage), true);
  setKeepAliveEnabled(false, storage);
  assert.equal(keepAliveEnabled(storage), false);
  assert.equal(keepAliveEnabled(null), false);
});
