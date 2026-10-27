import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  checkDeepConfig,
  checkStaticConfig,
  formatFinding,
  keyRole,
  publicReport,
  reportStartupOnce,
  resetStartupReport,
  resetDeepCache,
  summarize,
  cachedDeepConfig
} from '../api/_config';
import { evaluate, functionRegion } from '../scripts/check-deploy.mjs';
import { scan } from '../scripts/check-bundle.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const jwt = (role: string) => `h.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.s`;
const URL_OK = 'https://abcdefghij0123456789.supabase.co';
const GOOD = {
  DATABASE_SUPABASE_URL: URL_OK,
  DATABASE_VITE_SUPABASE_URL: URL_OK,
  DATABASE_VITE_SUPABASE_ANON_KEY: jwt('anon'),
  DATABASE_SUPABASE_SERVICE_ROLE_KEY: jwt('service_role'),
  YOUTUBE_API_KEY: 'yt'
};
const level = (env: Record<string, string | undefined>, id: string) => checkStaticConfig(env).find((f) => f.id === id)?.level;

test('keyRole lê o papel da chave no formato JWT e devolve null para as demais', () => {
  assert.equal(keyRole(jwt('anon')), 'anon');
  assert.equal(keyRole(jwt('service_role')), 'service_role');
  assert.equal(keyRole('sb_publishable_abc'), null);
  assert.equal(keyRole('a.b'), null);
});

test('configuração completa: nenhum erro nem aviso', () => {
  const findings = checkStaticConfig(GOOD);
  assert.deepEqual(summarize(findings), { ok: true, errors: 0, warnings: 0 });
});

test('sem variável nenhuma: o login falha e o cache e o YouTube avisam', () => {
  const findings = checkStaticConfig({});
  assert.equal(level({}, 'login-url'), 'error');
  assert.equal(level({}, 'login-key'), 'error');
  assert.equal(level({}, 'service-key'), 'warn');
  assert.equal(level({}, 'youtube-key'), 'warn');
  assert.equal(summarize(findings).ok, false);
});

test('o navegador sem as variáveis do build é erro quando o servidor tem login (o app abriria sem a tela de login)', () => {
  const env = { ...GOOD, DATABASE_VITE_SUPABASE_URL: undefined, DATABASE_VITE_SUPABASE_ANON_KEY: undefined };
  assert.equal(level(env, 'login-client'), 'error');
  assert.match(checkStaticConfig(env).find((f) => f.id === 'login-client')!.message, /DATABASE_VITE_SUPABASE_URL e DATABASE_VITE_SUPABASE_ANON_KEY/);
});

test('chaves trocadas ou iguais são erro', () => {
  assert.equal(level({ ...GOOD, DATABASE_VITE_SUPABASE_ANON_KEY: jwt('service_role') }, 'login-key'), 'error');
  assert.equal(level({ ...GOOD, DATABASE_SUPABASE_SERVICE_ROLE_KEY: jwt('anon') }, 'service-key'), 'error');
  const same = jwt('anon');
  assert.equal(level({ ...GOOD, DATABASE_VITE_SUPABASE_ANON_KEY: same, DATABASE_SUPABASE_SERVICE_ROLE_KEY: same }, 'service-key-differs'), 'error');
});

test('chave de serviço copiada para uma variável que vai ao navegador é erro', () => {
  const env = { ...GOOD, VITE_OOPS: GOOD.DATABASE_SUPABASE_SERVICE_ROLE_KEY };
  assert.equal(level(env, 'service-key-public'), 'error');
  assert.equal(level({ ...GOOD, SOMETHING_PRIVATE: GOOD.DATABASE_SUPABASE_SERVICE_ROLE_KEY }, 'service-key-public'), undefined);
});

