import assert from 'node:assert/strict';
import test from 'node:test';
import { isUnlockClip, SILENT_CLIP, startAudioKeepAlive, stopAudioKeepAlive, unlockAudioElement } from '../src/utils/audioUnlock';
import { clearPlaybackLog, describeEnvironment, formatPlaybackLog, getPlaybackLog, logPlayback, subscribePlaybackLog } from '../src/utils/playbackDiagnostics';

function fakeAudio(initialSrc = '', playResult: 'ok' | 'rejects' = 'ok') {
  let src = initialSrc;
  let plays = 0;
  let pauses = 0;
  let loop = false;
  let volume = 1;
  const audio = {
    getAttribute: (name: string) => (name === 'src' && src ? src : null),
    removeAttribute: (name: string) => {
      if (name === 'src') src = '';
    },
    get src() {
      return src;
    },
    set src(value: string) {
      src = value;
    },
    get loop() {
      return loop;
    },
    set loop(value: boolean) {
      loop = value;
    },
    get volume() {
      return volume;
    },
    set volume(value: number) {
      volume = value;
    },
    play: () => {
      plays++;
      return playResult === 'ok' ? Promise.resolve() : Promise.reject(new Error('NotAllowedError'));
    },
    pause: () => {
      pauses++;
    }
  };
  return {
    audio: audio as unknown as HTMLAudioElement,
    plays: () => plays,
    pauses: () => pauses,
    src: () => src,
    loop: () => loop,
    volume: () => volume
  };
}

test('o clipe de silêncio é um WAV curto e válido', () => {
  const bytes = Buffer.from(SILENT_CLIP.split(',')[1], 'base64');
  assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
  assert.equal(bytes.subarray(8, 12).toString(), 'WAVE');
  assert.ok(bytes.length < 2000);
});

test('INV-PLAY-04: unlockAudioElement toca o clipe num elemento parado', () => {
  const { audio, plays, src } = fakeAudio();
  unlockAudioElement(audio);
  assert.equal(plays(), 1);
  assert.equal(src(), SILENT_CLIP);
  assert.equal(isUnlockClip(audio), true);
});

test('INV-PLAY-04: unlockAudioElement não mexe num elemento que já tem uma faixa carregada', () => {
  const { audio, plays, src } = fakeAudio('https://cdn/faixa.mp3');
  unlockAudioElement(audio);
  assert.equal(plays(), 0);
  assert.equal(src(), 'https://cdn/faixa.mp3');
  assert.equal(isUnlockClip(audio), false);
});

test('sem permissão para tocar o clipe é retirado, para o próximo toque tentar de novo', async () => {
  const { audio, src } = fakeAudio('', 'rejects');
  unlockAudioElement(audio);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(src(), '');
});

test('keep-alive: startAudioKeepAlive ativa loop contínuo e volume inaudível', () => {
  const { audio, plays, loop, volume, src } = fakeAudio();
  startAudioKeepAlive(audio);
  assert.equal(plays(), 1);
  assert.equal(loop(), true);
  assert.equal(volume(), 0.001);
  assert.ok(src().length > 0);
  assert.equal(isUnlockClip(audio), true);
});

test('keep-alive: stopAudioKeepAlive pausa e limpa a fonte de silêncio', () => {
  const { audio, pauses, loop, src } = fakeAudio();
  startAudioKeepAlive(audio);
  stopAudioKeepAlive(audio);
  assert.equal(pauses(), 1);
  assert.equal(loop(), false);
  assert.equal(src(), '');
});

test('o registro de reprodução guarda os últimos eventos, avisa quem assina e formata com a hora', () => {
  clearPlaybackLog();
  let notified = 0;
  const stop = subscribePlaybackLog(() => notified++);
  const log = console.log;
  console.log = () => undefined;
  try {
    for (let i = 0; i < 70; i++) logPlayback(`evento ${i}`, Date.UTC(2026, 9, 26, 12, 0, i));
  } finally {
    console.log = log;
  }
  stop();
  assert.equal(notified, 70);
  const entries = getPlaybackLog();
  assert.equal(entries.length, 60);
  assert.equal(entries[0].text, 'evento 10');
  assert.match(formatPlaybackLog(entries.slice(-1)), /evento 69$/);
  clearPlaybackLog();
  assert.deepEqual(getPlaybackLog(), []);
});

test('o ambiente do relatório diz versão, se é o app instalado ou o navegador, o sistema e o navegador', () => {
  const edgeIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/124.2478.50 Mobile/15E148 Safari/605.1.15';
  const safariIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
  const pwaIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
  const chromeAndroid = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

  assert.equal(describeEnvironment({ version: 'abc123', standalone: false, userAgent: edgeIos }), 'versão abc123 · NAVEGADOR · iOS 17.5 · Edge');
  assert.equal(describeEnvironment({ version: 'abc123', standalone: false, userAgent: safariIos }), 'versão abc123 · NAVEGADOR · iOS 16.6 · Safari');
  assert.equal(describeEnvironment({ version: 'abc123', standalone: true, userAgent: pwaIos }), 'versão abc123 · APP INSTALADO (PWA) · iOS 17.5 · WebKit');
  assert.equal(describeEnvironment({ version: 'dev', standalone: false, userAgent: chromeAndroid }), 'versão dev · NAVEGADOR · Android 14 · Chrome');
  assert.match(describeEnvironment({ version: 'x', standalone: false, userAgent: '' }), /sistema não identificado/);
});
