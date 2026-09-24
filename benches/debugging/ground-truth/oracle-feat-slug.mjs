import { cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-feat-slug.mjs <run-dir>');
  process.exit(2);
}

// The fixture ships only test/slug.test.mjs; the reference solution supplies the missing module.
const here = dirname(fileURLToPath(import.meta.url));
cpSync(join(here, 'solutions', 'feat-slug'), runDir, { recursive: true });
