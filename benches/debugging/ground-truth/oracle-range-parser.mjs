import { cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-range-parser.mjs <run-dir>');
  process.exit(2);
}

// Copies both the fixed parser and the grown test suite: this task's regression checks read
// test/*.mjs, so the reference solution has to supply them.
const here = dirname(fileURLToPath(import.meta.url));
cpSync(join(here, 'solutions', 'range-parser'), runDir, { recursive: true });
