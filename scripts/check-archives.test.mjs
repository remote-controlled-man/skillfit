import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkArchiveSources } from './check-archives.mjs';

test('versioned archive catalog matches all retained originals and public support bytes offline', async () => {
  assert.deepEqual(await checkArchiveSources(), { archives: 19, supportFiles: 1583 });
});
