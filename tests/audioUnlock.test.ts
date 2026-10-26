import assert from 'node:assert/strict';
import test from 'node:test';
import { isUnlockClip, SILENT_CLIP, unlockAudioElement } from '../src/utils/audioUnlock';
import { clearPlaybackLog, formatPlaybackLog, getPlaybackLog, logPlayback, subscribePlaybackLog } from '../src/utils/playbackDiagnostics';

function fakeAudio(initialSrc = '', playResult: 'ok' | 'rejects' = 'ok') {
  let src = initialSrc;
  let plays = 0;
  const audio = {
    getAttribute: (name: string) => (name === 'src' && src ? src : null),
    removeAttribute: (name: string) => {
      if (name === 'src') src = '';
    },
    set src(value: string) {
      src = value;
    },
    play: () => {
      plays++;
      return playResult === 'ok' ? Promise.resolve() : Promise.reject(new Error('NotAllowedError'));
    }
  };
  return { audio: audio as unknown as HTMLAudioElement, plays: () => plays, src: () => src };
}

test('o clipe de silêncio é um WAV curto e válido', () => {
  const bytes = Buffer.from(SILENT_CLIP.split(',')[1], 'base64');
  assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
  assert.equal(bytes.subarray(8, 12).toString(), 'WAVE');
  assert.ok(bytes.length < 2000);
});

test('unlockAudioElement toca o clipe num elemento parado', () => {
  const { audio, plays, src } = fakeAudio();
  unlockAudioElement(audio);
  assert.equal(plays(), 1);
  assert.equal(src(), SILENT_CLIP);
  assert.equal(isUnlockClip(audio), true);
});

test('unlockAudioElement não mexe num elemento que já tem uma faixa carregada', () => {
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
