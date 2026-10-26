import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CODE_TTL_MS,
  codeTimers,
  formatCountdown,
  lastSentAt,
  parseWaitSeconds,
  rememberSent,
  RESEND_COOLDOWN_MS
} from '../src/utils/loginCode';

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

test('codeTimers conta a validade do código e a espera para pedir outro', () => {
  assert.deepEqual(codeTimers(1000, 1000), { codeLeftMs: CODE_TTL_MS, resendLeftMs: RESEND_COOLDOWN_MS });
  assert.deepEqual(codeTimers(1000, 1000 + RESEND_COOLDOWN_MS), { codeLeftMs: CODE_TTL_MS - RESEND_COOLDOWN_MS, resendLeftMs: 0 });
  assert.deepEqual(codeTimers(1000, 1000 + CODE_TTL_MS + 5), { codeLeftMs: 0, resendLeftMs: 0 });
});

test('o código vale mais que a espera para pedir outro (senão não haveria o que reenviar)', () => {
  assert.ok(RESEND_COOLDOWN_MS < CODE_TTL_MS);
});

test('formatCountdown arredonda para cima e nunca mostra 0:00 com tempo sobrando', () => {
  assert.equal(formatCountdown(90_000), '1:30');
  assert.equal(formatCountdown(65_000), '1:05');
  assert.equal(formatCountdown(500), '0:01');
  assert.equal(formatCountdown(0), '0:00');
});

test('o momento do último envio é lembrado por e-mail (sem diferenciar maiúsculas) e limitado a poucos', () => {
  const storage = memoryStorage();
  rememberSent(storage, 'Ana@X.com', 10);
  assert.equal(lastSentAt(storage, 'ana@x.com '), 10);
  assert.equal(lastSentAt(storage, 'outra@x.com'), null);
  for (let i = 0; i < 8; i++) rememberSent(storage, `p${i}@x.com`, 100 + i);
  assert.equal(lastSentAt(storage, 'ana@x.com'), null, 'os mais antigos saem');
  assert.equal(lastSentAt(storage, 'p7@x.com'), 107);
});

test('parseWaitSeconds lê o tempo de espera da resposta do Supabase', () => {
  assert.equal(parseWaitSeconds('For security purposes, you can only request this after 52 seconds.'), 52);
  assert.equal(parseWaitSeconds('after 1 second'), 1);
  assert.equal(parseWaitSeconds('Email rate limit exceeded'), null);
  assert.equal(parseWaitSeconds(undefined), null);
});

test('o modelo de e-mail traz o código, sem link, em português, e o tempo casa com o do app', () => {
  const html = readFileSync('supabase/templates/magic-link.html', 'utf8');
  assert.match(html, /\{\{ \.Token \}\}/);
  assert.doesNotMatch(html, /ConfirmationURL|href=/);
  assert.match(html, /lang="pt-BR"/);
  assert.match(html, new RegExp(`${CODE_TTL_MS / 1000} segundos`));
});
