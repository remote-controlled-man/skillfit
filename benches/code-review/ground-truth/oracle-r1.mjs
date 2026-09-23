import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-r1.mjs <run-dir>');
  process.exit(2);
}

fs.writeFileSync(
  path.join(runDir, '_output.md'),
  [
    '# Review findings',
    '',
    '- src/order.js:25 throws a bare `Error` for invalid quantity; SPEC §1/§5 require an `AppError` with code `INVALID_QUANTITY`.',
    '- src/order.js:30 `item.qty > 10` is an off-by-one boundary error; SPEC §4 grants the 5% discount at quantity >= 10.',
    '- `applyBulkDiscount` is a new exported function but the diff adds no test coverage — SPEC §2 violation.',
    '',
  ].join('\n'),
  'utf8',
);
