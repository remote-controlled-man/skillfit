import { cpSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
export function applyOracle(id, root, testBody) {
  const source = id === 'fetch-lifecycle' ? 'src/index.ts' : 'index.js';
  cpSync(join(here, id, source), join(root, source));
  writeFileSync(join(root, 'regression.test.mjs'), `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { loadCache } from './runtime.mjs';\nimport { dirname } from 'node:path';\nimport { fileURLToPath } from 'node:url';\nconst { Cache, cleanup } = await loadCache(dirname(fileURLToPath(import.meta.url)), ${id === 'fetch-lifecycle'});\ntest('historical failure regression', async () => {\n${testBody}\n});\n`);
}
