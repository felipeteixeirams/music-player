import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  DEFAULT_LAB_OPTIONS,
  DEFAULT_RADIO_URL,
  DEFAULT_VIDEO_ID,
  LAB_CASES,
  describeAdvance,
  findLabCase,
  formatLabClock,
  formatLabReport,
  parseStreamUrl,
  parseVideoId
} from '../src/utils/backgroundLab';

test('INV-PLAY-26: o laboratório isola um caso por vez: áudio nativo, áudio mudo, iframe visível ou oculto, e as combinações', () => {
  assert.deepEqual(
    LAB_CASES.map((entry) => [entry.id, entry.audio, entry.frame]),
    [
      ['A', 'radio', null],
      ['B', 'silent', null],
      ['C', null, 'visible'],
      ['D', null, 'hidden'],
      ['F', 'radio', 'hidden'],
      ['G', 'silent', 'hidden']
    ]
  );
  assert.equal(new Set(LAB_CASES.map((entry) => entry.id)).size, LAB_CASES.length, 'ids únicos');
  assert.equal(findLabCase('C')?.frame, 'visible');
  assert.equal(findLabCase('Z'), undefined);
});

test('INV-PLAY-26: o laboratório aceita o código do vídeo ou o endereço, e só streams http(s)', () => {
  assert.equal(parseVideoId(DEFAULT_VIDEO_ID), DEFAULT_VIDEO_ID);
  assert.equal(parseVideoId('https://www.youtube.com/watch?v=5qap5aO4i9A&t=3s'), '5qap5aO4i9A');
  assert.equal(parseVideoId('https://youtu.be/5qap5aO4i9A'), '5qap5aO4i9A');
  assert.equal(parseVideoId('curto'), null);
  assert.equal(parseStreamUrl(DEFAULT_RADIO_URL), DEFAULT_RADIO_URL);
  assert.equal(parseStreamUrl('javascript:alert(1)'), null);
  assert.equal(parseStreamUrl('file:///etc/passwd'), null);
  assert.equal(parseStreamUrl('não é endereço'), null);
});

test('INV-PLAY-26: o relatório do laboratório diz ambiente, caso, opções e as linhas com o tempo', () => {
  const lab = findLabCase('F')!;
  const text = formatLabReport('versão x · APP INSTALADO (PWA)', lab, { ...DEFAULT_LAB_OPTIONS, audioSessionPlayback: true }, ['rádio: r', 'vídeo: v'], [
    { at: 1500, text: 'SAIU DO APP' },
    { at: 65400, text: 'VOLTOU depois de 30 s' }
  ]);
  assert.deepEqual(text.split('\n'), [
    'versão x · APP INSTALADO (PWA)',
    'caso F: Rádio + YouTube oculto',
    'opções: audioSession playback sim; mediaSession não',
    'rádio: r',
    'vídeo: v',
    '00:01.5 SAIU DO APP',
    '01:05.4 VOLTOU depois de 30 s'
  ]);
  assert.equal(formatLabClock(-5), '00:00.0');
});

test('INV-PLAY-26: describeAdvance mostra quanto o contador andou, ou ? quando falta uma leitura', () => {
  assert.equal(describeAdvance(10, 40.04), '30.0 s');
  assert.equal(describeAdvance(10, 10), '0.0 s');
  assert.equal(describeAdvance(null, 5), '?');
  assert.equal(describeAdvance(5, Number.NaN), '?');
});

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? sources(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

test('INV-PLAY-25: o áudio mudo de manutenção, refutado nas medições do aparelho, não existe mais no app', () => {
  const found = sources('src').filter((file) => /startAudioKeepAlive|stopAudioKeepAlive|keepAliveAudio/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(found, []);
});
