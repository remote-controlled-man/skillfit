import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { probeKimiSessionUsage, workDirKeyHash } from './kimi-usage.js';

function fakeSession(
  t: import('node:test').TestContext,
  home: string,
  workdir: string,
  wireLines: string[],
): string {
  const sessionDir = join(home, '.kimi-code', 'sessions', `wd_task_${workDirKeyHash(workdir)}`, 'sess-1', 'agents', 'main');
  mkdirSync(sessionDir, { recursive: true });
  t.after(() => rmSync(join(home, '.kimi-code'), { recursive: true, force: true }));
  const wire = join(sessionDir, 'wire.jsonl');
  writeFileSync(wire, wireLines.join('\n'));
  return wire;
}

test('workDirKeyHash matches the documented first-12-of-sha256 scheme', () => {
  assert.equal(workDirKeyHash('E:\\code\\agents\\skillfit'), '0ab26300da72');
});

test('probeKimiSessionUsage sums usage.record input parts and output', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'skillfit-kimi-usage-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const workdir = join(home, 'run');
  fakeSession(t, home, workdir, [
    '{"type":"metadata"}',
    '{"type":"usage.record","agentId":"main","usage":{"inputOther":100,"output":10,"inputCacheRead":40,"inputCacheCreation":5}}',
    '{"type":"usage.record","agentId":"agent-3","usage":{"inputOther":7,"output":3}}',
    'garbage',
  ]);
  const usage = probeKimiSessionUsage(workdir, Date.now() - 60_000, home);
  assert.deepEqual(usage, { input: 152, output: 13 });
});

test('probeKimiSessionUsage ignores stale sessions and unknown workdirs', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'skillfit-kimi-usage-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const workdir = join(home, 'run');
  const wire = fakeSession(t, home, workdir, [
    '{"type":"usage.record","usage":{"inputOther":1,"output":1}}',
  ]);
  const stale = Date.now() + 60_000;
  assert.equal(probeKimiSessionUsage(workdir, stale, home), undefined);
  assert.equal(probeKimiSessionUsage(join(home, 'elsewhere'), Date.now() - 60_000, home), undefined);
  rmSync(wire);
  assert.equal(probeKimiSessionUsage(workdir, Date.now() - 60_000, home), undefined);
});
