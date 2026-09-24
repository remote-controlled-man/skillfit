import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFailure } from '../src/debug-redaction.mjs';

function sensitiveKeyPaths(value, prefix = '') {
  if (value === null || typeof value !== 'object') return [];
  const paths = [];
  for (const [key, nested] of Object.entries(value)) {
    const current = prefix ? `${prefix}.${key}` : key;
    if (/(?:auth(?:entication|orization)?|credential|password|secret|token|api[-_]?key)/i.test(key)) paths.push(current);
    paths.push(...sensitiveKeyPaths(nested, current));
  }
  return paths;
}

test('debug report keeps safe metadata but carries no credential material', () => {
  const report = JSON.parse(formatFailure({
    message: 'webhook delivery failed',
    requestId: 'req-regression',
    headers: { authorization: 'Bearer customer-value' },
    debug: true,
  }));

  assert.equal(report.debug.transport, 'webhook');
  assert.equal(report.debug.attempt, 1);
  assert.deepEqual(sensitiveKeyPaths(report.debug), []);
});
