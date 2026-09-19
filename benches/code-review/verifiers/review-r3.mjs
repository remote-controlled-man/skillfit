import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node review-r3.mjs <run-dir>');
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

function hit(rule) {
  return lines.some((line) => rule.anchor.test(line) && rule.evidence.some((re) => re.test(line)));
}

const hits = bugs.filter(hit).map((bug) => bug.id);
const missed = bugs.filter((bug) => !hits.includes(bug.id)).map((bug) => bug.id);
const decoyHits = decoys.filter(hit).map((decoy) => decoy.id);
const passed = missed.length === 0;
console.log(JSON.stringify({ passed, hits, missed, decoys: decoyHits }));
process.exit(passed ? 0 : 1);
