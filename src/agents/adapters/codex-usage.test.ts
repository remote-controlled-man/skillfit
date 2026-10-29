import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import type { AgentSessions } from "../matrix.js";
import { probeCodexPartialUsage } from "./codex-usage.js";
import { CliExecutor } from "./cli.js";
import { ExecutorFailure } from "../contracts.js";
import { withCancellation } from '../../shared/cancellation.js';

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


const liveLimits = { input: 1000, cachedInput: 1000, uncachedInput: 1000, output: 1000 };
for (const [metric, limit] of [['input', 100], ['cachedInput', 60], ['uncachedInput', 40], ['output', 20]] as const) {
  test(`a live ${metric} stop kills an offline child and retains a partial source-bound receipt`, async t => {
    const f = setup(t), controller = new AbortController();
    const script = `const fs=require('node:fs');const events=${JSON.stringify([f.meta, f.usage(100, 60, 20, f.now)])};
      fs.writeFileSync(${JSON.stringify(f.file)},events.map(e=>JSON.stringify({...e,timestamp:new Date().toISOString()})).join('\\n')+'\\n');
      console.log(JSON.stringify({type:'thread.started',thread_id:${JSON.stringify(ID)}}));setInterval(()=>{},10000);`;
    const executor = new CliExecutor({ argv: [process.execPath, '-e', script], shell: false,
      streamJson: true, wireShape: 'codex-items', timeoutMs: null,
      partialUsageFromSessionLog: true, sessions, homeDir: f.root });
    const timer = setTimeout(() => controller.abort(new Error('offline test cleanup')), 15000);
    t.after(() => { clearTimeout(timer); controller.abort(new Error('offline test cleanup')); });
    await assert.rejects(withCancellation(controller.signal, () => executor.run('offline', f.options.workdir,
      { tokenBudget: { ...liveLimits, [metric]: limit } })), error => {
      assert.ok(error instanceof ExecutorFailure); assert.match(error.message, /SPENDING_BUDGET_REACHED/);
      assert.equal(error.result.budgetStop, 'SPENDING_BUDGET_REACHED'); assert.equal(error.result.usageStatus, 'partial');
      assert.deepEqual(error.result.tokens, { input: 100, cachedInput: 60, output: 20 });
      assert.equal(error.result.usageEvidence?.threadId, ID);
      assert.equal(error.result.executionTiming?.timeoutMs, null);
      assert.equal(error.result.executionTiming?.timeoutFiredAfterMs, null);
      return true;
    });
  });
}

test('live cumulative snapshots replace earlier snapshots and do not add them again', async t => {
  const f = setup(t); f.save([f.meta, f.usage(100, 60, 20, f.now), f.usage(150, 90, 30, f.now)]);
  const script = `console.log(JSON.stringify({type:'thread.started',thread_id:${JSON.stringify(ID)}}));setTimeout(()=>console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:150,cached_input_tokens:90,output_tokens:30}})),2300);`;
  const executor = new CliExecutor({ argv: [process.execPath, '-e', script], shell: false,
    streamJson: true, wireShape: 'codex-items', timeoutMs: null,
    partialUsageFromSessionLog: true, sessions, homeDir: f.root });
  const result = await executor.run('offline', f.options.workdir, { tokenBudget: { ...liveLimits, input: 151 } });
  assert.equal(result.budgetStop, undefined); assert.equal(result.usageStatus, 'final');
  assert.deepEqual(result.tokens, { input: 150, cachedInput: 90, output: 30 });
  assert.equal(result.executionTiming?.timeoutMs, null);
});

test('an unsupported or unbudgeted no-deadline CLI refuses before spawning', async t => {
  const f = setup(t);
  const executor = new CliExecutor({ argv: [process.execPath, '-e', 'throw Error("must not start")'], shell: false, timeoutMs: null });
  await assert.rejects(executor.run('offline', f.options.workdir), error => {
    assert.ok(error instanceof ExecutorFailure); assert.equal(error.executorInvoked, false); return true;
  });
});


test('Token-only waiting preserves unknown usage and still responds to manual cancellation', async t => {
  const f = setup(t); const controller = new AbortController();
  const script = `console.log(JSON.stringify({type:'thread.started',thread_id:${JSON.stringify(ID)}}));setInterval(()=>{},10000);`;
  const executor = new CliExecutor({ argv: [process.execPath, '-e', script], shell: false,
    streamJson: true, wireShape: 'codex-items', timeoutMs: null,
    partialUsageFromSessionLog: true, sessions, homeDir: f.root });
  const timer = setTimeout(() => controller.abort(new Error('manual offline cancellation')), 1300); t.after(() => clearTimeout(timer));
  await assert.rejects(withCancellation(controller.signal, () => executor.run('offline', f.options.workdir, { tokenBudget: liveLimits })), error => {
    assert.ok(error instanceof ExecutorFailure); assert.match(error.message, /manual offline cancellation/);
    assert.equal(error.result.tokens, undefined); assert.equal(error.result.budgetStop, undefined);
    assert.equal(error.result.usageStatus, 'partial'); assert.equal(error.result.executionTiming?.timeoutFiredAfterMs, null);
    return true;
  });
});


test('a quiet running child is stopped when a later local cumulative update reaches its Token line', async t => {
  const f = setup(t); const controller = new AbortController();
  const script = `const fs=require('node:fs');const file=${JSON.stringify(f.file)};const id=${JSON.stringify(ID)};
    const write=(x)=>fs.appendFileSync(file,JSON.stringify({timestamp:new Date().toISOString(),...x})+'\\n');
    write({type:'session_meta',payload:{id,cwd:process.cwd()}});
    const usage=(n)=>write({type:'event_msg',payload:{type:'token_count',info:{total_token_usage:{input_tokens:n,cached_input_tokens:0,output_tokens:2}}}});
    usage(20);console.log(JSON.stringify({type:'thread.started',thread_id:id}));
    setTimeout(()=>usage(120),1300);setInterval(()=>{},10000);`;
  const executor = new CliExecutor({ argv: [process.execPath, '-e', script], shell: false,
    streamJson: true, wireShape: 'codex-items', timeoutMs: null,
    partialUsageFromSessionLog: true, sessions, homeDir: f.root });
  const timer = setTimeout(() => controller.abort(new Error('offline test cleanup')), 10000); t.after(() => clearTimeout(timer));
  await assert.rejects(withCancellation(controller.signal, () => executor.run('offline', f.options.workdir,
    { tokenBudget: { ...liveLimits, input: 100 } })), error => {
    assert.ok(error instanceof ExecutorFailure); assert.equal(error.result.budgetStop, 'SPENDING_BUDGET_REACHED');
    assert.deepEqual(error.result.tokens, { input: 120, cachedInput: 0, output: 2 });
    assert.equal(error.result.executionTiming?.timeoutFiredAfterMs, null);
    return true;
  });
});
