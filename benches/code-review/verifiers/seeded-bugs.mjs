import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node seeded-bugs.mjs <run-dir>');
  process.exit(2);
}

// Coverage findings may be written in English or Chinese; a topic word alone is not evidence.
const missingCoverage = [
  /\b(?:no|lacks?|lacking|missing|without|has no)\b[^.\n]{0,40}\b(?:tests?|coverage|covered)\b/i,
  /\b(?:should|needs?|must|requires?)\b[^.\n]{0,40}\b(?:tests?|coverage)\b/i,
  /\buntested\b/i,
  /\bnot covered\b/i,
  /(?:没有|缺少|缺乏|缺失|无|未(?:附带|添加|提供|包含|编写|覆盖))[^。！？，；\n]{0,40}(?:测试|覆盖|\btests?\b|\bcoverage\b)/i,
  /(?:需要|应当|应该|必须)[^。！？，；\n]{0,40}(?:测试|覆盖|\btests?\b|\bcoverage\b)/i,
  /(?:测试|覆盖率?)(?:缺失|不足)/,
];

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
    evidence: missingCoverage,
  },
];

const decoys = [
  { id: 'c-style-loop', anchor: /order\.js/, evidence: [/\b2[23]\b/] },
  // percentOff's calculation is correct, but its missing tests violate SPEC §2.
  {
    id: 'percentoff',
    anchor: /money\.js.*percentOff|percentOff.*money\.js/,
    evidence: [
      /\b(?:incorrectly|wrongly)\s+(?:calls?|uses?|rounds?|calculates?|computes?|returns?)\b/i,
      /\b(?:double[- ]rounds?|rounds?\s+(?:again|twice))\b/i,
      /\b(?:should(?: not)?|must(?: not)?|does not|doesn't|fails? to)\s+(?:round|(?:call|use)\s+`?roundCents)\b/i,
      /\b(?:returns?|uses?|calls?|rounds?|computes?|calculates?|is|has)\s+(?:(?:the|an?)\s+)?(?:wrong|incorrect|broken|buggy)\b/i,
      /(?:重复|多次|两次|错误地|不应(?:该)?)(?:调用|使用|舍入|计算)/,
      /(?:计算|舍入|百分比|公式)(?:错误|有误|有问题|不正确)/,
    ],
  },
];

const outputPath = path.join(runDir, '_output.md');
let output;
try {
  output = fs.readFileSync(outputPath, 'utf8');
} catch {
  // `no-false-positives` is false here as well: an empty review is not a precise one, and crediting
  // silence with "no false positives" would hand a quarter of the facet score to an agent that
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
