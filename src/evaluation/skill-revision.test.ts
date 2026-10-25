import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { runEval } from "../cli/eval.js";
import { parseEvalReport, renderEvalMarkdown } from "../cli/eval-report.js";
import { loadBench } from "../bench/read.js";
import { collectInstalledSkillTarget } from "./targets/skill.js";
import { runExperiment } from "./execution/paired.js";
import type { RunManifest } from "./measurement/report.js";
import type { Executor } from "../agents/contracts.js";

function setup(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-revision-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const previous = join(root, 'old');
  const current = join(root, 'new');
  mkdirSync(join(previous, 'scripts'), { recursive: true });
  writeFileSync(join(previous, 'SKILL.md'), '---\nname: revision-demo\ndescription: Write the local answer.\n---\nUse scripts/answer.cjs.\n');
  writeFileSync(join(previous, '.value'), Buffer.from([1, 0, 255]));
  writeFileSync(join(previous, 'scripts', 'answer.cjs'), "const fs=require('node:fs'),path=require('node:path');fs.writeFileSync('answer.txt',String(fs.readFileSync(path.join(__dirname,'../.value'))[0]));\n");
  cpSync(previous, current, { recursive: true });
  writeFileSync(join(current, '.value'), Buffer.from([2, 0, 255]));
  const bench = join(root, 'bench');
  mkdirSync(join(bench, 'fixture'), { recursive: true });
  writeFileSync(join(bench, 'fixture', 'answer.txt'), 'pending');
  writeFileSync(join(bench, 'prompt.md'), 'Write the answer to answer.txt.');
  for (const [id, expected] of [['fix', '2'], ['regression', '1']]) {
    writeFileSync(join(bench, `${id}.mjs`), `import {readFileSync} from 'node:fs';import {join} from 'node:path';const passed=readFileSync(join(process.argv[2],'answer.txt'),'utf8')===${JSON.stringify(expected)};console.log(JSON.stringify({passed,checks:[{name:'correct-answer',pass:passed}]}));process.exit(passed?0:1);\n`);
  }
  writeFileSync(join(bench, 'bench.json'), JSON.stringify({ schemaVersion: 1, name: 'independent-outcomes', tasks:
    ['fix', 'regression'].map(id => ({ id, fixture: 'fixture', prompt: 'prompt.md', verifier: `node ${id}.mjs`, verifierKind: 'command' })) }));
  const runsRoot = join(root, 'runs');
  const options = { skillPath: current, baselineSkillPath: previous, bench, mode: 'installed' as const,
    skillInstallDir: 'project-skills', dryRun: false, yes: true, trials: 1, runsRoot, runGroup: 'versions',
    judgeExecutor: null, log: () => {} };
  return { root, previous, current, bench, runsRoot, options };
}

