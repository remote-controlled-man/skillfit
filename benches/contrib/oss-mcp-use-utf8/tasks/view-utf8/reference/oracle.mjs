import { cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-view-utf8.mjs <run-dir>');
  process.exit(2);
}
const here = dirname(fileURLToPath(import.meta.url));
cpSync(join(here, 'solutions', 'view-utf8'), runDir, { recursive: true });
