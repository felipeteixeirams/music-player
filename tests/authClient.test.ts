import assert from 'node:assert/strict';
import test from 'node:test';
import { describeAuthError, setSessionNotice, takeSessionNotice } from '../src/utils/authClient';

test('describeAuthError traduz cada tipo de falha pelo que o usuário pode fazer', () => {
  assert.match(describeAuthError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }), /Sem conexão/);
  assert.match(describeAuthError({ code: 'email_address_invalid', message: 'Email address is invalid', status: 400 }), /Confira o e-mail/);
  assert.match(describeAuthError({ code: 'unexpected_failure', message: 'Error sending magic link email', status: 500 }), /não conseguiu enviar o e-mail/);
  assert.match(describeAuthError({ status: 502, message: 'bad gateway' }), /não conseguiu enviar/);
  // a biblioteca chama de "retryable fetch" tanto a falta de resposta (status 0) quanto o erro 5xx do servidor
  assert.match(describeAuthError({ name: 'AuthRetryableFetchError', status: 500, message: 'Error sending magic link email' }), /não conseguiu enviar/);
  assert.match(describeAuthError({ code: 'otp_expired', message: 'Token has expired or is invalid', status: 403 }), /incorreto ou expirado/);
  assert.match(describeAuthError({ status: 429, code: 'over_request_rate_limit' }), /Muitas tentativas/);
  assert.match(describeAuthError({}), /Não foi possível entrar/);
});

test('o aviso para a tela de login é entregue uma vez só', () => {
  assert.equal(takeSessionNotice(), null);
  setSessionNotice('Sua sessão terminou.');
  assert.equal(takeSessionNotice(), 'Sua sessão terminou.');
  assert.equal(takeSessionNotice(), null);
});
