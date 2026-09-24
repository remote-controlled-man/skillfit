import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node review-r3.mjs <run-dir>');
  process.exit(2);
}

const bugs = [
  {
    id: 'dropped-empty-guard',
    anchor: /pricing(\.test)?\.js/,
    evidence: [/EMPTY_ORDER/, /empty (order|array|input)/i, /§4/],
  },
  {
    id: 'promo-bulk-stack',
    anchor: /pricing\.js/,
    evidence: [/never (itself |further )?discount/i, /on top of|also applies|combin|stack|both/i, /§3/, /\b1[34]\b/],
  },
];

const decoys = [
  { id: 'formatOrder', anchor: /pricing\.js/, evidence: [/formatOrder/] },
];

const outputPath = path.join(runDir, '_output.md');
let output;
try {
  output = fs.readFileSync(outputPath, 'utf8');
} catch {
  // `no-false-positives` is false here as well: an empty review is not a precise one, and crediting
  // silence with "no false positives" would hand a third of the facet score to an agent that
  // reviewed nothing.
  const checks = [
    ...bugs.map((bug) => ({ name: bug.id, pass: false })),
    { name: 'no-false-positives', pass: false },
  ];
  console.log(JSON.stringify({ passed: false, hits: [], missed: ['*'], decoys: [], checks, error: `missing ${outputPath}` }));
  process.exit(1);
}

const lines = output.split(/\r?\n/);

function hit(rule) {
  return lines.some((line) => rule.anchor.test(line) && rule.evidence.some((re) => re.test(line)));
}

const hits = bugs.filter(hit).map((bug) => bug.id);
const missed = bugs.filter((bug) => !hits.includes(bug.id)).map((bug) => bug.id);
const decoyHits = decoys.filter(hit).map((decoy) => decoy.id);
// Decoys are plausible-but-correct code. Until this check existed they were counted and printed but
// never scored, so a review that simply reported more beat one that reported less and was right.
const checks = [
  ...bugs.map((bug) => ({ name: bug.id, pass: hits.includes(bug.id) })),
  { name: 'no-false-positives', pass: decoyHits.length === 0 },
];
const passed = missed.length === 0 && decoyHits.length === 0;
console.log(JSON.stringify({ passed, hits, missed, decoys: decoyHits, checks }));
process.exit(passed ? 0 : 1);