function resourceExecutor(prompts: string[] = []): Executor {
  return { describe: () => ({ kind: 'mock', model: 'offline-revision-probe' }), run: async (prompt, workdir) => {
    prompts.push(prompt);
    const helper = join(workdir, 'project-skills', 'revision-demo', 'scripts', 'answer.cjs');
    const result = spawnSync(process.execPath, [helper], { cwd: workdir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return { output: 'done', skillTriggered: true, tokens: { input: 10, output: 2 } };
  } };
}

test('installed revision comparison runs both complete versions and exposes gains and regressions', async t => {
  const { previous, current, runsRoot, options } = setup(t);
  const oldTarget = collectInstalledSkillTarget(previous);
  const newTarget = collectInstalledSkillTarget(current);
  const prompts: string[] = [];
  const manifest = await runEval({ ...options, executor: resourceExecutor(prompts) }) as RunManifest;
  assert.equal(manifest.baselineTarget?.bundleSha256, oldTarget.sha256);
  assert.equal(manifest.target.bundleSha256, newTarget.sha256);
  assert.deepEqual(manifest.baselineTarget?.files, oldTarget.files);
  assert.equal(manifest.tasks[0]?.deltaPassRate, 1);
  assert.equal(manifest.tasks[1]?.deltaPassRate, -1);
  assert.equal(manifest.tasks[0]?.facets[0]?.treatmentPassRate, 1);
  assert.equal(manifest.tasks[1]?.facets[0]?.treatmentPassRate, 0);
  assert.deepEqual(manifest.overall.stats.discordant, { improved: 1, regressed: 1 });
  assert.equal(manifest.overall.verdict, 'inconclusive');
  assert.equal(manifest.experiment?.callsFinished, 4);
  assert.equal(manifest.experiment?.status, 'completed');
  assert.equal(prompts.length, 4);
  assert.equal(new Set(prompts).size, 1, 'natural prompts must be identical across versions');
  assert.ok(!prompts[0]?.includes('Use scripts/answer.cjs'));
  for (const [condition, target, value] of [['baseline', oldTarget, 1], ['treatment', newTarget, 2]] as const) {
    const dir = join(runsRoot, options.runGroup, 'fix', condition, 'trial-1');
    assert.deepEqual(readFileSync(join(dir, 'project-skills', 'revision-demo', '.value')), Buffer.from([value, 0, 255]));
    const receipt = JSON.parse(readFileSync(join(dir, '_result.json'), 'utf8'));
    assert.equal(receipt.target.bundleSha256, target.sha256);
    assert.equal(receipt.target.applied, true);
    assert.equal(receipt.skillTriggered, true);
  }
  const plan = JSON.parse(readFileSync(join(runsRoot, options.runGroup, '_plan.json'), 'utf8'));
  assert.ok(plan.inputs.some((input: { label: string; root: string }) => input.label === 'baseline Skill' && input.root === oldTarget.sourceDir));
  assert.equal(plan.details.baselineTarget.bundleSha256, oldTarget.sha256);
  const report = renderEvalMarkdown(parseEvalReport(manifest));
  assert.ok(report.includes(oldTarget.sha256) && report.includes(newTarget.sha256));
  assert.match(report, /complete Skill installed in both conditions/);
  assert.match(report, /not against no Skill/);
  const cliReport = renderEvalMarkdown(parseEvalReport({ ...manifest, executor: { kind: 'cli', model: 'offline-report-fixture' } }));
  assert.match(cliReport, /revision effects, not installation benefit/);
  assert.match(cliReport, /Observed task regressions: regression/);
  assert.ok(!report.includes('installed only in treatment'));
  assert.match(report, /Synthetic harness run/);
  assert.deepEqual(readFileSync(join(previous, '.value')), Buffer.from([1, 0, 255]));
  assert.deepEqual(readFileSync(join(current, '.value')), Buffer.from([2, 0, 255]));
});

test('revision dry run prints both fingerprints and the unchanged paired budget without writes', async t => {
  const { previous, current, runsRoot, options } = setup(t);
  const lines: string[] = [];
  const executor: Executor = { describe: () => ({ kind: 'mock', model: 'offline' }), run: async () => { throw new Error('must not run'); } };
  const result = await runEval({ ...options, dryRun: true, executor, maxCalls: 4, log: line => lines.push(line) });
  assert.equal(result, null);
  const plan = lines.join('\n');
  assert.ok(plan.includes(collectInstalledSkillTarget(previous).sha256.slice(0, 12)));
  assert.ok(plan.includes(collectInstalledSkillTarget(current).sha256.slice(0, 12)));
  assert.match(plan, /previous Skill in baseline vs target Skill in treatment/);
  assert.match(plan, /installed in both conditions/);
  assert.match(plan, /4 planned; ceiling 4/);
  assert.equal(existsSync(runsRoot), false);
});

test('invalid revision modes, identities, inputs and budgets fail before calls or writes', async t => {
  const { previous, current, runsRoot, options } = setup(t);
  let calls = 0;
  const executor: Executor = { describe: () => ({ kind: 'mock', model: 'offline' }), run: async () => { calls++; return { output: 'done' }; } };
  for (const dryRun of [true, false]) {
    for (const mode of ['inject', 'trigger'] as const) {
      await assert.rejects(runEval({ ...options, mode, dryRun, executor }), /requires --mode installed/);
    }
    await assert.rejects(runEval({ ...options, baselineSkillPath: current, dryRun, executor }), /identical complete-resource/);
    await assert.rejects(runEval({ ...options, inputMode: 'snapshot', dryRun, executor }), /requires workspace/);
    await assert.rejects(runEval({ ...options, maxCalls: 3, dryRun, executor }), /exceeding --max-calls/);
    writeFileSync(join(previous, 'SKILL.md'), '---\nname: different-skill\ndescription: Different identity.\n---\n');
    await assert.rejects(runEval({ ...options, dryRun, executor }), /same SKILL.md frontmatter name/);
    cpSync(join(current, 'SKILL.md'), join(previous, 'SKILL.md'));
  }
  assert.equal(calls, 0);
  assert.equal(existsSync(runsRoot), false);
});

test('baseline source drift after a call stops the session and keeps the receipt ungraded', async t => {
  const { previous, runsRoot, options } = setup(t);
  let calls = 0;
  const executor: Executor = { describe: () => ({ kind: 'mock', model: 'offline' }), run: async () => {
    calls++;
    writeFileSync(join(previous, '.value'), Buffer.from([3]));
    return { output: 'done' };
  } };
  await assert.rejects(runEval({ ...options, executor }), /changed after planning/);
  assert.equal(calls, 1);
  const group = join(runsRoot, options.runGroup);
  const receipt = JSON.parse(readFileSync(join(group, 'fix', 'baseline', 'trial-1', '_result.json'), 'utf8'));
  assert.match(receipt.error, /Frozen baseline Skill input changed/);
  assert.equal(receipt.verifierExitCode, null);
  const session = JSON.parse(readFileSync(join(group, '_session.json'), 'utf8'));
  assert.equal(session.status, 'stopped');
  assert.equal(existsSync(join(group, 'manifest.json')), false);
});

test('programmatic revision plans reject injection and mismatched names before workspace creation', async t => {
  const { previous, current, bench, runsRoot } = setup(t);
  const target = collectInstalledSkillTarget(current);
  const baselineTarget = collectInstalledSkillTarget(previous);
  const plan = { bench: loadBench(bench), target, baselineTarget, executor: resourceExecutor(), trials: 1, runsRoot, runGroup: 'blocked' };
  await assert.rejects(runExperiment(plan), /requires installed delivery/);
  await assert.rejects(runExperiment({ ...plan, inputMode: 'workspace', skillInstallDir: 'project-skills',
    baselineTarget: { ...baselineTarget, name: 'different' } }), /same SKILL.md frontmatter name/);
  assert.equal(existsSync(runsRoot), false);
});
