// INV-ADMIN-03: a leitura do uso diário pede os dias a partir de uma data com um único operador ("gte.2026-…").
import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdmin } from '../../api/_supabaseAdmin';

test('INV-ADMIN-03: o uso diário é pedido com gte.<dia>, sem um segundo operador que o banco recusa', async () => {
  const urls: string[] = [];
  const fetchImpl = (async (url: string) => {
    urls.push(String(url));
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const admin = createAdmin({ url: 'https://example.supabase.co', serviceKey: 'k' }, fetchImpl);
  const opened = await admin.activitySince('2026-10-12');
  assert.deepEqual(opened, {});
  const url = urls.find((u) => u.includes('/app_days'))!;
  assert.ok(url.includes('day=gte.2026-10-12'), url);
  assert.ok(!url.includes('eq.'), url);
});
