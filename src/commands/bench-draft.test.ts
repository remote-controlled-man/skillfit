import { observedModelIdentity, parseModelIdentities, assertModelIdentity } from "../agents/observation/model-identity.js";
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { runBenchAdd, runBenchInit } from "../cli/bench.js";
import { ExecutorFailure, type Executor, type ExecutorResult } from "../agents/contracts.js";
import { loadBench } from "../bench/read.js";

const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const verifier = `import fs from 'node:fs';import path from 'node:path';const p=path.join(process.argv[2],'_output.md');const passed=fs.existsSync(p)&&fs.readFileSync(p,'utf8')==='done';console.log(JSON.stringify({passed,checks:[{name:'answer',pass:passed},{name:'exact',pass:passed}]}));process.exit(passed?0:1);`;
const oracle = `import fs from 'node:fs';import path from 'node:path';fs.writeFileSync(path.join(process.argv[2],'_output.md'),'done');`;
const budget = { input: 1000, cachedInput: 1000, uncachedInput: 1000, output: 1000, durationSeconds: 60 };

async function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-draft-regression-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'source'), bench = join(root, 'bench');
  mkdirSync(source); writeFileSync(join(source, 'input.txt'), 'unsolved');
  await runBenchInit({ dir: bench, yes: true, log: () => {} });
  let calls = 0;
  const executor = (after?: (cwd: string) => void, response?: ExecutorResult): Executor => ({
    describe: () => ({ kind: 'mock', model: 'offline-drafter' }),
    run: async (_prompt, cwd) => {
      calls++; writeFileSync(join(cwd, 'verifier.mjs'), verifier); writeFileSync(join(cwd, 'oracle.mjs'), oracle);
      after?.(cwd);
      return response ?? { output: 'drafted', tokens: { input: 123, cachedInput: 30, output: 10 }, rawOutput: 'public response only', usageStatus: 'final' };
    },
  });
  const options = { cwd: root, benchDir: bench, sourceDir: source, include: ['input.txt'], task: 'drafted', prompt: 'Answer done',
    freeze: true, decompose: true, runsRoot: join(root, 'runs'), runGroup: 'saved', log: () => {} };
  return { root, source, bench, options, executor, calls: () => calls, records: join(root, 'runs/saved') };
}

test('drafting confirmation and predictable write failures precede every model call', async t => {
  const f = await fixture(t), original = readFileSync(join(f.bench, 'bench.json'), 'utf8');
  assert.equal(await runBenchAdd({ ...f.options, executor: f.executor(), confirm: async () => false }), null);
  assert.equal(f.calls(), 0); assert.equal(existsSync(f.records), false);
  mkdirSync(join(f.bench, 'tasks/drafted/prompt.md'), { recursive: true });
  await assert.rejects(runBenchAdd({ ...f.options, executor: f.executor(), yes: true }), /non-file/);
  assert.equal(f.calls(), 0); assert.equal(existsSync(f.records), false);
  assert.equal(readFileSync(join(f.bench, 'bench.json'), 'utf8'), original);
});

