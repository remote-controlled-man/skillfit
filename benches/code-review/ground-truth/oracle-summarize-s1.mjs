import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-summarize-s1.mjs <run-dir>');
  process.exit(2);
}

fs.writeFileSync(
  path.join(runDir, '_output.md'),
  [
    '## 1.4.0',
    '',
    '- Bulk pricing now starts at 10 items instead of 13, so smaller orders qualify for the 5% discount.',
    '- Bad quantities fail with a stable INVALID_QUANTITY code you can branch on, instead of a free-text message.',
    '- Prices are rounded once per line rather than partway through, which removes the penny drift on large orders.',
    '',
  ].join('\n'),
  'utf8',
);
