import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-r3.mjs <run-dir>');
  process.exit(2);
}

fs.writeFileSync(
  path.join(runDir, '_output.md'),
  [
    '# Review findings',
    '',
    '- src/pricing.js drops the `EMPTY_ORDER` guard and deletes its covering test — the empty order case is unhandled (SPEC §4).',
    '- src/pricing.js:14 applies the bulk discount on top of the promotional price; SPEC §3 says promotional prices are never themselves discounted.',
    '',
  ].join('\n'),
  'utf8',
);
