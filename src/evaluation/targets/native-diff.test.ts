import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { assertNativeDiffWorkspace, installNativeDiffTool, NATIVE_DIFF_PATH } from "./native-diff.js";

function setup(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-native-diff-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  installNativeDiffTool(root); return root;
}
function capture(binary: string, args: string[], cwd: string) {
  const r = spawnSync(binary, args, { cwd, encoding: 'utf8', timeout: 10000 });
  if (r.error) throw r.error;
  assert.equal(r.signal, null); return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('workspace diff helper preserves native patches, empty results and error exits', t => {
  const root = setup(t);
  for (const [file, content] of [['new test.mjs', 'export const answer = 42;\n'], ['-option.txt', 'hello\n'], ['empty.txt', '']]) writeFileSync(join(root, file!), content!);
  for (const file of ['new test.mjs', '-option.txt', 'empty.txt', 'missing.txt']) {
    const expected = capture('git', ['diff', '--no-ext-diff', '--no-index', '--', '/dev/null', file], root);
    const actual = capture(process.execPath, [join(root, NATIVE_DIFF_PATH), file], root);
    assert.deepEqual(actual, expected);
    if (file === 'new test.mjs') { assert.equal(actual.status, 1); assert.match(actual.stdout, /\+export const answer/); }
  }
  assertNativeDiffWorkspace(root);
});

test('workspace helper rejects escaping paths and requires one file', t => {
  const root = setup(t);
  const outside = join(root, '../outside.txt');
  const escaped = capture(process.execPath, [join(root, NATIVE_DIFF_PATH), outside], root);
  assert.equal(escaped.status, 2); assert.match(escaped.stderr, /inside the task workspace/);
  assert.equal(capture(process.execPath, [join(root, NATIVE_DIFF_PATH)], root).status, 2);
});

test('reserved tool directory and mutated helper fail closed', t => {
  const root = setup(t);
  assert.throws(() => installNativeDiffTool(root), /already exists/);
  writeFileSync(join(root, NATIVE_DIFF_PATH), 'changed');
  assert.throws(() => assertNativeDiffWorkspace(root), /changed/);
  const other = join(root, 'other'); mkdirSync(other);
  assert.throws(() => assertNativeDiffWorkspace(other), /directory changed/);
  assert.equal(readFileSync(join(root, NATIVE_DIFF_PATH), 'utf8'), 'changed');
});
