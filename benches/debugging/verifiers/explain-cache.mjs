import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node explain-cache.mjs <run-dir>');
  process.exit(2);
}

const CHECK_NAMES = ['fixed-deadline', 'lazy-deletion', 'ttl-contract', 'no-defect-claims'];

// The fixture is the CORRECT implementation, so an answer that reports a defect has misread the task.
// Note what is deliberately absent from this list: "must be" and "should be". Those are ordinary spec
// language ("ttlMs must be finite") and matching them would fail correct answers.
const DEFECT_CLAIMS = /\bbugs?\b|\bdefects?\b|\bbroken\b|\bincorrect\b|\bviolates?\b|\bwrong\b|off-by-one|\bneeds? (?:to be )?fix/i;

// A deadline fixed at write time, stated from either direction: "fixed when set" or "reads do not
// extend it". Requiring both phrasings would grade vocabulary rather than understanding.
const FIXED_DEADLINE = [
  /(?:fixed|constant|set once|immutable)[^.\n]{0,80}(?:set|write|deadline|ttl)/i,
  /(?:set|write)[^.\n]{0,80}(?:fixed|never (?:moves|changes|extends)|does not (?:move|change|extend))/i,
  /(?:read|reading|get\(\)|get)[^.\n]{0,80}(?:never|does not|doesn't|do not)[^.\n]{0,40}(?:extend|renew|push|move|reset|refresh|slide)/i,
];

const LAZY_WORDS = /\blazy\b|on demand|no background|nothing runs in the background/i;
const REMOVAL_WORDS = /\bdelet\w*|\bremov\w*|\bevict\w*|\bpurg\w*|\bdrop(?:s|ped)?\b/i;

const TTL_CONTRACT = [
  /ttl[^.\n]{0,60}(?:finite|non-negative|not negative)/i,
  /(?:finite|non-negative)[^.\n]{0,80}ttl/i,
  /TypeError/i,
];

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

const anyMatch = (patterns) => patterns.some((re) => re.test(output));
const defectClaims = DEFECT_CLAIMS.test(output);

const results = {
  'fixed-deadline': anyMatch(FIXED_DEADLINE),
  // Two halves of one property: expiry is not backgrounded, and the observing read cleans up.
  'lazy-deletion': LAZY_WORDS.test(output) && REMOVAL_WORDS.test(output),
  'ttl-contract': anyMatch(TTL_CONTRACT),
  'no-defect-claims': !defectClaims,
};

const checks = CHECK_NAMES.map((name) => ({ name, pass: results[name] === true }));
const passed = checks.every((check) => check.pass);
console.log(JSON.stringify({ passed, defectClaims, checks }));
process.exit(passed ? 0 : 1);