test('URLs de projetos diferentes e URL com formato estranho', () => {
  assert.equal(level({ ...GOOD, DATABASE_VITE_SUPABASE_URL: 'https://zzzzzzzzzzzzzzzzzzzz.supabase.co' }, 'login-project-match'), 'error');
  assert.equal(level({ ...GOOD, DATABASE_SUPABASE_URL: 'http://localhost:54321', DATABASE_VITE_SUPABASE_URL: 'http://localhost:54321' }, 'login-url'), 'warn');
});

test('DAILY_NEW_TRACKS inválido avisa; válido ou ausente não', () => {
  assert.equal(level({ ...GOOD, DAILY_NEW_TRACKS: 'muitas' }, 'daily-limit'), 'warn');
  assert.equal(level({ ...GOOD, DAILY_NEW_TRACKS: '20' }, 'daily-limit'), undefined);
});

test('INV-AUTH-03: o relatório público traz só ids e níveis: nenhum nome de variável nem valor', () => {
  const secret = 'segredo-xyz-123';
  const report = publicReport(checkStaticConfig({ DATABASE_SUPABASE_URL: URL_OK, DATABASE_SUPABASE_SERVICE_ROLE_KEY: secret }));
  const text = JSON.stringify(report);
  assert.equal(report.ok, false);
  assert.doesNotMatch(text, /DATABASE_|segredo|supabase\.co/);
  assert.ok(report.problems.every((p) => typeof p.id === 'string' && ['warn', 'error'].includes(p.level)));
});

// ------------------------------------------------------------------ consulta aos serviços

function services(options: { settings?: object | number; rest?: object | number } = {}) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    calls.push(url.replace(URL_OK, ''));
    const answer = url.includes('/auth/v1/settings') ? options.settings : options.rest;
    if (typeof answer === 'number') return new Response('{}', { status: answer });
    return new Response(JSON.stringify(answer ?? {}), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}
const PATHS = Object.fromEntries(
  ['/favorites', '/playlists', '/playlist_tracks', '/video_choices', '/play_history', '/video_cache', '/usage_daily', '/rpc/consume_resolve', '/rpc/refund_resolve'].map((p) => [p, {}])
);
const ids = (findings: { id: string; level: string }[], levelName: string) => findings.filter((f) => f.level === levelName).map((f) => f.id);

test('serviços: tudo certo quando o cadastro está fechado, a chave vale e as migrações rodaram', async () => {
  const { fetchImpl } = services({ settings: { disable_signup: true, external: { email: true } }, rest: { paths: PATHS } });
  const findings = await checkDeepConfig(GOOD, fetchImpl);
  assert.deepEqual(ids(findings, 'error'), []);
  assert.deepEqual(ids(findings, 'warn'), []);
});

test('serviços: cadastro aberto ligado é erro', async () => {
  const { fetchImpl } = services({ settings: { disable_signup: false, external: { email: true } }, rest: { paths: PATHS } });
  assert.deepEqual(ids(await checkDeepConfig(GOOD, fetchImpl), 'error'), ['signup-open']);
});

test('serviços: chave pública recusada e chave de serviço recusada', async () => {
  const { fetchImpl } = services({ settings: 401, rest: 401 });
  assert.deepEqual(ids(await checkDeepConfig(GOOD, fetchImpl), 'error'), ['auth-settings', 'service-key-valid']);
});

test('serviços: migração que falta é apontada pelo nome do que falta', async () => {
  const { paths } = { paths: { ...PATHS } as Record<string, unknown> };
  delete paths['/rpc/refund_resolve'];
  const { fetchImpl } = services({ settings: { disable_signup: true }, rest: { paths } });
  const findings = await checkDeepConfig(GOOD, fetchImpl);
  assert.deepEqual(ids(findings, 'error'), ['migrations']);
  assert.match(findings.find((f) => f.id === 'migrations')!.message, /rpc\/refund_resolve/);
});

