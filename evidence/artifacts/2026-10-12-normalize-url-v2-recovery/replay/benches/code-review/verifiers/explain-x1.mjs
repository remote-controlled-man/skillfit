import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node explain-x1.mjs <run-dir>');
  process.exit(2);
}

const rubric = [
  { id: 'states-purpose', evidence: /compact|remove|omit|strip/i },
  { id: 'mentions-tests', evidence: /\btest/i },
];

const outputPath = path.join(runDir, '_output.md');
let output;
try {
  output = fs.readFileSync(outputPath, 'utf8');
} catch {
  const checks = rubric.map((item) => ({ name: item.id, pass: false }));
  console.log(JSON.stringify({ passed: false, hits: [], missed: ['*'], checks, error: `missing ${outputPath}` }));
  process.exit(1);
}

const hits = rubric.filter((item) => item.evidence.test(output)).map((item) => item.id);
const missed = rubric.filter((item) => !hits.includes(item.id)).map((item) => item.id);
const checks = rubric.map((item) => ({ name: item.id, pass: hits.includes(item.id) }));
const passed = missed.length === 0;
console.log(JSON.stringify({ passed, hits, missed, checks }));
process.exit(passed ? 0 : 1);
