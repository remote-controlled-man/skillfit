import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-r2.mjs <run-dir>');
  process.exit(2);
}

fs.writeFileSync(
  path.join(runDir, '_output.md'),
  [
    '# Review findings',
    '',
    '- src/invoice.js:20 raises `QTY_NEGATIVE`, which is not in the SPEC §1 stable-code table.',
    '- src/invoice.js:22 rounds the unit price before multiplying by quantity — intermediate rounding against SPEC §3.',
    '- src/invoice.js:33 assigns `line.qty = …`, mutating its input against the SPEC §2 purity rule.',
    '',
  ].join('\n'),
  'utf8',
);
