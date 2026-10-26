// After a deploy: asks the live app whether its configuration works (GET /api/health?deep=1) and fails when it does not.
// Usage: node scripts/check-deploy.mjs https://the-app.vercel.app
// The health answer carries check ids only; docs/masters/accounts-and-data.md says what to do about each.

const DOC = 'docs/masters/accounts-and-data.md (seção "Verificação da configuração")';

/**
 * @param {any} health the /api/health?deep=1 answer
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function evaluate(health) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  const take = (source, report) => {
    if (!report) return;
    for (const { id, level } of report.problems ?? []) (level === 'error' ? errors : warnings).push(`${source}:${id}`);
  };
  if (health?.status !== 'ok') errors.push('health:status');
  take('variáveis', health?.config);
  take('serviços', health?.services);
  if (health && !health.services) warnings.push('serviços:não consultados');
  // Each Supabase call from a function in another continent costs well over 100 ms, and playback waits on them
  if (health?.region && health.region !== 'gru1') warnings.push(`região das funções: ${health.region} (esperado gru1, perto do banco)`);
  return { errors, warnings };
}

/** Where the functions ran, from the `x-vercel-id` header ("gru1::gru1::..."): they must sit next to the database (São Paulo). */
export function functionRegion(vercelId) {
  const match = /^([a-z]{3}\d)::(?:([a-z]{3}\d)::)?/.exec(vercelId ?? '');
  return match ? (match[2] ?? match[1]) : null;
}

async function fetchHealth(base, attempts = 6, waitMs = 10_000) {
  let last = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(`${base.replace(/\/+$/, '')}/api/health?deep=1`, { signal: AbortSignal.timeout(20_000) });
      if (response.ok) return { ...(await response.json()), region: functionRegion(response.headers.get('x-vercel-id')) };
      last = new Error(`HTTP ${response.status}`);
    } catch (err) {
      last = err;
    }
    // A deploy that was just published may take a moment to answer
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  throw last;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = process.argv[2];
  if (!base) {
    console.error('Uso: node scripts/check-deploy.mjs <endereço do app>');
    process.exit(2);
  }
  let health;
  try {
    health = await fetchHealth(base);
  } catch (err) {
    console.error(`::error title=Deploy::${base} não respondeu ao /api/health (${err?.message ?? err})`);
    process.exit(1);
  }
  const { errors, warnings } = evaluate(health);
  console.log(JSON.stringify({ login: health.login, cache: health.cache, config: health.config, services: health.services }, null, 2));
  for (const id of warnings) console.log(`::warning title=Configuração::${id}. Veja ${DOC}`);
  for (const id of errors) console.log(`::error title=Configuração::${id}. Veja ${DOC}`);
  process.exit(errors.length > 0 ? 1 : 0);
}
