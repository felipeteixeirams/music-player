import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWarmQueue, type WarmResult } from '../src/utils/warmResolve';

const track = (n: number) => ({ id: `deezer-${n}` });

function setup(results: WarmResult[] | ((id: string) => WarmResult), extra: { canRun?: () => boolean; known?: Set<string>; maxSearches?: number } = {}) {
  const calls: string[] = [];
  const timers: { callback: () => void; ms: number }[] = [];
  let stopped: string | null = null;
  const known = extra.known ?? new Set<string>();
  let i = 0;
  const queue = createWarmQueue({
    isKnown: (id) => known.has(id),
    warm: async (t: { id: string }) => {
      calls.push(t.id);
      return typeof results === 'function' ? results(t.id) : results[Math.min(i++, results.length - 1)];
    },
    canRun: extra.canRun ?? (() => true),
    today: () => '2026-10-28',
    stoppedDay: { get: () => stopped, set: (day) => (stopped = day) },
    maxSearches: extra.maxSearches,
    schedule: (callback, ms) => timers.push({ callback, ms })
  });
  // Runs the next timer and lets the async work it started finish
  const tick = async () => {
    const timer = timers.shift();
    timer?.callback();
    await new Promise((resolve) => setImmediate(resolve));
    return timer?.ms;
  };
  return { queue, calls, timers, tick, stopped: () => stopped };
}

test('INV-PLAY-14: a pré-resolução anda uma faixa por vez, começa depois de uma pausa e põe a fila antes dos cartões', async () => {
  const t = setup(['searched']);
  t.queue.enqueue([track(1), track(2)]);
  t.queue.enqueue([track(9)], true);
  assert.equal(t.timers.length, 1, 'um só agendamento, mesmo com vários enqueue');
  assert.equal(await t.tick(), 3000, 'espera o início de 3 s');
  assert.deepEqual(t.calls, ['deezer-9'], 'a próxima da fila vem antes');
  assert.equal(await t.tick(), 1500, 'entre buscas, uma pausa de 1,5 s');
  assert.deepEqual(t.calls, ['deezer-9', 'deezer-1']);
});

test('INV-PLAY-14: não repete faixa, pula a já conhecida e uma que já tinha vídeo no cache segue logo (250 ms)', async () => {
  const t = setup(['cached', 'searched'], { known: new Set(['deezer-2']) });
  t.queue.enqueue([track(1), track(2), track(3)]);
  t.queue.enqueue([track(1), track(3)]);
  await t.tick();
  assert.equal(await t.tick(), 250, 'depois de um cache a próxima vem logo');
  await t.tick();
  assert.deepEqual(t.calls, ['deezer-1', 'deezer-3'], 'a conhecida (2) e as repetidas ficaram de fora');
});

test('INV-PLAY-14: o limite por sessão para a pré-resolução; o servidor recusando (skipped) para o dia inteiro e fica lembrado', async () => {
  const limited = setup(['searched'], { maxSearches: 2 });
  limited.queue.enqueue([track(1), track(2), track(3), track(4)]);
  await limited.tick();
  await limited.tick();
  assert.deepEqual(limited.calls, ['deezer-1', 'deezer-2']);
  assert.equal(limited.queue.stats().stopped, true);
  assert.equal(limited.timers.length, 0, 'nada mais agendado');

  const refused = setup(['searched', 'skipped']);
  refused.queue.enqueue([track(1), track(2), track(3)]);
  await refused.tick();
  await refused.tick();
  assert.equal(refused.stopped(), '2026-10-28', 'lembra que hoje acabou');
  assert.equal(refused.queue.stats().waiting, 0);
  // Another session of the app on the same day does not even try
  refused.queue.enqueue([track(7)]);
  assert.equal(refused.queue.stats().stopped, true);
});

test('INV-PLAY-14: três falhas seguidas param; página escondida ou sem conexão só adia', async () => {
  const failing = setup(['failed']);
  failing.queue.enqueue([track(1), track(2), track(3), track(4)]);
  await failing.tick();
  await failing.tick();
  await failing.tick();
  assert.equal(failing.calls.length, 3);
  assert.equal(failing.queue.stats().stopped, true);

  let visible = false;
  const hidden = setup(['searched'], { canRun: () => visible });
  hidden.queue.enqueue([track(1)]);
  assert.equal(await hidden.tick(), 3000);
  assert.equal(hidden.calls.length, 0, 'escondida: não busca');
  assert.equal(hidden.timers.length, 1, 'tenta de novo mais tarde');
  visible = true;
  await hidden.tick();
  assert.deepEqual(hidden.calls, ['deezer-1']);
});
