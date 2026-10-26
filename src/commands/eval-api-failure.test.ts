import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ApiExecutor } from "../agents/adapters/api.js";
import { runBenchInit } from "../cli/bench.js";
import { runEval } from "../cli/eval.js";
import { readEvaluationReport } from "../cli/evaluation-report.js";

for (const role of ['agent', 'judge'] as const) test(`failed ${role} API content retains known final costs in stopped reports`, async t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-api-failure-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const skill = join(root, 'skill'), bench = join(root, 'bench'), run = join(root, 'runs', 'failed');
  mkdirSync(skill); writeFileSync(join(skill, 'SKILL.md'), '# Offline response failure regression\n');
  await runBenchInit({ dir: bench, yes: true, log: () => {} });
  let apiCalls = 0, primaryCalls = 0;
  const payload = { choices: [{ message: { content: null, refusal: 'synthetic response' } }],
    usage: { prompt_tokens: 123, completion_tokens: 17, prompt_tokens_details: { cached_tokens: 23 } } };
  const api = new ApiExecutor({ apiKey: 'synthetic-api-key', fetchImpl: async () => { apiCalls++; return new Response(JSON.stringify(payload)); } });
  const primary = { describe: () => ({ kind: 'mock', model: 'offline-primary' }), run: async () => {
    primaryCalls++; return { output: 'skillfit-ok', tokens: { input: 10, cachedInput: 4, output: 2 } };
  } };
  await assert.rejects(runEval({ skillPath: skill, bench, trials: 1, dryRun: false, yes: true, runsRoot: join(root, 'runs'), runGroup: 'failed',
    executor: role === 'agent' ? api : primary, judgeExecutor: role === 'judge' ? api : null,
    spendingBudget: { input: 1000, cachedInput: 1000, uncachedInput: 1000, output: 1000, durationSeconds: 1000 }, log: () => {} }),
  /EXECUTION_FAILED|choices\[0\]/);
  assert.equal(apiCalls, 1); assert.equal(primaryCalls, role === 'agent' ? 0 : 2);
  const report = await readEvaluationReport(run); assert.equal(report.status, 'stopped');
  assert.ok('invocationCosts' in report); const costs = report.invocationCosts?.total; assert.ok(costs);
  assert.equal(costs.metrics.input.knownTotal, role === 'agent' ? 123 : 143);
  assert.equal(costs.metrics.cachedInput.knownTotal, role === 'agent' ? 23 : 31);
  assert.equal(costs.metrics.output.knownTotal, role === 'agent' ? 17 : 21);
  assert.equal(costs.metrics.input.coverage.final, role === 'agent' ? 1 : 3);
  assert.equal(report.acceptance.eligibleForUpgrade, false); assert.equal(report.acceptance.automaticUpgrade, false);
  const evidence = role === 'agent' ? readFileSync(join(run, 'example-task/baseline/trial-1/_transcript.jsonl'), 'utf8')
    : JSON.parse(readFileSync(join(run, 'example-task/judge-trial-1/call-1.json'), 'utf8')).rawOutput;
  assert.deepEqual(JSON.parse(evidence), payload);
  assert.equal(readFileSync(join(run, '_session.json'), 'utf8').includes('synthetic-api-key'), false);
});
