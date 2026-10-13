// Read-only accounting across retained recovery stages. No agent/model/API call.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
assert.ok(process.argv[2], 'Pass the artifact parent directory containing all recovery packages.');
const root = resolve(process.argv[2]);
function archived(folder, archive, member) {
  const tar = gunzipSync(readFileSync(join(root, folder, archive)), { maxOutputLength: 32 * 1024 * 1024 });
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const field = (start, end) => header.subarray(start, end).toString('utf8').replace(/\0.*$/s, '');
    const name = [field(345, 500), field(0, 100)].filter(Boolean).join('/');
    const size = Number.parseInt(field(124, 136).trim(), 8);
    assert.ok(Number.isSafeInteger(size) && size >= 0 && offset + 512 + size <= tar.length, 'Invalid tar member bounds.');
    if (name === member) return JSON.parse(tar.subarray(offset + 512, offset + 512 + size).toString('utf8'));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error('Missing retained receipt: ' + member);
}
const rows = [];
const add = (purpose, r, quality = false) => {
  assert.equal(r.executorInvoked, true);
  rows.push({ purpose, executorInvoked: true, tokens: r.tokens ?? null, usageStatus: r.usageStatus,
    durationSeconds: r.durationSeconds, error: r.error ?? null, gradedComparison: quality,
    passed: quality ? r.passed : null });
};
add('stopped timing batch, trust alias false stop', archived('2026-10-12-normalize-url-v2-recovery', 'records.tar.gz', 'normalize-url-v2-recovery-20261012/query-shape/baseline/trial-1/_result.json'));
add('stopped canonical batch, provider connection timeout', archived('2026-10-12-normalize-url-v2-comparison', 'records.tar.gz', 'normalize-url-v2-comparison-20261012/query-shape/baseline/trial-1/_result.json'));
add('readiness local Git preflight rejection', JSON.parse(readFileSync(join(root, '2026-10-12-normalize-url-v2-available/receipt.json'), 'utf8')));
const group = 'normalize-url-v2-validated-20261012';
add('successful readiness, outside benchmark populations', archived('2026-10-12-normalize-url-v2-validated', 'records.tar.gz', group + '/_availability/receipt.json'));
for (const arm of ['baseline', 'treatment']) for (const trial of [1, 2]) {
  add(`completed paired comparison ${arm} trial ${trial}`, archived('2026-10-12-normalize-url-v2-validated', 'records.tar.gz', `${group}/query-shape/${arm}/trial-${trial}/_result.json`), true);
}
function summarize(records) {
  const metrics = {};
  for (const metric of ['input', 'cachedInput', 'uncachedInput', 'output']) {
    let knownTotal = 0, unknownReceipts = 0;
    for (const r of records) {
      const t = r.tokens ?? {};
      const value = metric === 'uncachedInput' ? (typeof t.input === 'number' && typeof t.cachedInput === 'number' ? t.input - t.cachedInput : null) : t[metric];
      if (value == null) unknownReceipts++;
      else knownTotal += value;
    }
    metrics[metric] = { knownTotal, unknownReceipts, isLowerBound: unknownReceipts > 0 };
  }
  return { invocations: records.length, metrics, observedMonotonicSeconds: Math.round(records.reduce((sum, r) => sum + r.durationSeconds, 0) * 1000) / 1000 };
}
console.log(JSON.stringify({ schemaVersion: 1,
  scope: 'This user-request recovery turn only; excludes earlier studies, orchestration/research/offline checks, cooldown/Git preparation. CLI invocation is not provider request acceptance or billing. No cross-cohort quality/cost-effect pooling.',
  all: summarize(rows), additionalOutsideComparison: summarize(rows.filter(r => !r.gradedComparison)),
  comparison: summarize(rows.filter(r => r.gradedComparison)), records: rows }, null, 2));
