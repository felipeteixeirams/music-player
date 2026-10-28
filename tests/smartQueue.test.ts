import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Track } from '../src/types/music';
import { allowanceDay, KNOWN_LOOKAHEAD, nextKnownIndex, skipNotice } from '../src/utils/smartQueue';

const track = (id: number): Track => ({ id: `deezer-${id}`, title: `T${id}`, artist: 'A', album: 'B', duration: 100, coverUrl: '', style: 's', categoryId: 'web', sources: { localUrl: '' } });
const queue = Array.from({ length: 30 }, (_, i) => track(i));

test('INV-PLAY-16: a fila procura a próxima faixa de vídeo conhecido à frente, dentro do alcance', () => {
  const known = new Set(['deezer-3', 'deezer-20']);
  const isPlayable = (t: Track) => known.has(t.id);
  assert.equal(nextKnownIndex(queue, 0, isPlayable), 3);
  assert.equal(nextKnownIndex(queue, 3, isPlayable), -1, 'a 17 posições: fora do alcance de ' + KNOWN_LOOKAHEAD);
  assert.equal(nextKnownIndex(queue, 10, isPlayable), 20);
  assert.equal(nextKnownIndex(queue, 20, isPlayable), -1, 'depois da última conhecida não há nada');
  assert.equal(nextKnownIndex(queue, 29, isPlayable), -1, 'no fim da lista');
  assert.equal(nextKnownIndex(queue, 0, () => false), -1);
});

test('INV-PLAY-16: o aviso diz quantas foram puladas e, com o limite esgotado, por quê', () => {
  assert.match(skipNotice(1, true), /^Puladas 1 faixa sem vídeo: você chegou ao limite de faixas novas de hoje/);
  assert.match(skipNotice(3, true), /^Puladas 3 faixas sem vídeo:/);
  assert.equal(skipNotice(2, false), 'Puladas 2 faixas sem vídeo disponível.');
});

test('o dia da cota é o de São Paulo', () => {
  // 2026-10-29 02:00 UTC is still the 28th in São Paulo (UTC-3)
  assert.equal(allowanceDay(Date.UTC(2026, 9, 29, 2, 0, 0)), '2026-10-28');
  assert.equal(allowanceDay(Date.UTC(2026, 9, 29, 4, 0, 0)), '2026-10-29');
});