test('serviços: Supabase fora do ar é aviso, não erro (não se sabe se a configuração está errada)', async () => {
  const fetchImpl = (async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  const findings = await checkDeepConfig(GOOD, fetchImpl);
  assert.deepEqual(ids(findings, 'error'), []);
  assert.ok(ids(findings, 'warn').length > 0);
});

test('a consulta aos serviços é lembrada por cinco minutos (a rota de saúde é pública)', async () => {
  resetDeepCache();
  const { fetchImpl, calls } = services({ settings: { disable_signup: true }, rest: { paths: PATHS } });
  let now = 0;
  await cachedDeepConfig(() => now, GOOD, fetchImpl);
  const after = calls.length;
  await cachedDeepConfig(() => now + 60_000, GOOD, fetchImpl);
  assert.equal(calls.length, after);
  await cachedDeepConfig(() => now + 6 * 60_000, GOOD, fetchImpl);
  assert.ok(calls.length > after);
  resetDeepCache();
});

test('o relatório de partida só aparece em produção e não mostra valores', () => {
  const lines: string[] = [];
  reportStartupOnce({ ...GOOD, DATABASE_SUPABASE_SERVICE_ROLE_KEY: undefined }, (line) => lines.push(line));
  assert.equal(lines.length, 0, 'fora de produção fica quieto');

  const offline = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
  reportStartupOnce({ NODE_ENV: 'production', DATABASE_SUPABASE_URL: URL_OK, DATABASE_SUPABASE_SERVICE_ROLE_KEY: 'valor-secreto-abc' }, (line) => lines.push(line), offline);
  const text = lines.join('\n');
  assert.match(text, /\[Config\] ❌ login-key/);
  assert.match(text, /configuração: \d+ erro\(s\)/);
  assert.doesNotMatch(text, /valor-secreto-abc/);
  assert.match(formatFinding({ id: 'x', level: 'warn', message: 'm' }), /^\[Config\] ⚠️ x: m$/);
  resetStartupReport();
  resetDeepCache();
});

test('INV-CFG-01: na Vercel a partida da função não consulta o Supabase (isso é do /api/health?deep=1); fora dela, consulta', async () => {
  let calls = 0;
  const spy = (async () => { calls += 1; return new Response('{}', { status: 200 }); }) as typeof fetch;

  resetStartupReport();
  resetDeepCache();
  const vercel: string[] = [];
  reportStartupOnce({ VERCEL: '1', DATABASE_SUPABASE_URL: URL_OK, DATABASE_VITE_SUPABASE_ANON_KEY: 'k', DATABASE_SUPABASE_SERVICE_ROLE_KEY: 'v' }, (line) => vercel.push(line), spy);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 0, 'na Vercel a partida não faz pedido nenhum ao Supabase');
  assert.ok(vercel.some((line) => /configuração: \d+ erro/.test(line)), 'o resumo das variáveis continua');
  assert.ok(vercel.some((line) => /\/api\/health\?deep=1/.test(line)), 'o log diz onde os serviços são conferidos');

  resetStartupReport();
  resetDeepCache();
  const server: string[] = [];
  reportStartupOnce({ NODE_ENV: 'production', DATABASE_SUPABASE_URL: URL_OK, DATABASE_VITE_SUPABASE_ANON_KEY: 'k', DATABASE_SUPABASE_SERVICE_ROLE_KEY: 'v' }, (line) => server.push(line), spy);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(calls > 0, 'o servidor de longa duração (server.ts) continua consultando ao subir');
  assert.ok(server.some((line) => /serviços: \d+ erro/.test(line)));

  resetStartupReport();
  resetDeepCache();
});

// ------------------------------------------------------------------ o que o pipeline faz com isso

test('check-deploy: erro nas variáveis ou nos serviços reprova; aviso não', () => {
  const clean = { status: 'ok', config: { ok: true, problems: [] }, services: { ok: true, problems: [] } };
  assert.deepEqual(evaluate(clean), { errors: [], warnings: [] });

  const broken = {
    status: 'ok',
    config: { ok: false, problems: [{ id: 'login-key', level: 'error' }, { id: 'youtube-key', level: 'warn' }] },
    services: { ok: false, problems: [{ id: 'signup-open', level: 'error' }] }
  };
  assert.deepEqual(evaluate(broken), { errors: ['variáveis:login-key', 'serviços:signup-open'], warnings: ['variáveis:youtube-key'] });
  assert.deepEqual(evaluate({ status: 'ok', config: { ok: true, problems: [] } }).warnings, ['serviços:não consultados']);
  assert.deepEqual(evaluate({}).errors, ['health:status']);
});

