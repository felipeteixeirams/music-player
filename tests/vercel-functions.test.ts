import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

/** The Hobby plan allows 12 Serverless Functions per deployment; going over fails the deploy. */
const HOBBY_FUNCTION_LIMIT = 12;

/** Every .ts file under api/ becomes a function, except those whose name starts with an underscore. */
function functionFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return functionFiles(join(dir, entry.name), `${prefix}${entry.name}/`);
    return entry.name.endsWith('.ts') && !entry.name.startsWith('_') ? [`${prefix}${entry.name}`] : [];
  });
}

test('api/ holds only endpoints: helpers start with an underscore and tests live in tests/', () => {
  const files = functionFiles('api');
  const misplaced = files.filter((file) => /\.(test|spec)\.ts$/.test(file));
  assert.deepEqual(misplaced, [], `Move to tests/ or prefix with "_": ${misplaced.join(', ')}`);
});

test('the number of serverless functions stays within the Hobby plan limit', () => {
  const files = functionFiles('api');
  assert.ok(
    files.length <= HOBBY_FUNCTION_LIMIT,
    `${files.length} functions (${files.join(', ')}) exceed the limit of ${HOBBY_FUNCTION_LIMIT}`
  );
});
