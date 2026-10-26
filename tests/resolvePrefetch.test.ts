import assert from 'node:assert/strict';
import test from 'node:test';
import { createLookupQueue, type PrefetchTrack } from '../src/utils/resolvePrefetch';

const track = (n: number): PrefetchTrack => ({ id: `deezer-${n}`, artist: 'A', title: `T${n}`, duration: 100 });

/** A scheduler the test drives by hand. */
function manualScheduler() {
  const jobs: (() => void)[] = [];
  return {
    schedule: (callback: () => void) => {
      jobs.push(callback);
      return jobs.length - 1;
    },
    cancel: () => {
      jobs.length = 0;
    },
    run: async () => {
      const job = jobs.shift();
      job?.();
      await new Promise((resolve) => setImmediate(resolve));
    },
    pending: () => jobs.length
  };
}

function setup(sendImpl?: (items: PrefetchTrack[]) => Promise<Record<string, string[]>>, known: string[] = []) {
  const sent: PrefetchTrack[][] = [];
  const found: [string, string[]][] = [];
  const scheduler = manualScheduler();
  const queue = createLookupQueue({
    send: async (items) => {
      sent.push(items);
      return sendImpl ? sendImpl(items) : {};
    },
    onFound: (id, ids) => found.push([id, ids]),
    isKnown: (id) => known.includes(id),
    schedule: scheduler.schedule,
    cancel: scheduler.cancel
  });
  return { queue, sent, found, scheduler };
}

test('várias listas na mesma tela viram um pedido só, depois de uma pausa', async () => {
  const t = setup();
  t.queue.enqueue([track(1), track(2)]);
  t.queue.enqueue([track(3)]);
  assert.equal(t.scheduler.pending(), 1);
  assert.equal(t.sent.length, 0);
  await t.scheduler.run();
  assert.equal(t.sent.length, 1);
  assert.deepEqual(t.sent[0].map((x) => x.id), ['deezer-1', 'deezer-2', 'deezer-3']);
});

test('faixa já conhecida no aparelho ou já perguntada nesta sessão não é perguntada de novo', async () => {
  const t = setup(undefined, ['deezer-1']);
  t.queue.enqueue([track(1), track(2)]);
  await t.scheduler.run();
  t.queue.enqueue([track(2), track(3)]);
  await t.scheduler.run();
  assert.deepEqual(t.sent.map((batch) => batch.map((x) => x.id)), [['deezer-2'], ['deezer-3']]);
});

test('o que o servidor achou é entregue a quem guarda', async () => {
  const t = setup(async () => ({ 'deezer-1': ['AAAAAAAAAAA'], 'deezer-2': [] }));
  t.queue.enqueue([track(1), track(2)]);
  await t.scheduler.run();
  assert.deepEqual(t.found, [['deezer-1', ['AAAAAAAAAAA']]]);
});

test('se o pedido falha (sem rede), as faixas voltam a poder ser perguntadas', async () => {
  let fail = true;
  const t = setup(async () => {
    if (fail) throw new Error('offline');
    return { 'deezer-1': ['AAAAAAAAAAA'] };
  });
  t.queue.enqueue([track(1)]);
  await t.scheduler.run();
  assert.equal(t.found.length, 0);

  fail = false;
  t.queue.enqueue([track(1)]);
  await t.scheduler.run();
  assert.deepEqual(t.found, [['deezer-1', ['AAAAAAAAAAA']]]);
});

test('lotes de até 40 faixas: o resto vai no pedido seguinte', async () => {
  const t = setup();
  t.queue.enqueue(Array.from({ length: 50 }, (_, i) => track(i)));
  await t.scheduler.run();
  await t.scheduler.run();
  assert.deepEqual(t.sent.map((batch) => batch.length), [40, 10]);
});

test('stop cancela o que estava esperando', async () => {
  const t = setup();
  t.queue.enqueue([track(1)]);
  t.queue.stop();
  await t.scheduler.run();
  assert.equal(t.sent.length, 0);
});
