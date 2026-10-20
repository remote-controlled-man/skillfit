import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { executeTransaction } from './transaction.js';

test('failed rollback of a new target does not claim a nonexistent recovery copy', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillfit-transaction-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = path.join(root, 'new-file'), original = new Error('validation failed');
  const rm = fs.rm.bind(fs);
  t.mock.method(fs, 'rm', async (file: string, opts: Parameters<typeof fs.rm>[1]) => {
    if (file === target) throw new Error('remove denied');
    return rm(file, opts);
  });
  await assert.rejects(executeTransaction([{ path: target, content: 'new bytes', backup: 'none' }], async () => { throw original; }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.cause, original);
    assert.match(error.message, /validation failed/);
    assert.match(error.message, /remove denied/);
    assert.match(error.message, /no previous file to restore/);
    assert.doesNotMatch(error.message, /recovery copy retained/);
    return true;
  });
  assert.deepEqual(await fs.readdir(root), ['new-file']);
  assert.equal(await fs.readFile(target, 'utf8'), 'new bytes');
});
