import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node review-r2.mjs <run-dir>');
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
    id: 'unregistered-error-code',
    anchor: /invoice\.js/,
    evidence: [/QTY_NEGATIVE/, /INVALID_QUANTITY/, /stable.?code|code table|not in the (table|spec)/i, /\b20\b/],
  },
  {
    id: 'intermediate-rounding',
    anchor: /invoice\.js/,
    evidence: [/\b22\b/, /double.?round|rounds? (the )?(unit|intermediate|per[- ]line)|before (the )?(qty|quantity|multipl)/i, /§3/],
  },
  {
    id: 'input-mutation',
    anchor: /invoice\.js/,
    evidence: [/\b33\b/, /line\.qty\s*=/, /§2/, /purity|mutat/i],
  },
];

const decoys = [
  { id: 'sorts-new-array', anchor: /invoice\.js/, evidence: [/\.sort\(/, /\b25\b/] },
  { id: 'formatCents', anchor: /money\.js/, evidence: [/formatCents/] },
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
