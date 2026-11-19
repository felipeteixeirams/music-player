// INV-NOT-01 e INV-NOT-02: a caixa de avisos lê só as linhas da pessoa, conta as não lidas e marca só a data de leitura.
import assert from 'node:assert/strict';
import test from 'node:test';
import { countUnread, noticeBody, noticeTitle, parseNotifications, type AppNotification } from '../src/utils/notifications';
import { fetchNotifications, markNotificationsRead, NOTIFICATIONS_LIMIT } from '../src/utils/notificationsRemote';

const CONFIG = { url: 'https://x.supabase.co', key: 'anon-key' };
const USER = { id: '11111111-2222-3333-4444-555555555555', token: 'secret-token' };
const NOTICE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const notice = (overrides: Partial<AppNotification> = {}): AppNotification => ({
  id: NOTICE_ID,
  kind: 'invite',
  payload: { title: 'Ana convidou você', body: 'Festa de sábado' },
  createdAt: '2026-11-19T10:00:00.000Z',
  readAt: null,
  ...overrides
});

test('INV-NOT-01: a contagem de não lidas ignora as lidas', () => {
  assert.equal(countUnread([]), 0);
  assert.equal(countUnread([notice(), notice({ id: 'b', readAt: '2026-11-19T11:00:00.000Z' }), notice({ id: 'c' })]), 2);
});

test('INV-NOT-01: um aviso sem título mostra "Aviso", e o texto vem do servidor sem espaços sobrando', () => {
  assert.equal(noticeTitle(notice({ payload: {} })), 'Aviso');
  assert.equal(noticeTitle(notice({ payload: { title: '   ' } })), 'Aviso');
  assert.equal(noticeTitle(notice()), 'Ana convidou você');
  assert.equal(noticeBody(notice({ payload: { body: '  oi  ' } })), 'oi');
  assert.equal(noticeBody(notice({ payload: {} })), '');
});

test('INV-NOT-01: linha que não fecha com o formato é descartada, sem quebrar as outras', () => {
  const parsed = parseNotifications([
    { id: NOTICE_ID, kind: 'invite', payload: { title: 'Oi' }, created_at: '2026-11-19T10:00:00Z', read_at: null },
    { id: 'sem-kind', created_at: '2026-11-19T10:00:00Z' },
    null,
    'texto',
    { id: 'payload-lista', kind: 'x', payload: [1], created_at: '2026-11-19T10:00:00Z', read_at: '2026-11-19T11:00:00Z' }
  ]);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[1].payload, {});
  assert.equal(parsed[1].readAt, '2026-11-19T11:00:00Z');
  assert.deepEqual(parseNotifications({ not: 'an array' }), []);
});

test('INV-NOT-01: a leitura vai com o token da pessoa, pede só o necessário e fica limitada', async () => {
  let seen = '';
  let auth = '';
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    seen = url;
    auth = (init?.headers as Record<string, string>).Authorization;
    return new Response(JSON.stringify([{ id: NOTICE_ID, kind: 'invite', payload: { title: 'Oi' }, created_at: '2026-11-19T10:00:00Z', read_at: null }]), { status: 200 });
  }) as typeof fetch;
  const notices = await fetchNotifications(CONFIG, USER, fetchImpl);
  assert.equal(notices.length, 1);
  assert.equal(auth, 'Bearer secret-token');
  assert.match(seen, /\/rest\/v1\/user_notifications\?select=id,kind,payload,created_at,read_at&order=created_at\.desc&limit=50$/);
  assert.equal(NOTIFICATIONS_LIMIT, 50);
});

test('INV-NOT-01: sem a tabela (resposta que não é lista) a leitura falha e a tela mostra indisponível', async () => {
  const fetchImpl = (async () => new Response('{"message":"relation does not exist"}', { status: 404 })) as typeof fetch;
  await assert.rejects(() => fetchNotifications(CONFIG, USER, fetchImpl), /Falha 404|Resposta inesperada/);
});

test('INV-NOT-02: marcar como lidas manda só read_at, só para as linhas informadas e sem as já lidas', async () => {
  const calls: { url: string; method: string; body: string }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: String(init?.method), body: String(init?.body) });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const now = new Date('2026-11-19T12:00:00.000Z');
  await markNotificationsRead(CONFIG, USER, [NOTICE_ID, 'lixo; drop table', NOTICE_ID], now, fetchImpl);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'PATCH');
  assert.match(calls[0].url, new RegExp(`id=in\\.\\(${NOTICE_ID}\\)&read_at=is\\.null$`));
  assert.deepEqual(JSON.parse(calls[0].body), { read_at: '2026-11-19T12:00:00.000Z' });

  await markNotificationsRead(CONFIG, USER, [], now, fetchImpl);
  assert.equal(calls.length, 1, 'sem ids não há chamada');
});
