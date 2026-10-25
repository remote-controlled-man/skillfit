import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import type { AgentSessions } from "../matrix.js";
import { probeCodexPartialUsage } from "./codex-usage.js";
import { CliExecutor } from "./cli.js";
import { ExecutorFailure } from "../contracts.js";

const ID = '11111111-1111-4111-8111-111111111111';
const sessions: AgentSessions = { dir: '~/sessions', homeOverride: { env: 'TEST_SESSION_HOME', relativePath: 'sessions' },
  transcriptGlob: '**/rollout-*.jsonl', wireShape: 'codex-rollout', docs: null };
function setup(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-partial-usage-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const workdir = join(root, 'workspace'); mkdirSync(workdir); const folder = join(root, 'sessions'); mkdirSync(folder);
  const file = join(folder, 'rollout-fixture-' + ID + '.jsonl'), now = Date.now();
  const meta = { timestamp: new Date(now).toISOString(), type: 'session_meta', payload: { id: ID, cwd: workdir } };
  const usage = (input = 100, cached = 60, output = 20, at = now + 10) => ({ timestamp: new Date(at).toISOString(),
    type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output } } } });
  const save = (events: unknown[]) => writeFileSync(file, events.map(e => JSON.stringify(e)).join('\n') + '\n');
  const options = { sessions, stdout: JSON.stringify({ type: 'thread.started', thread_id: ID }), workdir,
    startedAtMs: now, finishedAtMs: now + 1000, homeDir: root, env: { TEST_SESSION_HOME: '/must-not-read' } };
  return { root, file, folder, now, meta, usage, save, options };
}

test('partial counters bind identity, canonical workspace and time; cumulative snapshots are not summed', t => {
  const f = setup(t); f.save([f.meta, f.usage(100, 60, 20), { type: 'response_item', payload: { text: 'PRIVATE_BODY_DO_NOT_EXPORT' } }, f.usage(150, 90, 30)]);
  const result = probeCodexPartialUsage({ ...f.options, workdir: join(f.options.workdir, '.') });
  assert.deepEqual(result?.tokens, { input: 150, cachedInput: 90, output: 30 });
  assert.equal(result?.evidence.threadId, ID); assert.match(result!.evidence.recordSha256, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(result).includes('PRIVATE_BODY')); assert.ok(!JSON.stringify(result).includes(f.root));
  assert.match(result!.evidence.scope, /Partial/);
});

test('wrong or stale identity, future counters and ambiguous files never borrow another session usage', t => {
  const f = setup(t);
  f.save([{ ...f.meta, payload: { id: ID, cwd: '/another-workspace' } }, f.usage()]); assert.equal(probeCodexPartialUsage(f.options), undefined);
  f.save([{ ...f.meta, timestamp: new Date(f.now - 6000).toISOString() }, f.usage()]); assert.equal(probeCodexPartialUsage(f.options), undefined);
  f.save([f.meta, f.usage(100, 60, 20, f.now + 1001)]); assert.equal(probeCodexPartialUsage(f.options), undefined);
  f.save([f.meta, f.usage()]); writeFileSync(join(f.folder, 'rollout-second-' + ID + '.jsonl'), readFileSync(f.file));
  assert.equal(probeCodexPartialUsage(f.options), undefined);
});

test('malformed partitions, decreasing counters and missing public thread identity remain unknown', t => {
  const f = setup(t);
  for (const events of [[f.meta, f.usage(100, 101)], [f.meta, f.usage(1.5)], [f.meta, f.usage(100), f.usage(99)], [f.usage(), f.meta]]) {
    f.save(events); assert.equal(probeCodexPartialUsage(f.options), undefined);
  }
  f.save([f.meta, f.usage()]); assert.equal(probeCodexPartialUsage({ ...f.options, stdout: 'not a public JSON thread' }), undefined);
  assert.equal(probeCodexPartialUsage({ ...f.options, stdout: f.options.stdout + '\n' + JSON.stringify({ type: 'thread.started', thread_id: '22222222-2222-4222-8222-222222222222' }) }), undefined);
  assert.equal(probeCodexPartialUsage({ ...f.options, sessions: { ...sessions, wireShape: 'content-blocks' } }), undefined);
});

test('a failed fake CLI keeps partial local usage and numeric provenance without invoking a model', async t => {
  const f = setup(t); f.save([f.meta, f.usage(100, 60, 20, f.now)]);
  const child = `console.log(JSON.stringify({type:'thread.started',thread_id:${JSON.stringify(ID)}}));process.exitCode=1;`;
  const executor = new CliExecutor({ argv: [process.execPath, '-e', child], shell: false, triggerSkillName: 'offline-fixture',
    partialUsageFromSessionLog: true, sessions, homeDir: f.root });
  await assert.rejects(executor.run('offline', f.options.workdir), error => {
    assert.ok(error instanceof ExecutorFailure); assert.equal(error.result.usageStatus, 'partial');
    assert.deepEqual(error.result.tokens, { input: 100, cachedInput: 60, output: 20 });
    assert.equal(error.result.usageEvidence?.source, 'local-session-token-count'); return true;
  });
  const disabled = new CliExecutor({ argv: [process.execPath, '-e', child], shell: false, triggerSkillName: 'offline-fixture', sessions, homeDir: f.root });
  await assert.rejects(disabled.run('offline', f.options.workdir), error => { assert.ok(error instanceof ExecutorFailure); assert.equal(error.result.tokens, undefined); return true; });
});

test('a healthy fake CLI uses public final counters without replacing them with a local snapshot', async t => {
  const f = setup(t); f.save([f.meta, f.usage(100, 60, 20, f.now)]);
  const child = `console.log(JSON.stringify({type:'thread.started',thread_id:${JSON.stringify(ID)}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:50,cached_input_tokens:10,output_tokens:5}}));`;
  const executor = new CliExecutor({ argv: [process.execPath, '-e', child], shell: false, triggerSkillName: 'offline-fixture',
    partialUsageFromSessionLog: true, sessions, homeDir: f.root });
  const result = await executor.run('offline', f.options.workdir);
  assert.deepEqual(result.tokens, { input: 50, cachedInput: 10, output: 5 }); assert.equal(result.usageEvidence, undefined);
});
