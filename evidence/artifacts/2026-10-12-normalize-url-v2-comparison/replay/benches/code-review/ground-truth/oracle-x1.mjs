import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-x1.mjs <run-dir>');
  process.exit(2);
}

fs.writeFileSync(
  path.join(runDir, '_output.md'),
  [
    '`compact` removes (omits/strips) empty values from an object and returns the cleaned copy.',
    'Its behavior is pinned by the suite in `tests/compact.test.js`, which documents the edge cases.',
    '',
  ].join('\n'),
  'utf8',
);
