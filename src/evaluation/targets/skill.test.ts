import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test, type TestContext } from 'node:test';
import { loadBench } from "../../bench/read.js";
import { collectSkillBundle } from "../../resources/skill.js";
import { assertInstalledSkillFixtures, collectInstalledSkillTarget, installSkillResources, validateSkillInstallDir } from "./skill.js";
import { runExperiment } from "../execution/paired.js";
import { runEval } from "../../cli/eval.js";
import { parseEvalReport, renderEvalMarkdown } from "../../cli/eval-report.js";
import { getAgent } from "../../agents/matrix.js";
import type { Executor } from "../../agents/contracts.js";

function setup(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-installed-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const skill = join(root, 'arbitrary-source-folder');
  mkdirSync(join(skill, 'scripts'), { recursive: true });
  mkdirSync(join(skill, 'assets'));
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: resource-demo\ndescription: Uses a bundled local calculation helper.\n---\nUse scripts/answer.cjs when relevant.\n');
  writeFileSync(join(skill, 'assets', 'value.bin'), Buffer.from([42, 0, 255]));
  writeFileSync(join(skill, 'scripts', 'answer.cjs'), "const fs=require('node:fs'); const path=require('node:path'); fs.writeFileSync('answer.txt', String(fs.readFileSync(path.join(__dirname,'../assets/value.bin'))[0]));\n");
  const bench = join(root, 'bench');
  mkdirSync(join(bench, 'fixture'), { recursive: true });
  writeFileSync(join(bench, 'fixture', 'answer.txt'), 'pending');
  writeFileSync(join(bench, 'prompt.md'), 'Compute the local answer and save it in answer.txt.');
  writeFileSync(join(bench, 'verify.mjs'), "import {readFileSync} from 'node:fs'; import {join} from 'node:path'; process.exit(readFileSync(join(process.argv[2],'answer.txt'),'utf8')==='42'?0:1);\n");
  writeFileSync(join(bench, 'bench.json'), JSON.stringify({ schemaVersion: 1, name: 'resource-fixture', tasks: [
    { id: 'answer', fixture: 'fixture', prompt: 'prompt.md', verifier: 'node verify.mjs', verifierKind: 'command' },
  ] }));
  return { root, skill, bench };
}

test('installed target fingerprints scripts and binary assets and uses manifest name', (t) => {
  const { skill } = setup(t);
  const before = collectInstalledSkillTarget(skill);
  const textHash = collectSkillBundle(skill).sha256;
  assert.equal(before.name, 'resource-demo');
  assert.equal(before.payload, null);
  assert.ok(before.files.includes('scripts/answer.cjs'));
  assert.ok(before.files.includes('assets/value.bin'));
  writeFileSync(join(skill, 'assets', 'value.bin'), Buffer.from([43, 0, 255]));
  assert.notEqual(collectInstalledSkillTarget(skill).sha256, before.sha256);
  assert.equal(collectSkillBundle(skill).sha256, textHash, 'legacy injection identity stays text-only');
});

test('installed Skill paths reject traversal, drive roots and Git metadata', () => {
  for (const dir of ['../skills', '/outside', 'C:\\outside', 'C:relative', '.git/skills', '.', '']) {
    assert.throws(() => validateSkillInstallDir(dir), /relative project path/);
  }
  assert.equal(validateSkillInstallDir('project\\skills'), 'project/skills');
});

test('installed source and destination reject symbolic links without touching their targets', (t) => {
  const { root, skill, bench } = setup(t);
  const target = collectInstalledSkillTarget(skill);
  const outside = join(root, 'outside');
  mkdirSync(outside);
  symlinkSync(outside, join(bench, 'fixture', 'project-skills'), 'junction');
  assert.throws(() => assertInstalledSkillFixtures(loadBench(bench), target, 'project-skills'), /symbolic links/);
  assert.deepEqual(readFileSync(join(skill, 'assets', 'value.bin')), Buffer.from([42, 0, 255]));
  symlinkSync(outside, join(skill, 'linked-resource'), 'junction');
  assert.throws(() => collectInstalledSkillTarget(skill), /Symbolic links/);
});

test('installation rejects source drift and existing target directories', (t) => {
  const { root, skill } = setup(t);
  const target = collectInstalledSkillTarget(skill);
  mkdirSync(join(root, 'trial'));
  writeFileSync(join(skill, 'scripts', 'answer.cjs'), 'changed');
  assert.throws(() => installSkillResources(target, join(root, 'trial'), 'project-skills'), /changed after planning/);
  assert.ok(!existsSync(join(root, 'trial', 'project-skills')));
  const current = collectInstalledSkillTarget(skill);
  mkdirSync(join(root, 'trial', 'project-skills', current.name), { recursive: true });
  assert.throws(() => installSkillResources(current, join(root, 'trial'), 'project-skills'), /overwrite/);
});

