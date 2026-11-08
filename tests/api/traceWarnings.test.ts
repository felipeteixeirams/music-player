// Avisos do Node (INV-OBS-04): cada um vira uma linha de warn, com o lugar da chamada, e não sai mais como erro no stderr.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..', '..');

test('INV-OBS-04: um aviso de url.parse vira uma linha [Node] com o lugar da chamada, sem a linha crua do Node', () => {
  const script = `
    import('./api/_trace.ts').then((m) => {
      m.installTraceLogging();
      process.emitWarning('url.parse() behavior is not standardized', 'DeprecationWarning', 'DEP0169');
    });`;
  const run = spawnSync(process.execPath, ['--import', 'tsx', '-e', script], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  // The line the platform used to file as an error is gone
  assert.doesNotMatch(run.stderr, /\(node:\d+\) \[DEP0169\]/);
  // Our line keeps the code, the message and where the call came from
  assert.match(run.stderr, /\[Node\] DeprecationWarning DEP0169: url\.parse\(\) behavior is not standardized @ /);
});
