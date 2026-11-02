import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  DEFAULT_LAB_OPTIONS,
  DEFAULT_RADIO_URL,
  DEFAULT_VIDEO_ID,
  LAB_CASES,
  LAB_EXITS,
  describeAdvance,
  SILENT_SECONDS,
  findLabCase,
  formatLabClock,
  formatLabReport,
  parseStreamUrl,
  parseVideoId,
  shouldNudge
} from '../src/utils/backgroundLab';
import { describeYouTubeError } from '../src/utils/youtubeErrors';

test('INV-PLAY-26: o laboratório isola um caso por vez: áudio nativo, áudio mudo, iframe visível ou oculto, e as combinações', () => {
  assert.deepEqual(
    LAB_CASES.map((entry) => [entry.id, entry.audio, entry.frame]),
    [
      ['A', 'radio', null],
      ['B', 'silent', null],
      ['C', null, 'visible'],
      ['D', null, 'hidden'],
      ['F', 'radio', 'hidden'],
      ['G', 'silent', 'hidden'],
      ['H', 'radio-later', 'hidden']
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

test('INV-PLAY-26: o erro 150 do YouTube aparece no relatório como "o dono não permite incorporar", e o vídeo padrão é outro', () => {
  assert.match(describeYouTubeError(150), /não permite incorporá-lo/);
  assert.match(describeYouTubeError(101), /não permite incorporá-lo/);
  assert.match(describeYouTubeError(100), /não encontrado/);
  assert.match(describeYouTubeError(999), /desconhecido/);
  assert.notEqual(DEFAULT_VIDEO_ID, '5qap5aO4i9A', 'esse vídeo respondeu erro 150 no aparelho (2026-11-02)');
  assert.ok(SILENT_SECONDS >= 300, 'o arquivo mudo não dá a volta durante um teste');
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

test('INV-PLAY-26: um toque na tela pede o início do vídeo de novo, uma vez por toque, e só enquanto ele não começou', () => {
  assert.equal(shouldNudge(false, 0, 1000), true);
  assert.equal(shouldNudge(false, 1000, 1200), false, 'pointerup, touchend e click do mesmo toque contam uma vez');
  assert.equal(shouldNudge(false, 1000, 1700), true);
  assert.equal(shouldNudge(true, 0, 10_000), false, 'depois de começar não há o que pedir');
});

test('INV-PLAY-26: o relatório distingue sair trocando de app e bloqueando a tela', () => {
  assert.deepEqual(LAB_EXITS.map((entry) => entry.id), ['home', 'lock']);
  assert.match(LAB_EXITS[0].report, /sem bloquear a tela/);
  assert.match(LAB_EXITS[1].report, /tela bloqueada/);
});
