// After a build: the secrets must not be in dist/ (they would reach every browser), and the public settings must.
// CI builds with made-up values (see .github/workflows/ci.yml): CANARY_SECRET_VARS and CANARY_PUBLIC_VARS name the
// variables, the values come from the environment.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|css|html|json|map|webmanifest)$/.test(name)) yield path;
  }
}

export function scan(dir, secretNames, publicNames, env = process.env) {
  const problems = [];
  const contents = [...files(dir)].map((path) => [path, readFileSync(path, 'utf8')]);
  for (const name of secretNames) {
    const value = env[name];
    if (!value) {
      problems.push(`${name}: sem valor de teste no ambiente; o teste não prova nada`);
      continue;
    }
    for (const [path, text] of contents) if (text.includes(value)) problems.push(`${name} VAZOU para ${path}`);
  }
  for (const name of publicNames) {
    const value = env[name];
    if (!value) problems.push(`${name}: sem valor de teste no ambiente`);
    else if (!contents.some(([, text]) => text.includes(value))) problems.push(`${name} NÃO chegou ao build (o login não apareceria no navegador)`);
  }
  return problems;
}

const split = (value) => (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = scan(process.argv[2] ?? 'dist', split(process.env.CANARY_SECRET_VARS), split(process.env.CANARY_PUBLIC_VARS));
  if (problems.length > 0) {
    for (const problem of problems) console.error(`::error title=Build::${problem}`);
    process.exit(1);
  }
  console.log('✅ Nenhum segredo no build, e as configurações públicas estão nele.');
}
