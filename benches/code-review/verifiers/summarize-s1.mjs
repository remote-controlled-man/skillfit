import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node summarize-s1.mjs <run-dir>');
  process.exit(2);
}

const CHECK_NAMES = ['three-bullets', 'names-user-visible-changes', 'not-a-review'];

// The three things the merged diff actually changed for a caller of the library.
const CHANGES = [
  {
    id: 'bulk-threshold',
    evidence: [
      /\b(?:10|ten)\b[^.\n]{0,60}(?:discount|bulk|item|order|qualif|threshold)/i,
      /(?:discount|bulk|threshold|qualif|pricing)[^.\n]{0,60}\b(?:10|ten)\b/i,
    ],
  },
  {
    id: 'stable-error-code',
    evidence: [/INVALID_QUANTITY/i, /stable[^.\n]{0,30}code/i, /error code/i, /branch on/i],
  },
  {
    id: 'single-rounding',
    evidence: [
      /round\w*[^.\n]{0,40}(?:once|final|per line|end|drift|penny)/i,
      /(?:once|drift|penny)[^.\n]{0,40}round/i,
    ],
  },
];

// Review framing. A changelog entry that starts citing the spec and reporting violations is the
// wrong artefact, which is what makes this task a behavioural negative control and not just a label.
const REVIEW_FRAMING = /SPEC\s*§|\bviolates?\b|\bbugs?\b|\bdefects?\b|off-by-one|\bshould be\b|\bneeds? (?:to be )?fix/i;

const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+\S/;

const outputPath = path.join(runDir, '_output.md');
let output;
try {
  output = fs.readFileSync(outputPath, 'utf8');
} catch {
  console.log(JSON.stringify({
    passed: false,
    changes: [],
    bullets: 0,
    reviewFraming: false,
    checks: CHECK_NAMES.map((name) => ({ name, pass: false })),
    error: `missing ${outputPath}`,
  }));
  process.exit(1);
}

const lines = output.split(/\r?\n/);
const bullets = lines.filter((line) => BULLET.test(line));
const matchedChanges = CHANGES.filter((change) => change.evidence.some((re) => re.test(output))).map(
  (change) => change.id,
);
const reviewFraming = REVIEW_FRAMING.test(output);

const results = {
  'three-bullets': bullets.length === 3,
  // Two of three: a changelog entry is allowed to fold two changes into one bullet or to phrase one
  // differently, but an entry that names none of them did not read the diff.
  'names-user-visible-changes': matchedChanges.length >= 2,
  'not-a-review': !reviewFraming,
};

const checks = CHECK_NAMES.map((name) => ({ name, pass: results[name] === true }));
const passed = checks.every((check) => check.pass);
console.log(JSON.stringify({
  passed,
  bullets: bullets.length,
  changes: matchedChanges,
  reviewFraming,
  checks,
}));
process.exit(passed ? 0 : 1);
