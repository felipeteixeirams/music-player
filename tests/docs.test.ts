import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import test from 'node:test';

/** The documentation base (docs/README.md -> masters -> satellites) and the rules that keep it true: see AGENTS.md. */

function files(dir: string, match: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(path).isDirectory() ? files(path, match) : match.test(name) ? [path] : [];
  });
}

const read = (path: string) => readFileSync(path, 'utf8');
const masters = files('docs/masters', /\.md$/);
const specs = files('docs/specs/current', /\.md$/);
const markdown = ['AGENTS.md', 'docs/README.md', ...masters, ...specs];
const testFiles = [...files('tests', /\.ts$/), ...files('src', /\.test\.ts$/)].filter((file) => file !== join('tests', 'docs.test.ts'));

// ------------------------------------------------------------------ invariants and their tests

const INVARIANT_DEFINITION = /\*\*(INV-[A-Z]+-\d+):\*\*/g;
const INVARIANT_ID = /INV-[A-Z]+-\d+/g;

test('todo invariante dos masters tem pelo menos um teste que o cita pelo id', () => {
  const defined = masters.flatMap((file) => [...read(file).matchAll(INVARIANT_DEFINITION)].map((m) => m[1]));
  assert.ok(defined.length > 0, 'os masters deveriam listar invariantes');
  assert.equal(new Set(defined).size, defined.length, 'cada id aparece uma vez só');

  const testText = testFiles.map(read).join('\n');
  const uncovered = defined.filter((id) => !testText.includes(id));
  assert.deepEqual(uncovered, [], `Sem teste citando o id: ${uncovered.join(', ')} (ponha o id no título de um teste que o garanta)`);
});

test('todo id de invariante citado num teste existe num master', () => {
  const defined = new Set(masters.flatMap((file) => [...read(file).matchAll(INVARIANT_DEFINITION)].map((m) => m[1])));
  const cited = new Set(testFiles.flatMap((file) => read(file).match(INVARIANT_ID) ?? []));
  const orphans = [...cited].filter((id) => !defined.has(id));
  assert.deepEqual(orphans, [], `Testes citam invariantes que nenhum master define: ${orphans.join(', ')}`);
});

// ------------------------------------------------------------------ links and navigation

test('todo link relativo da documentação aponta para um arquivo que existe', () => {
  const broken: string[] = [];
  for (const file of markdown) {
    for (const match of read(file).matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = match[1];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const path = normalize(join(dirname(file), target.split('#')[0]));
      if (!existsSync(path)) broken.push(`${file} -> ${target}`);
    }
  }
  assert.deepEqual(broken, [], `Links quebrados:\n${broken.join('\n')}`);
});

test('navegação root -> master -> satélite: todo master é ligado pelo root e todo satélite por um master', () => {
  const root = read('docs/README.md');
  const unlinkedMasters = masters.filter((file) => !root.includes(`masters/${file.split('/').pop()}`));
  assert.deepEqual(unlinkedMasters, [], `Masters fora do root: ${unlinkedMasters.join(', ')}`);

  const masterText = masters.map(read).join('\n');
  const orphanSpecs = specs.filter((file) => !masterText.includes(file.split('/').pop() as string));
  assert.deepEqual(orphanSpecs, [], `Satélites que nenhum master liga: ${orphanSpecs.join(', ')}`);
});

// ------------------------------------------------------------------ facts in the documentation that must stay true

test('o número de funções da Vercel dito no AGENTS.md é o real', () => {
  const real = readdirSync('api').filter((name) => name.endsWith('.ts') && !name.startsWith('_')).length;
  const said = /hoje (\d+):/.exec(read('AGENTS.md').split('## Funções da Vercel')[1] ?? '');
  assert.ok(said, 'o AGENTS.md deveria dizer quantas funções existem ("hoje N: ...")');
  assert.equal(Number(said[1]), real, `AGENTS.md diz ${said[1]} funções e api/ tem ${real}`);
});

test('a matriz de compatibilidade só cita itens do roteiro e testes que existem', () => {
  const matrix = read('docs/specs/current/compatibility-matrix.spec.md');
  const checklist = read('docs/specs/current/validation-checklist.spec.md');
  const missingItems = [...new Set(matrix.match(/\bT\d{2}\b/g) ?? [])].filter((id) => !checklist.includes(`### ${id}`));
  assert.deepEqual(missingItems, [], `Itens do roteiro que não existem: ${missingItems.join(', ')}`);

  const missingTests = [...new Set([...matrix.matchAll(/`(tests\/[\w./-]+\.ts)`/g)].map((m) => m[1]))].filter((path) => !existsSync(path));
  assert.deepEqual(missingTests, [], `Testes citados que não existem: ${missingTests.join(', ')}`);
});

test('o modelo de PR existe e pergunta pela matriz e pelo teste em aparelho', () => {
  const template = read('.github/pull_request_template.md');
  assert.match(template, /matriz de compatibilidade/i);
  assert.match(template, /iPhone/);
});