test('symlinked output parents cannot write outside the bench or start a draft', async t => {
  const f = await fixture(t), outside = join(f.root, 'outside'); mkdirSync(outside);
  mkdirSync(join(f.bench, 'tasks/drafted'), { recursive: true });
  symlinkSync(outside, join(f.bench, 'tasks/drafted/fixture'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(runBenchAdd({ ...f.options, executor: f.executor(), yes: true }), /symlink/);
  assert.equal(f.calls(), 0); assert.equal(existsSync(join(outside, 'drafted')), false);
});

test('draft dry-run exposes one-call budget and deadlines while creating no records', async t => {
  const f = await fixture(t), lines: string[] = [];
  await runBenchAdd({ ...f.options, executor: f.executor(), dryRun: true, executorTimeoutSeconds: 13,
    maxCalls: 1, spendingBudget: budget, log: line => lines.push(line) });
  assert.equal(f.calls(), 0); assert.equal(existsSync(f.records), false);
  assert.match(lines.join('\n'), /1 call; ceiling 1; executor deadline 13s/);
  assert.match(lines.join('\n'), /"cachedInput":1000/);
});

test('a successful draft retains original inputs, reported usage, gate evidence and the one-call ledger', async t => {
  const f = await fixture(t);
  await runBenchAdd({ ...f.options, executor: f.executor(), yes: true, spendingBudget: budget, verifierTimeoutSeconds: 7 });
  assert.equal(f.calls(), 1);
  const summary = json(join(f.records, '_summary.json')), plan = json(join(f.records, '_plan.json'));
  assert.equal(summary.status, 'completed'); assert.equal(summary.callsStarted, 1); assert.equal(summary.callsFinished, 1);
  assert.equal(summary.costs.metrics.input.knownTotal, 123); assert.equal(summary.costs.metrics.uncachedInput.knownTotal, 93);
  assert.equal(summary.costs.metrics.output.knownTotal, 10); assert.equal(summary.costs.metrics.cachedInput.coverage.final, 1);
  assert.equal(plan.verifierTimeoutSeconds, 7); assert.equal(plan.automaticRetry, false);
  assert.equal(readFileSync(join(f.records, '_inputs/fixture/input.txt'), 'utf8'), 'unsolved');
  assert.equal(readFileSync(join(f.records, '_transcript.jsonl'), 'utf8'), 'public response only');
  assert.equal(readFileSync(join(f.records, '_gates.jsonl'), 'utf8').trim().split('\n').length, 3);
  assert.equal(readFileSync(join(f.records, '_calls.jsonl'), 'utf8').trim().split('\n').length, 2);
  assert.equal(loadBench(f.bench).tasks.find(task => task.id === 'drafted')!.verifierTimeoutSeconds, 7);
  const before = readFileSync(join(f.records, '_summary.json'), 'utf8');
  await assert.rejects(runBenchAdd({ ...f.options, task: 'other', executor: f.executor(), yes: true }), /already exists/);
  assert.equal(f.calls(), 1); assert.equal(readFileSync(join(f.records, '_summary.json'), 'utf8'), before);
});

for (const [name, response, expected] of [
  ['missing counters', { output: 'drafted' }, /FINAL_USAGE_MISSING/],
  ['failed executor', null, /Draft executor failed/],
] as const) test(`a draft with ${name} stops once and preserves available costs`, async t => {
  const f = await fixture(t);
  const executor = response ? f.executor(undefined, response) : f.executor(() => {
    throw new ExecutorFailure('offline failure', { output: 'partial', tokens: { input: 99, output: 5 }, usageStatus: 'partial' });
  });
  await assert.rejects(runBenchAdd({ ...f.options, executor, yes: true, ...(response ? { spendingBudget: budget } : {}) }), expected);
  assert.equal(f.calls(), 1); assert.equal(loadBench(f.bench).tasks.length, 1);
  const summary = json(join(f.records, '_summary.json'));
  assert.equal(summary.status, 'stopped'); assert.equal(summary.callsFinished, 1);
  if (response) assert.equal(summary.costs.metrics.input.coverage.unknown, 1);
  else { assert.equal(summary.costs.metrics.input.knownTotal, 99); assert.equal(summary.costs.metrics.input.coverage.partial, 1); }
});

test('a rejected draft retains its cost and gate failure rather than deleting the attempt', async t => {
  const f = await fixture(t);
  await assert.rejects(runBenchAdd({ ...f.options, executor: f.executor(cwd => writeFileSync(join(cwd, 'verifier.mjs'), 'process.exit(0);')), yes: true }), /NOP gate/);
  const summary = json(join(f.records, '_summary.json'));
  assert.equal(summary.status, 'stopped'); assert.equal(summary.costs.metrics.input.knownTotal, 123);
  assert.equal(f.calls(), 1); assert.equal(loadBench(f.bench).tasks.length, 1);
  assert.equal(json(join(f.records, '_result.json')).tokens.cachedInput, 30);
});

test('a drafter cannot silently replace the pristine fixture', async t => {
  const f = await fixture(t);
  await assert.rejects(runBenchAdd({ ...f.options, executor: f.executor(cwd => writeFileSync(join(cwd, 'fixture/input.txt'), 'solved')), yes: true }), /modified the pristine fixture/);
  assert.equal(f.calls(), 1); assert.equal(json(join(f.records, '_summary.json')).status, 'stopped');
  assert.equal(readFileSync(join(f.records, '_inputs/fixture/input.txt'), 'utf8'), 'unsolved');
});

test('a draft cannot overwrite concurrent bench edits and still retains its paid attempt', async t => {
  const f = await fixture(t), manifest = join(f.bench, 'bench.json');
  await assert.rejects(runBenchAdd({ ...f.options, executor: f.executor(() => {
    const edited = json(manifest); edited.description = 'new user work'; writeFileSync(manifest, JSON.stringify(edited));
  }), yes: true }), /Bench outputs changed/);
  assert.equal(f.calls(), 1); assert.equal(json(manifest).description, 'new user work');
  assert.equal(loadBench(f.bench).tasks.length, 1);
  assert.equal(json(join(f.records, '_summary.json')).status, 'stopped');
  assert.equal(json(join(f.records, '_result.json')).tokens.input, 123);
});

test('invalid draft budgets and deadlines are rejected offline before records or calls', async t => {
  const f = await fixture(t);
  for (const change of [{ maxCalls: 0 }, { executorTimeoutSeconds: 0 }, { verifierTimeoutSeconds: 0 },
    { spendingBudget: { ...budget, input: 0 } }, { runGroup: '../bad' }]) {
    await assert.rejects(runBenchAdd({ ...f.options, ...change, executor: f.executor(), yes: true }));
  }
  assert.equal(f.calls(), 0); assert.equal(existsSync(f.records), false);
});

test('CLI drafting previews accept budget/output controls without executing the selected CLI', async t => {
  const f = await fixture(t), bin = join(f.root, 'bin'); mkdirSync(bin);
  const marker = join(f.root, 'must-not-execute');
  const binary = join(bin, process.platform === 'win32' ? 'codex.cmd' : 'codex');
  writeFileSync(binary, process.platform === 'win32' ? `@echo executed>"${marker}"\r\n` : `#!/bin/sh\nprintf executed > '${marker}'\n`);
  chmodSync(binary, 0o755);
  const budgetPath = join(f.root, 'budget.json'); writeFileSync(budgetPath, JSON.stringify(budget));
  const cli = fileURLToPath(new URL("../cli/main.js", import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'bench', 'add', f.bench, '--freeze', '--source-dir', f.source,
    '--include', 'input.txt', '--task', 'cli-draft', '--prompt', 'Answer done', '--decompose', '--agent', 'codex',
    '--max-calls', '1', '--executor-timeout-seconds', '13', '--verifier-timeout-seconds', '7', '--spending-budget', budgetPath,
    '--runs-root', f.options.runsRoot, '--run-group', 'cli-preview', '--dry-run'],
    { cwd: f.root, env: { ...process.env, PATH: bin + (process.platform === 'win32' ? ';' : ':') + process.env.PATH }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 call; ceiling 1; executor deadline 13s/);
  assert.equal(existsSync(marker), false); assert.equal(existsSync(join(f.options.runsRoot, 'cli-preview')), false);
});


test('drafting retains response identity, relative provenance and matrix version preparation without upgrading a Skill', async t => {
  const f = await fixture(t), base = f.executor();
  const intent = { schemaVersion: 1 as const, configured: null, requested: null };
  const rawOutput = JSON.stringify({ type: 'assistant', message: { model: 'draft-served', content: [] } });
  const descriptor = { kind: 'cli', model: 'cli-configured', modelIntent: intent, modelIdentitySurface: 'claude-assistant' as const };
  let probes = 0;
  const executor: Executor = { describe: () => descriptor, run: async (prompt, cwd) => ({ ...await base.run(prompt, cwd), rawOutput,
    modelIdentity: observedModelIdentity(rawOutput, intent, 'claude-assistant') }) };
  await runBenchAdd({ ...f.options, agent: 'claude-code', executor, yes: true,
    versionProbe: argv => { probes++; assert.deepEqual(argv, ['claude', '--version']); return 'offline-cli 1.0'; } });
  assert.equal(probes, 1); assert.equal(f.calls(), 1);
  const summary = json(join(f.records, '_summary.json')), receipt = json(join(f.records, '_result.json'));
  assert.equal(parseModelIdentities(summary.modelIdentities).drafter?.reported, 1);
  assert.equal(summary.modelIdentities.drafter.calls[0].receipt, '_result.json');
  assertModelIdentity(receipt.modelIdentity, readFileSync(join(f.records, '_transcript.jsonl'), 'utf8'), descriptor);
  assert.equal(json(join(f.records, '_runtime.json')).cliVersion, 'offline-cli 1.0');
  assert.equal(summary.automaticUpgrade, false); assert.equal(summary.costs.metrics.input.knownTotal, 123);
});
