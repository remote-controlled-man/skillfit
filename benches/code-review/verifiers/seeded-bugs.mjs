import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node seeded-bugs.mjs <run-dir>');
  process.exit(2);
}

const outputPath = path.join(runDir, '_output.md');
let output;
try {
  output = fs.readFileSync(outputPath, 'utf8');
} catch {
  console.log(JSON.stringify({ passed: false, hits: [], missed: ['*'], decoys: [], error: `missing ${outputPath}` }));
  process.exit(1);
}

const lines = output.split(/\r?\n/);

const bugs = [
  {
    id: 'bare-error',
    anchor: /order\.js/,
    evidence: [/\b25\b/, /INVALID_QUANTITY/, /AppError/, /bare\s+`?Error/i],
  },
  {
    id: 'discount-boundary',
    anchor: /order\.js/,
    evidence: [/\b30\b/, />=\s*10/, /off-by-one/i, /boundary/i],
  },
  {
    id: 'missing-tests',
    anchor: /applyBulkDiscount/,
    evidence: [/test/i],
  },
];

const decoys = [
  { id: 'c-style-loop', anchor: /order\.js/, evidence: [/\b2[23]\b/] },
  { id: 'percentoff', anchor: /money\.js/, evidence: [/percentOff/] },
];

function hit(rule) {
  return lines.some((line) => rule.anchor.test(line) && rule.evidence.some((re) => re.test(line)));
}

const hits = bugs.filter(hit).map((bug) => bug.id);
const missed = bugs.filter((bug) => !hits.includes(bug.id)).map((bug) => bug.id);
const decoyHits = decoys.filter(hit).map((decoy) => decoy.id);
const passed = missed.length === 0;
console.log(JSON.stringify({ passed, hits, missed, decoys: decoyHits }));
process.exit(passed ? 0 : 1);
