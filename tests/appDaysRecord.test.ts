// INV-ADMIN-03: quando a gravação do uso diário é recusada, o motivo (status e início da resposta) fica disponível.
import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyUseFailureMessage } from '../src/utils/appDaysRemote';
import { createRestCaller, RemoteError } from '../src/utils/supabaseRest';

test('INV-ADMIN-03: uma gravação recusada guarda o status e o começo da resposta do banco, sem o token', async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ code: '42501', message: 'new row violates row-level security policy for table "app_days"' }), { status: 403 })) as typeof fetch;
  const call = createRestCaller({ url: 'https://x.supabase.co', key: 'anon-key' }, async () => ({ id: 'u1', token: 'secret-token' }), fetchImpl);
  await assert.rejects(
    () => call('/app_days?on_conflict=user_id,day', { method: 'POST', body: '[]' }),
    (error: unknown) => {
      assert.ok(error instanceof RemoteError);
      assert.equal(error.status, 403);
      assert.match(error.detail ?? '', /row-level security/);
      assert.ok(!(error.detail ?? '').includes('secret-token'));
      return true;
    }
  );
});

test('INV-ADMIN-03: a mensagem da gravação recusada leva o id da conta enviado e o status, sem o token', () => {
  const refused = new RemoteError('Falha 403 em /app_days', 403, '{"code":"42501"}');
  const message = dailyUseFailureMessage(refused, '43f376c5-9a8e-4e20-a38f-bb3724cb093d');
  assert.equal(message, 'uso diário: 403 {"code":"42501"} (conta 43f376c5-9a8e-4e20-a38f-bb3724cb093d)');
  assert.ok(!message.includes('token'));
  assert.equal(dailyUseFailureMessage(new Error('Sem conexão'), 'u1'), 'uso diário: Sem conexão (conta u1)');
});
