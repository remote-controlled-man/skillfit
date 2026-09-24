import { cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-ttl-cache.mjs <run-dir>');
  process.exit(2);
}

// The reference solution lives beside this script as real files rather than an embedded string, so
// the regexes and template literals it contains need no escaping.
const here = dirname(fileURLToPath(import.meta.url));
cpSync(join(here, 'solutions', 'ttl-cache'), runDir, { recursive: true });
