import { cpSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-debug-redaction.mjs <run-dir>');
  process.exit(2);
}

// Copies the leak-free implementation and the regression test. Neither contains the fixture's
// sentinel string — the secrecy checks scan every non-harness file in the run directory for it, so
// the reference solution has to be clean too, not merely correct.
const here = dirname(fileURLToPath(import.meta.url));
cpSync(join(here, 'solutions', 'debug-redaction'), runDir, { recursive: true });

// The regression section also grades the final message, so a complete reference run records the
// red/green intent the way the task asks.
writeFileSync(
  join(runDir, '_output.md'),
  [
    'Removed the credential-bearing structure from the debug branch of formatFailure().',
    '',
    'RED: node --test test/debug-leak.regression.test.mjs must fail against the original implementation',
    'GREEN: node --test must pass after the fix',
    '',
  ].join('\n'),
  'utf8',
);
