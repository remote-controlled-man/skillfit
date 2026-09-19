import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node explain-x1.mjs <run-dir>');
  process.exit(2);
}

const outputPath = path.join(runDir, '_output.md');
let output;
try {
  output = fs.readFileSync(outputPath, 'utf8');
} catch {
  console.log(JSON.stringify({ passed: false, hits: [], missed: ['*'], error: `missing ${outputPath}` }));
  process.exit(1);
}

const checks = [
  { id: 'states-purpose', evidence: /compact|remove|omit|strip/i },
  { id: 'mentions-tests', evidence: /\btest/i },
];

const hits = checks.filter((check) => check.evidence.test(output)).map((check) => check.id);
const missed = checks.filter((check) => !hits.includes(check.id)).map((check) => check.id);
const passed = missed.length === 0;
console.log(JSON.stringify({ passed, hits, missed }));
process.exit(passed ? 0 : 1);
