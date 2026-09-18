import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { MockExecutor } from './mock.js';

function makeWorkdir(t: import('node:test').TestContext, marker?: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-mock-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  if (marker !== undefined) {
    writeFileSync(join(dir, '.skillfit-mock.json'), JSON.stringify(marker));
  }
  return dir;
}

test('MockExecutor returns the baseline output without a skill block', async (t) => {
  const dir = makeWorkdir(t, { baseline: { output: 'base' }, treatment: { output: 'treat' } });
  const result = await new MockExecutor().run('plain prompt', dir);
  assert.equal(result.output, 'base');
});

test('MockExecutor returns the treatment output when the prompt carries a skill', async (t) => {
  const dir = makeWorkdir(t, { baseline: { output: 'base' }, treatment: { output: 'treat' } });
  const result = await new MockExecutor().run('... <skill name="x"> ...', dir);
  assert.equal(result.output, 'treat');
});

test('MockExecutor honors explicit token counts', async (t) => {
  const dir = makeWorkdir(t, { baseline: { output: 'base', tokens: { input: 10, output: 2 } } });
  const result = await new MockExecutor().run('plain prompt', dir);
  assert.deepEqual(result.tokens, { input: 10, output: 2 });
});

test('MockExecutor estimates tokens when the marker omits them', async (t) => {
  const dir = makeWorkdir(t, { baseline: { output: 'abcd' } });
  const result = await new MockExecutor().run('12345678', dir);
  assert.deepEqual(result.tokens, { input: 2, output: 1 });
});

test('MockExecutor returns an empty output without a marker file', async (t) => {
  const dir = makeWorkdir(t);
  const result = await new MockExecutor().run('plain prompt', dir);
  assert.equal(result.output, '');
  assert.ok(result.tokens && result.tokens.input !== undefined && result.tokens.input > 0);
});

test('MockExecutor describes itself as a mock', () => {
  assert.equal(new MockExecutor().describe().kind, 'mock');
});
