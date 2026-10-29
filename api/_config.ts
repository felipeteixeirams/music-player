import { KEY_VARS, URL_VARS } from './_auth.js';

type Env = Record<string, string | undefined>;

export type Level = 'ok' | 'warn' | 'error';

/** One thing checked. `message` may name variables (it goes to the log); the public health answer only carries `id` and `level`. */
export interface Finding {
  id: string;
  level: Level;
  message: string;
}

/**
 * Everything the app needs from its environment to work as designed, checked from what is set (static) and from
 * what the services answer (deep). The ids are listed, with what to do about each, in docs/masters/accounts-and-data.md.
 */
const CLIENT_URL_VARS = ['DATABASE_VITE_SUPABASE_URL', 'VITE_SUPABASE_URL'];
const CLIENT_KEY_VARS = [
  'DATABASE_VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'DATABASE_VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY'
];
const SERVICE_KEY_VARS = ['DATABASE_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

const first = (env: Env, names: string[]) => {
  const name = names.find((n) => env[n]);
  return name ? { name, value: env[name] as string } : null;
};

const PROJECT_URL = /^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/;

/** The `role` claim of a Supabase key in the JWT format (anon or service_role); null for the newer opaque keys. */
export function keyRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

function finding(id: string, level: Level, message: string): Finding {
  return { id, level, message };
}

/** What can be told from the variables alone: present, well formed, not mixed up, and not leaked to the browser. */
export function checkStaticConfig(env: Env = process.env): Finding[] {
  const out: Finding[] = [];

  const serverUrl = first(env, URL_VARS);
  const clientUrl = first(env, CLIENT_URL_VARS);
  const clientKey = first(env, CLIENT_KEY_VARS);
  const serviceKey = first(env, SERVICE_KEY_VARS);

  // --- login
  if (!serverUrl) out.push(finding('login-url', 'error', `Falta a URL do projeto Supabase (${URL_VARS.join(' ou ')}): sem ela o login e a API ficam fora.`));
  else if (!PROJECT_URL.test(serverUrl.value)) out.push(finding('login-url', 'warn', `${serverUrl.name} não tem o formato https://<projeto>.supabase.co.`));
  else out.push(finding('login-url', 'ok', `URL do projeto em ${serverUrl.name}.`));

  if (!clientKey) out.push(finding('login-key', 'error', `Falta a chave pública (${CLIENT_KEY_VARS.join(' ou ')}): sem ela ninguém consegue entrar.`));
  else {
    const role = keyRole(clientKey.value);
    if (role === 'service_role') {
      out.push(finding('login-key', 'error', `${clientKey.name} é a chave de SERVIÇO (secreta): ela iria para o navegador. Use a chave pública (anon).`));
    } else out.push(finding('login-key', 'ok', `Chave pública em ${clientKey.name}.`));
  }

  if (!clientUrl || !clientKey) {
    out.push(
      finding(
        'login-client',
        serverUrl ? 'error' : 'warn',
        `O navegador não recebe o login: faltam ${[!clientUrl && CLIENT_URL_VARS[0], !clientKey && CLIENT_KEY_VARS[0]].filter(Boolean).join(' e ')} na hora do build (o app abriria sem tela de login).`
      )
    );
  } else out.push(finding('login-client', 'ok', 'O build leva o login ao navegador.'));

  if (serverUrl && clientUrl && hostOf(serverUrl.value) !== hostOf(clientUrl.value)) {
    out.push(finding('login-project-match', 'error', `${serverUrl.name} e ${clientUrl.name} apontam para projetos diferentes.`));
  }

  // --- cache and quota
  if (!serviceKey) {
    out.push(finding('service-key', 'warn', `Falta a chave de serviço (${SERVICE_KEY_VARS.join(' ou ')}): o cache de vídeos e a cota diária ficam desligados.`));
  } else {
    if (keyRole(serviceKey.value) === 'anon') {
      out.push(finding('service-key', 'error', `${serviceKey.name} é a chave PÚBLICA (anon): o cache e a cota não conseguem gravar.`));
    } else out.push(finding('service-key', 'ok', `Chave de serviço em ${serviceKey.name}.`));

    if (clientKey && clientKey.value === serviceKey.value) {
      out.push(finding('service-key-differs', 'error', 'A chave pública e a de serviço são a mesma.'));
    }
    // A secret in a variable the build sends to the browser
    const exposed = Object.entries(env).find(
      ([name, value]) => /^(VITE_|DATABASE_VITE_)/.test(name) && value && value === serviceKey.value
    );
    if (exposed) out.push(finding('service-key-public', 'error', `A chave de serviço está também em ${exposed[0]}, que vai para o navegador.`));
  }

  // --- the rest
  if (!env.YOUTUBE_API_KEY) {
    out.push(finding('youtube-key', 'warn', 'Falta YOUTUBE_API_KEY: a busca do vídeo da faixa usa a busca web não oficial, mais frágil.'));
  } else out.push(finding('youtube-key', 'ok', 'Chave do YouTube presente.'));

  if (env.DAILY_NEW_TRACKS !== undefined) {
    const n = Number(env.DAILY_NEW_TRACKS);
    if (!Number.isInteger(n) || n < 1) out.push(finding('daily-limit', 'warn', 'DAILY_NEW_TRACKS deveria ser um número inteiro maior que 0; vale o padrão (30).'));
  }

  return out;
}

export interface Summary {
  ok: boolean;
  errors: number;
  warnings: number;
}

export function summarize(findings: Finding[]): Summary {
  const errors = findings.filter((f) => f.level === 'error').length;
  const warnings = findings.filter((f) => f.level === 'warn').length;
  return { ok: errors === 0, errors, warnings };
}

/** What the public health answer shows: which checks failed, never why in detail (no names, no values). */
export function publicReport(findings: Finding[]): { ok: boolean; problems: { id: string; level: Level }[] } {
  return {
    ok: summarize(findings).ok,
    problems: findings.filter((f) => f.level !== 'ok').map(({ id, level }) => ({ id, level }))
  };
}

// ------------------------------------------------------------------ deep: ask the services

/** The tables and functions the migrations create that the app depends on. */
const EXPECTED_PATHS = ['/favorites', '/playlists', '/playlist_tracks', '/video_choices', '/play_history', '/video_cache', '/usage_daily', '/rpc/consume_resolve', '/rpc/refund_resolve'];

/** The tables of the podcast migration (0004): the app works without them, so their absence is only a warning. */
const PODCAST_PATHS = ['/podcast_follows', '/podcast_progress'];

/**
 * What the services say: the public key is accepted, sign-up is closed (the app is by invitation), the e-mail
 * login is on, the service key works and the migrations were run. Nothing here writes or sends anything.
 */
export async function checkDeepConfig(env: Env = process.env, fetchImpl: typeof fetch = fetch): Promise<Finding[]> {
  const out: Finding[] = [];
  const url = first(env, URL_VARS)?.value.replace(/\/+$/, '');
  const publicKey = first(env, CLIENT_KEY_VARS)?.value;
  const serviceKey = first(env, SERVICE_KEY_VARS)?.value;
  const get = (path: string, key: string) =>
    fetchImpl(`${url}${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(6000) });

  if (!url || !publicKey) {
    return [finding('auth-settings', 'warn', 'Sem URL ou chave pública: não deu para consultar o Supabase.')];
  }

  try {
    const response = await get('/auth/v1/settings', publicKey);
    if (response.status === 401 || response.status === 403) {
      out.push(finding('auth-settings', 'error', 'O Supabase recusou a chave pública: ela é de outro projeto ou foi trocada.'));
    } else if (!response.ok) {
      out.push(finding('auth-settings', 'warn', `O Supabase respondeu HTTP ${response.status} às configurações de login.`));
    } else {
      out.push(finding('auth-settings', 'ok', 'O Supabase aceita a chave pública.'));
      const settings = (await response.json().catch(() => null)) as { disable_signup?: unknown; external?: { email?: unknown } } | null;
      if (settings?.disable_signup === false) {
        out.push(finding('signup-open', 'error', 'O cadastro aberto está LIGADO: qualquer pessoa pode criar conta. Desligue em Authentication > Sign In / Providers.'));
      } else if (settings?.disable_signup === true) out.push(finding('signup-open', 'ok', 'Cadastro aberto desligado (só por convite).'));
      if (settings?.external?.email === false) out.push(finding('email-login', 'error', 'O login por e-mail está desligado no Supabase.'));
    }
  } catch (err) {
    out.push(finding('auth-settings', 'warn', `Sem resposta do Supabase (${(err as Error)?.name ?? 'erro'}).`));
  }

  if (serviceKey) {
    try {
      const response = await get('/rest/v1/', serviceKey);
      if (response.status === 401 || response.status === 403) {
        out.push(finding('service-key-valid', 'error', 'O Supabase recusou a chave de serviço.'));
      } else if (response.ok) {
        out.push(finding('service-key-valid', 'ok', 'O Supabase aceita a chave de serviço.'));
        const spec = (await response.json().catch(() => null)) as { paths?: Record<string, unknown> } | null;
        if (spec?.paths) {
          const missing = EXPECTED_PATHS.filter((path) => !(path in (spec.paths as object)));
          out.push(
            missing.length > 0
              ? finding('migrations', 'error', `Faltam no banco: ${missing.join(', ')}. Rode as migrações de supabase/migrations/ no SQL Editor.`)
              : finding('migrations', 'ok', 'As tabelas e funções das migrações existem.')
          );
          const missingPodcasts = PODCAST_PATHS.filter((path) => !(path in (spec.paths as object)));
          if (missing.length === 0) {
            out.push(
              missingPodcasts.length > 0
                ? finding('migrations-podcasts', 'warn', `Faltam no banco: ${missingPodcasts.join(', ')}. Rode supabase/migrations/0004_podcasts.sql no SQL Editor; sem ela, seguir podcasts e a posição dos episódios não sincronizam entre aparelhos.`)
                : finding('migrations-podcasts', 'ok', 'As tabelas de podcast existem.')
            );
          }
        }
      } else out.push(finding('service-key-valid', 'warn', `O Supabase respondeu HTTP ${response.status} ao banco.`));
    } catch (err) {
      out.push(finding('service-key-valid', 'warn', `Sem resposta do banco (${(err as Error)?.name ?? 'erro'}).`));
    }
  }
  return out;
}

const DEEP_TTL_MS = 5 * 60_000;
let deepCache: { at: number; findings: Promise<Finding[]> } | null = null;

/** The deep check, remembered for a few minutes: the health route is public and must not turn into a way to hammer Supabase. */
export function cachedDeepConfig(now: () => number = Date.now, env: Env = process.env, fetchImpl: typeof fetch = fetch): Promise<Finding[]> {
  if (!deepCache || now() - deepCache.at > DEEP_TTL_MS) deepCache = { at: now(), findings: checkDeepConfig(env, fetchImpl) };
  return deepCache.findings;
}

export function resetDeepCache(): void {
  deepCache = null;
}

// ------------------------------------------------------------------ the startup report

const ICON: Record<Level, string> = { ok: '✅', warn: '⚠️', error: '❌' };

export function formatFinding(f: Finding): string {
  return `[Config] ${ICON[f.level]} ${f.id}: ${f.message}`;
}

let reported = false;

/** Lets a test run the startup report again. */
export function resetStartupReport(): void {
  reported = false;
}

/**
 * Writes the configuration check to the log, once per instance (a cold start on Vercel, or the server starting):
 * the static findings at once, the deep ones when the services answer. Only when it matters (production or Vercel),
 * so tests and local runs stay quiet; CONFIG_REPORT=1 forces it.
 *
 * On Vercel the deep check is not made here: it runs in the background of a request, the platform freezes the
 * instance between requests, and the answer came back as a spurious "no answer from Supabase" warning on cold
 * starts while every request worked. There the deep check is `/api/health?deep=1`, which the post-deploy workflow calls.
 */
export function reportStartupOnce(
  env: Env = process.env,
  log: (line: string) => void = (line) => console.log(line),
  fetchImpl: typeof fetch = fetch
): void {
  if (reported) return;
  if (!(env.VERCEL || env.NODE_ENV === 'production' || env.CONFIG_REPORT === '1')) return;
  reported = true;

  const statics = checkStaticConfig(env);
  for (const f of statics.filter((item) => item.level !== 'ok')) log(formatFinding(f));
  const summary = summarize(statics);
  log(`[Config] ${summary.ok ? '✅' : '❌'} configuração: ${summary.errors} erro(s), ${summary.warnings} aviso(s) nas variáveis`);

  if (env.VERCEL && env.CONFIG_REPORT !== '1') {
    log('[Config] ℹ️ serviços: conferidos por /api/health?deep=1 (o pós-deploy chama), não a cada partida da função');
    return;
  }

  void cachedDeepConfig(Date.now, env, fetchImpl)
    .then((deep) => {
      for (const f of deep.filter((item) => item.level !== 'ok')) log(formatFinding(f));
      const result = summarize(deep);
      log(`[Config] ${result.ok ? '✅' : '❌'} serviços: ${result.errors} erro(s), ${result.warnings} aviso(s) ao consultar o Supabase`);
    })
    .catch((err) => log(`[Config] ⚠️ não foi possível consultar os serviços: ${(err as Error)?.message ?? err}`));
}
