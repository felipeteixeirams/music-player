import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldReport } from '../src/utils/errorReporter';
import { newRequestId, sessionId } from '../src/utils/trace';

test('INV-OBS-03: o app não reporta ruído (script de outra origem, ResizeObserver, abortos) e reporta o resto', () => {
  assert.equal(shouldReport('Script error.'), false);
  assert.equal(shouldReport('ResizeObserver loop completed with undelivered notifications.'), false);
  assert.equal(shouldReport('AbortError: The user aborted a request.'), false);
  assert.equal(shouldReport(''), false);
  assert.equal(shouldReport("Cannot read properties of undefined (reading 'x')"), true);
});

test('os ids de sessão e de pedido têm o formato que o servidor aceita e mudam a cada pedido', () => {
  const shape = /^[A-Za-z0-9_-]{6,40}$/;
  assert.match(sessionId, shape);
  const first = newRequestId();
  assert.match(first, shape);
  assert.notEqual(first, newRequestId());
});
