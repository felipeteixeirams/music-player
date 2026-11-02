import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyYouTubeError } from '../src/utils/youtubeErrors';

test('INV-PLAY-27: vídeo que não pode ser incorporado (101 e 150), removido (100) ou com pedido inválido (2) é denunciado e passa para a próxima versão', () => {
  for (const code of [101, 150, 100, 2]) {
    const failure = classifyYouTubeError(code);
    assert.equal(failure.denounce, true, `código ${code}`);
    assert.equal(failure.tryOtherVersions, true, `código ${code}`);
    assert.equal(failure.retrySame, false, `código ${code}`);
  }
  assert.equal(classifyYouTubeError(150).kind, 'embed-blocked');
  assert.equal(classifyYouTubeError(101).kind, 'embed-blocked');
  assert.equal(classifyYouTubeError(100).kind, 'not-found');
});

test('INV-PLAY-27: erro passageiro do player (5) tenta o mesmo vídeo de novo e não o tira do cache', () => {
  const failure = classifyYouTubeError(5);
  assert.deepEqual([failure.retrySame, failure.denounce, failure.tryOtherVersions], [true, false, true]);
});

test('INV-PLAY-27: player que não carregou (-1) nunca denuncia um vídeo nem tenta outras versões', () => {
  const failure = classifyYouTubeError(-1);
  assert.deepEqual([failure.kind, failure.denounce, failure.tryOtherVersions, failure.retrySame], ['not-loaded', false, false, false]);
});

test('INV-PLAY-27: código desconhecido não denuncia o vídeo, e a descrição leva o código', () => {
  const failure = classifyYouTubeError(777);
  assert.equal(failure.denounce, false);
  assert.match(failure.description, /777/);
  assert.equal(classifyYouTubeError(undefined).kind, 'unknown');
});