test('INV-AUTH-02: check-bundle: acha segredo no build e acusa configuração pública ausente', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-'));
  writeFileSync(join(dir, 'index.js'), 'const url="https://pub.supabase.co";');
  const env = { SECRET_A: 'segredo-aaa', PUBLIC_A: 'https://pub.supabase.co', PUBLIC_B: 'nao-esta' };
  assert.deepEqual(scan(dir, ['SECRET_A'], ['PUBLIC_A'], env), []);
  writeFileSync(join(dir, 'leak.js'), 'x="segredo-aaa"');
  assert.match(scan(dir, ['SECRET_A'], [], env)[0], /SECRET_A VAZOU/);
  assert.match(scan(dir, [], ['PUBLIC_B'], env)[0], /PUBLIC_B NÃO chegou/);
  assert.match(scan(dir, ['SEM_VALOR'], [], env)[0], /sem valor de teste/);
});

// ------------------------------------------------------------------ o código só lê variáveis conhecidas

const SYSTEM_VARS = ['CI', 'NODE_ENV', 'PORT', 'VERCEL', 'VERCEL_GIT_COMMIT_SHA', 'DISABLE_HMR', 'CHROMIUM_PATH', 'E2E_SKIP_BUILD', 'RUN_LIVE_INTEGRATION_TESTS'];
const DOCUMENTED_VARS = [
  'DATABASE_VITE_SUPABASE_URL',
  'DATABASE_VITE_SUPABASE_ANON_KEY',
  'DATABASE_SUPABASE_URL',
  'DATABASE_SUPABASE_SERVICE_ROLE_KEY',
  'YOUTUBE_API_KEY',
  'DAILY_NEW_TRACKS',
  'CONFIG_REPORT'
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.ts$/.test(name) ? [path] : [];
  });
}

test('toda variável de ambiente lida pelo código está declarada (sistema ou documentada)', () => {
  const files = [...sources('api'), ...sources('src'), 'server.ts', 'vite.config.ts'];
  const used = new Set<string>();
  for (const file of files) {
    for (const match of readFileSync(file, 'utf8').matchAll(/process\.env\.([A-Z0-9_]+)/g)) used.add(match[1]);
  }
  const unknown = [...used].filter((name) => !SYSTEM_VARS.includes(name) && !DOCUMENTED_VARS.includes(name));
  assert.deepEqual(unknown, [], `Variável nova: documente em .env.example e em tests/config.test.ts (DOCUMENTED_VARS): ${unknown.join(', ')}`);
});

test('.env.example menciona cada variável documentada', () => {
  const example = readFileSync('.env.example', 'utf8');
  const missing = DOCUMENTED_VARS.filter((name) => !example.includes(name));
  assert.deepEqual(missing, [], `Faltam no .env.example: ${missing.join(', ')}`);
});

test('check-deploy: a região das funções vem do x-vercel-id e fora de São Paulo vira aviso', () => {
  assert.equal(functionRegion('gru1::gru1::abc-123'), 'gru1');
  assert.equal(functionRegion('iad1::iad1::abc'), 'iad1');
  assert.equal(functionRegion('gru1::iad1::abc'), 'iad1', 'a segunda é onde a função rodou');
  assert.equal(functionRegion(null), null);
  const base = { status: 'ok', config: { ok: true, problems: [] }, services: { ok: true, problems: [] } };
  assert.deepEqual(evaluate({ ...base, region: 'gru1' }).warnings, []);
  assert.match(evaluate({ ...base, region: 'iad1' }).warnings[0], /iad1/);
});
