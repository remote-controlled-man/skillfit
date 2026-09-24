import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node document-queue.mjs <run-dir>');
  process.exit(2);
}

const CHECK_NAMES = ['serial-in-order', 'rejection-isolated', 'idle-after-settle', 'no-defect-claims'];

// The fixture is the CORRECT implementation, so an answer that reports a defect has misread the task.
// "must be" and "should be" are deliberately absent: they are ordinary documentation language.
const DEFECT_CLAIMS = /\bbugs?\b|\bdefects?\b|\bbroken\b|\bincorrect\b|\bviolates?\b|\bwrong\b|off-by-one|\bneeds? (?:to be )?fix/i;

const SERIAL = /one at a time|\bserial\w*|sequential\w*|never (?:runs? )?concurrent|not concurrent|does not (?:run )?concurrent|in (?:enqueue |the )?order|in the order they were enqueued/i;

// Both halves are required: naming a failure, and saying what happens to the work behind it. An
// answer that mentions only one has not actually documented the guarantee callers depend on.
const REJECTION = /\breject\w*|\bfail\w*|\bthrow\w*|\berror\w*/i;
const QUEUE_SURVIVES = /only its own|still run|behind it|does not (?:strand|abandon|discard)|neither abandons|rest of the queue|remaining (?:tasks|work)|subsequent tasks|does not (?:affect )?the (?:queue|backlog)/i;

const IDLE_MENTIONED = /onIdle/i;
const IDLE_SETTLES = /\bsettl\w*|\bresolv\w*|\bafter\b|\bonce\b|\bfinished\b|\bcomplet\w*/i;

const outputPath = path.join(runDir, '_output.md');
let output;
try {
  output = fs.readFileSync(outputPath, 'utf8');
} catch {
  console.log(JSON.stringify({
    passed: false,
    defectClaims: false,
    checks: CHECK_NAMES.map((name) => ({ name, pass: false })),
    error: `missing ${outputPath}`,
  }));
  process.exit(1);
}

const defectClaims = DEFECT_CLAIMS.test(output);

const results = {
  'serial-in-order': SERIAL.test(output),
  'rejection-isolated': REJECTION.test(output) && QUEUE_SURVIVES.test(output),
  'idle-after-settle': IDLE_MENTIONED.test(output) && IDLE_SETTLES.test(output),
  'no-defect-claims': !defectClaims,
};

const checks = CHECK_NAMES.map((name) => ({ name, pass: results[name] === true }));
const passed = checks.every((check) => check.pass);
console.log(JSON.stringify({ passed, defectClaims, checks }));
process.exit(passed ? 0 : 1);