test('paired installed delivery preserves prompts, executes copied resources and retains receipts', async (t) => {
  const { root, skill, bench } = setup(t);
  const prompts: string[] = [];
  const executor: Executor = {
    describe: () => ({ kind: 'mock', model: 'offline-resource-probe' }),
    run: async (prompt, workdir) => {
      prompts.push(prompt);
      const helper = join(workdir, 'project-skills', 'resource-demo', 'scripts', 'answer.cjs');
      if (existsSync(helper)) {
        const result = spawnSync(process.execPath, [helper], { cwd: workdir, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
      }
      return { output: 'done', rawOutput: '{"offline":true}\n', ...(existsSync(helper) ? { skillTriggered: true } : {}) };
    },
  };
  const manifest = await runExperiment({ bench: loadBench(bench), target: collectInstalledSkillTarget(skill),
    executor, inputMode: 'workspace', skillInstallDir: 'project-skills', trials: 1, runsRoot: root, runGroup: 'pair' });
  assert.deepEqual(prompts, [prompts[0], prompts[0]]);
  assert.ok(!prompts[0]?.includes('Use scripts/answer.cjs'));
  assert.equal(manifest.overall.conditions.baseline.passes, 0);
  assert.equal(manifest.overall.conditions.treatment.passes, 1);
  assert.deepEqual(manifest.skillDelivery, { mode: 'installed', installDir: 'project-skills' });
  const baseline = join(root, 'pair', 'answer', 'baseline', 'trial-1');
  const treatment = join(root, 'pair', 'answer', 'treatment', 'trial-1');
  assert.ok(!existsSync(join(baseline, 'project-skills')));
  assert.deepEqual(readFileSync(join(treatment, 'project-skills', 'resource-demo', 'assets', 'value.bin')), Buffer.from([42, 0, 255]));
  assert.equal(JSON.parse(readFileSync(join(baseline, '_result.json'), 'utf8')).skillTriggered, null);
  assert.equal(JSON.parse(readFileSync(join(treatment, '_result.json'), 'utf8')).skillTriggered, true);
  assert.equal(readFileSync(join(treatment, '_transcript.jsonl'), 'utf8'), '{"offline":true}\n');
  const report = renderEvalMarkdown(parseEvalReport(manifest));
  assert.match(report, /Delivery: complete Skill installed in treatment/);
  assert.match(report, /Synthetic harness run/);
  assert.ok(!report.includes('Skill content was force-injected'));
  const cliReport = renderEvalMarkdown(parseEvalReport({ ...manifest, executor: { kind: 'cli', model: 'offline-report-fixture' } }));
  assert.match(cliReport, /Complete Skill resources were installed/);
  assert.ok(!cliReport.includes('Skill content was force-injected'));
  const invalid = structuredClone(manifest);
  invalid.skillDelivery!.installDir = '../outside';
  assert.throws(() => parseEvalReport(invalid), /relative project path/);
});

test('installed dry run uses matrix location and writes nothing', async (t) => {
  const { root, skill, bench } = setup(t);
  const lines: string[] = [];
  const executor: Executor = { describe: () => ({ kind: 'mock', model: 'offline' }), run: async () => { throw new Error('must not run'); } };
  await runEval({ skillPath: skill, bench, agent: 'codex', mode: 'installed', dryRun: true, yes: true,
    executor, runsRoot: join(root, 'runs'), log: (line) => lines.push(line) });
  assert.ok(!existsSync(join(root, 'runs')));
  assert.match(lines.join('\n'), /complete Skill resources installed only in treatment/);
  assert.match(lines.join('\n'), /workspace files on disk/);
  await assert.rejects(runEval({ skillPath: skill, bench, agent: 'codex', mode: 'installed', inputMode: 'snapshot',
    dryRun: true, yes: true, executor, log: () => {} }), /requires workspace/);
  const api: Executor = { describe: () => ({ kind: 'api', model: 'offline' }), run: async () => { throw new Error('must not run'); } };
  await assert.rejects(runEval({ skillPath: skill, bench, agent: 'codex', mode: 'installed', dryRun: true,
    yes: true, executor: api, log: () => {} }), /filesystem access|workspace input/);
});

test('fixture contamination blocks all calls at plan time', async (t) => {
  const { root, skill, bench } = setup(t);
  mkdirSync(join(bench, 'fixture', 'project-skills', 'resource-demo'), { recursive: true });
  let calls = 0;
  const executor: Executor = { describe: () => ({ kind: 'mock', model: 'offline' }), run: async () => { calls++; return { output: '' }; } };
  await assert.rejects(runExperiment({ bench: loadBench(bench), target: collectInstalledSkillTarget(skill),
    executor, inputMode: 'workspace', skillInstallDir: 'project-skills', trials: 1, runsRoot: root, runGroup: 'blocked' }), /baseline contamination/);
  assert.equal(calls, 0);
  assert.ok(!existsSync(join(root, 'blocked')));
});

test('installed mode rejects contamination in every matrix project search path before calls', async (t) => {
  const { root, skill, bench } = setup(t);
  const [primary, alternate] = getAgent('kimi-code').skills.projectDirs;
  assert.ok(primary && alternate && primary !== alternate);
  mkdirSync(join(bench, 'fixture', alternate, 'resource-demo'), { recursive: true });
  let calls = 0;
  const executor: Executor = { describe: () => ({ kind: 'mock', model: 'offline' }), run: async () => { calls++; return { output: 'done' }; } };
  for (const dryRun of [true, false]) {
    await assert.rejects(runEval({ skillPath: skill, bench, agent: 'kimi-code', mode: 'installed', dryRun,
      yes: true, executor, runsRoot: join(root, 'runs'), log: () => {} }), /baseline contamination/);
  }
  assert.equal(calls, 0);
  assert.ok(!existsSync(join(root, 'runs')));
});

test('programmatic installed runner rejects alternate project paths too', async (t) => {
  const { root, skill, bench } = setup(t);
  mkdirSync(join(bench, 'fixture', 'alternate-skills', 'resource-demo'), { recursive: true });
  let calls = 0;
  const executor: Executor = { describe: () => ({ kind: 'mock', model: 'offline' }), run: async () => { calls++; return { output: '' }; } };
  await assert.rejects(runExperiment({ bench: loadBench(bench), target: collectInstalledSkillTarget(skill),
    executor, inputMode: 'workspace', skillInstallDir: 'project-skills', skillSearchDirs: ['alternate-skills'],
    trials: 1, runsRoot: root, runGroup: 'blocked' }), /baseline contamination/);
  assert.equal(calls, 0);
  assert.ok(!existsSync(join(root, 'blocked')));
});
