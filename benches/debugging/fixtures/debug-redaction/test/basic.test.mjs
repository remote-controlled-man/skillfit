import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFailure } from '../src/debug-redaction.mjs';

test('formats a non-debug failure with sensitive headers redacted', () => {
  const report = JSON.parse(formatFailure({
    message: 'delivery failed',
    requestId: 'req-visible',
    headers: {
      authorization: 'Bearer customer-value',
      Cookie: 'session=customer-value',
      'x-trace-id': 'trace-visible',
    },
  }));

  assert.deepEqual(report, {
    level: 'error',
    message: 'delivery failed',
    requestId: 'req-visible',
    headers: {
      authorization: '[REDACTED]',
      Cookie: '[REDACTED]',
      'x-trace-id': 'trace-visible',
    },
  });
});
