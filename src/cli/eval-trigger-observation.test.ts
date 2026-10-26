import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { getAgent } from "../agents/matrix.js";
import { CliExecutor } from "../agents/adapters/cli.js";
import { ExecutorFailure } from "../agents/contracts.js";
import { packageFiles, verifyReplayPackage } from "../evaluation/records/replay-package.js";
import { sha256File } from "../shared/hash.js";
import { runBenchCheck, runBenchInit } from "./bench.js";
import { runEval, type EvalOptions } from "./eval.js";
import { prepareEvalPlan } from "./eval-plan.js";
import { readEvaluationReport } from "./evaluation-report.js";
import { runEvalReport } from "./eval-report.js";
import { exportEvaluation } from "../evaluation/application/export.js";

async function fixture(t: TestContext, cases = ['exact']) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-trigger-v2-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), skill = join(root, 'review'), home = join(root, 'home'), script = join(root, 'fake-claude.cjs');
  await runBenchInit({ dir: bench, yes: true, log: () => {} });
  mkdirSync(skill); mkdirSync(home);
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: review-alias\ndescription: Synthetic offline control.\n---\nReturn skillfit-ok.\n');
  const definition = JSON.parse(readFileSync(join(bench, 'bench.json'), 'utf8')), original = definition.tasks[0];
  definition.tasks = cases.map(id => {
    const prompt = `prompts/${id}.md`; writeFileSync(join(bench, prompt), `CASE ${id}\nReply skillfit-ok.\n`);
    return { ...original, id, prompt, promptTrigger: prompt, shouldTrigger: !['prefix', 'other', 'negative'].includes(id) };
  });
  writeFileSync(join(bench, 'bench.json'), JSON.stringify(definition));
  writeFileSync(script, `const fs=require('node:fs');
let prompt='';process.stdin.on('data',d=>prompt+=d);process.stdin.on('end',()=>{
  const args=process.argv.slice(2);
  if(!args.includes('-p')||args[args.indexOf('--output-format')+1]!=='stream-json'||!args.includes('--verbose')) throw Error('wrong factory argv');
  const emit=x=>process.stdout.write(JSON.stringify(x)+'\\n');
  emit({type:'system',subtype:'init'});process.stdout.write('\\n');
  const name=(prompt.match(/CASE (\\w+)/)||[])[1]||'exact';
  const checklist={A:{correct:true,complete:true,grounded:true},B:{correct:true,complete:true,grounded:true}};
  const text=prompt.startsWith('You are an impartial judge')?JSON.stringify(checklist):'skillfit-ok';
  const blocks=[{type:'text',text}];
  if(!['negative','truncated'].includes(name)) blocks.push({type:'tool_use',name:'Skill',input:name==='malformed'?'{broken':{skill:name==='prefix'?'review-extra':name==='other'?'other':name==='alias'?'review-alias':'review',args:'review'}});
  emit({type:'assistant',message:{model:name==='other'?'public-other':'public-main',content:blocks}});
  if(name==='truncated') process.stdout.write('{"type":');
  else emit({type:'result',subtype:name==='failed'?'error_during_execution':'success',is_error:name==='failed',result:text,errors:name==='failed'?['synthetic terminal failure']:[]});
});\n`);
  const agent = getAgent('claude-code'), saved = agent.headless.streamJson!.argv;
  agent.headless.streamJson!.argv = [process.execPath, script, ...saved.slice(1)];
  t.after(() => { agent.headless.streamJson!.argv = saved; });
  const executor = CliExecutor.forAgent('claude-code', { triggerSkillName: 'review', triggerSkillIdentities: ['review-alias'] });
  const options: EvalOptions = { skillPath: skill, bench, agent: 'claude-code', mode: 'trigger', executor, trials: 1,
    maxCalls: cases.length, runsRoot: join(root, 'runs'), runGroup: 'trigger', dryRun: false, yes: true, judgeExecutor: null,
    sessionOptions: { homeDir: home, env: { PATH: '', HOME: home, USERPROFILE: home } }, log: () => {} };
  return { root, bench, skill, home, script, executor, options, run: join(root, 'runs', 'trigger') };
}

function reseal(run: string) {
  const file = join(run, '_artifacts.json'), index = JSON.parse(readFileSync(file, 'utf8'));
  index.files = Object.fromEntries(packageFiles(run).filter(path => path !== '_artifacts.json').map(path => [path, sha256File(join(run, path))]));
  writeFileSync(file, JSON.stringify(index));
}

test('Claude factory drives normal trigger execution, receipts, reports and portable replay without live calls', async t => {
  const f = await fixture(t, ['exact', 'prefix', 'other', 'negative', 'malformed', 'truncated', 'alias', 'failed']);
  const prepared = await prepareEvalPlan(f.options, {});
  assert.equal(existsSync(f.run), false);
  const declaration = prepared.plan.evaluation.triggerDetection!;
  assert.equal(declaration.schemaVersion, 2); assert.equal(declaration.wireShape, 'content-blocks');
  assert.deepEqual(declaration.identities, ['review', 'review-alias']);
  await runEval({ ...prepared.options, reviewedPlan: prepared.plan, onPlan: prepared.assertCurrent });
  const summary = JSON.parse(readFileSync(join(f.run, 'manifest.json'), 'utf8'));
  const plan = JSON.parse(readFileSync(join(f.run, '_plan.json'), 'utf8'));
  assert.deepEqual(summary.triggerDetection, declaration); assert.deepEqual(plan.details.triggerDetection, declaration);
  const statuses = { exact: true, prefix: false, other: false, negative: false, malformed: null, truncated: null, failed: true, alias: true };
  for (const [id, expected] of Object.entries(statuses)) {
    const r = JSON.parse(readFileSync(join(f.run, id, 'installed/trial-1/_result.json'), 'utf8'));
    assert.deepEqual(r.triggerDetection, declaration); assert.equal(r.triggered, expected, `${id}: ${r.error}`);
    assert.equal(r.triggerEvidence.complete, !['malformed', 'truncated', 'failed'].includes(id));
    if (expected === true) assert.deepEqual(r.triggerEvidence.eventLines, [3]);
    if (id === 'failed') assert.match(r.error, /synthetic terminal failure/);
    assert.equal(r.tokens, null, 'Connecting Claude stream output must not invent a token reader');
  }
  assert.equal(summary.modelIdentities.primary.invoked, 8); assert.equal(summary.modelIdentities.primary.reported, 8);
  assert.deepEqual(summary.modelIdentities.primary.models, ['public-main', 'public-other']);
  assert.deepEqual(summary.metrics.positives, { fired: 2, runs: 2 });
  assert.deepEqual(summary.metrics.negatives, { fired: 0, runs: 3 });
  const report = await readEvaluationReport(f.run);
  assert.ok('evaluationType' in report && report.evaluationType === 'trigger');
  assert.equal(report.evidence.verified, true, JSON.stringify(report.evidence));
  assert.equal(report.summary?.triggerDetection?.schemaVersion, 2); assert.equal(report.acceptance.eligibleForUpgrade, false);
  const original = packageFiles(f.run).map(path => [path, sha256File(join(f.run, path))]);
  const markdown: string[] = []; await runEvalReport(f.run, line => markdown.push(line));
  assert.match(markdown[0]!, /Observation protocol: triggerDetection v2/);
  const portable = join(f.root, 'portable'); await exportEvaluation(f.run, portable, { yes: true, log: () => {} });
  assert.equal(verifyReplayPackage(portable).evaluationType, 'trigger');
  rmSync(f.script); // Any accidental replay dispatch now fails instead of starting a subprocess.
  const replay = await readEvaluationReport(portable, { replay: true });
  assert.ok('evaluationType' in replay && replay.evaluationType === 'trigger');
  assert.equal(replay.evidence.verified, true, JSON.stringify(replay.evidence));
  assert.deepEqual(replay.modelIdentities, summary.modelIdentities);
  assert.ok('modelCalls' in replay.evidence); assert.equal(replay.evidence.modelCalls, 0); assert.deepEqual(replay.summary, report.summary);
  const frozen = spawnSync(process.execPath, [join(portable, 'reproduce.mjs')], { encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(frozen.status, 0, frozen.stderr);
  const reproduced = JSON.parse(frozen.stdout);
  assert.equal(reproduced.evidence.verified, true); assert.equal(reproduced.portableReplay.modelCalls, 0);
  assert.deepEqual(reproduced.summary, JSON.parse(JSON.stringify(report.summary)));
  assert.deepEqual(packageFiles(f.run).map(path => [path, sha256File(join(f.run, path))]), original);
});

test('Versioned trigger evidence cannot mix protocols, contradict a boolean or invent transcript lines after resealing', async t => {
  const f = await fixture(t); await runEval(f.options);
  const file = join(f.run, 'exact/installed/trial-1/_result.json'), original = readFileSync(file, 'utf8');
  for (const change of [
    (r: Record<string, any>) => { r.triggerDetection.schemaVersion = 3; },
    (r: Record<string, any>) => { delete r.triggerDetection; },
    (r: Record<string, any>) => { r.executor.triggerDetection.schemaVersion = 3; },
    (r: Record<string, any>) => { r.triggered = false; },
    (r: Record<string, any>) => { r.triggerEvidence.eventLines = [999]; },
  ]) {
    const receipt = JSON.parse(original); change(receipt); writeFileSync(file, JSON.stringify(receipt)); reseal(f.run);
    const report = await readEvaluationReport(f.run); assert.equal(report.evidence.verified, false);
    assert.equal(report.acceptance.eligibleForUpgrade, false);
    await assert.rejects(exportEvaluation(f.run, join(f.root, 'invalid'), { yes: true, log: () => {} }), /audit failed/);
  }
  writeFileSync(file, original); reseal(f.run);
  const manifest = JSON.parse(readFileSync(join(f.run, 'manifest.json'), 'utf8'));
  manifest.triggerDetection.schemaVersion = 3;
  const standalone = join(f.root, 'unsupported.json'); writeFileSync(standalone, JSON.stringify(manifest));
  await assert.rejects(readEvaluationReport(standalone), /Unsupported triggerDetection/);
  delete manifest.triggerDetection; delete manifest.experiment;
  writeFileSync(standalone, JSON.stringify(manifest));
  const legacy = await readEvaluationReport(standalone);
  assert.ok('evaluationType' in legacy && legacy.evaluationType === 'trigger');
  assert.equal(legacy.summary?.triggerDetection, null); assert.equal(legacy.summary?.metrics.recall, 1);
  const lines: string[] = []; await runEvalReport(standalone, line => lines.push(line));
  assert.match(lines[0]!, /legacy\/unversioned detection/);
});

test('Claude inject, installed, calibration and judge paths all consume structured text without invented usage', async t => {
  const f = await fixture(t);
  for (const mode of ['inject', 'installed'] as const) {
    const executor = CliExecutor.forAgent('claude-code', mode === 'installed' ? { triggerSkillName: 'review-alias' } : undefined);
    const result = await runEval({ ...f.options, executor, mode, maxCalls: 2, runGroup: mode });
    assert.ok(result && 'overall' in result); assert.equal(result.overall.conditions.baseline.passes, 1);
    assert.equal(result.modelIdentities?.primary?.reported, 2);
    assert.equal(result.overall.conditions.treatment.passes, 1); assert.equal(result.overall.conditions.treatment.tokens, null);
  }
  const ordinary = CliExecutor.forAgent('claude-code');
  await runBenchCheck({ dir: f.bench, calibrate: { executor: ordinary, trials: 1, maxCalls: 1,
    runsRoot: f.options.runsRoot, runGroup: 'calibrate', sessionOptions: f.options.sessionOptions }, log: () => {} });
  const calibration = await readEvaluationReport(join(f.options.runsRoot!, 'calibrate'));
  assert.equal(calibration.modelIdentities?.primary?.reported, 1); assert.equal(calibration.evidence.verified, true, JSON.stringify(calibration.evidence));
  const portableCalibration = join(f.root, 'calibration-portable');
  await exportEvaluation(join(f.options.runsRoot!, 'calibrate'), portableCalibration, { yes: true, log: () => {} });
  renameSync(f.script, f.script + '.hidden');
  try {
    const replayed = await readEvaluationReport(portableCalibration, { replay: true });
    assert.equal(replayed.evidence.verified, true, JSON.stringify(replayed.evidence));
    assert.deepEqual(replayed.modelIdentities, calibration.modelIdentities);
  } finally { renameSync(f.script + '.hidden', f.script); }
  const judged = await runEval({ ...f.options, executor: ordinary, mode: 'inject', judgeExecutor: ordinary, maxCalls: 4, runGroup: 'judged' });
  assert.ok(judged && 'overall' in judged); assert.equal(judged.tasks[0]!.judge?.consistentTrials, 1);
  assert.equal(judged.modelIdentities?.judge?.reported, 2);
  const response = await ordinary.run('CASE negative', f.root);
  assert.equal(response.output, 'skillfit-ok'); assert.equal(response.tokens, undefined); assert.equal(response.skillTriggered, undefined);
});

test('Claude public terminal failure rejects even when its process exits zero, preserving observed positives', async t => {
  const f = await fixture(t);
  await assert.rejects(f.executor.run('CASE failed', f.root), error => {
    assert.ok(error instanceof ExecutorFailure); assert.match(error.message, /synthetic terminal failure/);
    assert.equal(error.result.skillTriggered, true); assert.equal(error.result.triggerEvidence?.complete, false);
    assert.equal(error.result.usageStatus, 'partial'); return true;
  });
});

test('Claude dry-run registers the frozen frontmatter alias without running a CLI or claiming readiness', async t => {
  const f = await fixture(t), headless = getAgent('claude-code').headless;
  // Restore the real command string, then keep PATH empty: only a dry-run may reach this branch.
  headless.streamJson!.argv = ['claude', '-p', '--output-format', 'stream-json', '--verbose'];
  let preview: import("./eval.js").EvalPreview | undefined;
  await runEval({ ...f.options, executor: undefined, dryRun: true, onPlan: value => { preview = value; } });
  assert.ok(preview); assert.deepEqual(preview.triggerDetection?.identities, ['review', 'review-alias']);
  assert.equal(preview.agentPreflight.checks.find(c => c.code === 'MATRIX_CAPABILITY')!.status, 'PASS');
  assert.equal(preview.agentPreflight.checks.find(c => c.code === 'CLI_AVAILABLE')!.status, 'FAIL');
  assert.equal(preview.agentPreflight.checks.find(c => c.code === 'AUTHENTICATION')!.status, 'UNKNOWN');
  assert.deepEqual(preview.agentPreflight.cost, { modelCalls: 0, cliInvocations: 0 });
  assert.equal(existsSync(f.run), false);
  const cli = spawnSync(process.execPath, [fileURLToPath(new URL("./main.js", import.meta.url)), 'eval', f.skill,
    '--bench', f.bench, '--agent', 'claude-code', '--mode', 'trigger', '--trials', '1', '--max-calls', '1',
    '--runs-root', f.options.runsRoot!, '--run-group', 'cli-preview', '--dry-run', '--json'],
  { encoding: 'utf8', env: { ...process.env, HOME: f.home, USERPROFILE: f.home, PATH: '', SKILLFIT_JUDGE: '0' }, timeout: 30_000 });
  assert.equal(cli.status, 0, cli.stderr);
  const planned = JSON.parse(cli.stdout);
  assert.equal(planned.status, 'planned'); assert.equal(planned.plan.evaluation.triggerDetection.schemaVersion, 2);
  assert.equal(planned.plan.evaluation.agentPreflight.checks.find((c: { code: string }) => c.code === 'MATRIX_CAPABILITY').status, 'PASS');
  assert.deepEqual(planned.plan.evaluation.agentPreflight.cost, { modelCalls: 0, cliInvocations: 0 });
  assert.equal(existsSync(join(f.options.runsRoot!, 'cli-preview')), false);
});

test('Kimi factory forwards the matrix wire shape, tool name and identity key to its file-prompt adapter', async t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-kimi-matrix-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const agent = getAgent('kimi-code'), argv = agent.headless.streamJson!.argv, tool = agent.headless.streamJson!.triggerToolName, key = agent.sessions!.skillKey;
  const savedHome = process.env.KIMI_CODE_HOME;
  t.after(() => {
    agent.headless.streamJson!.argv = argv; agent.headless.streamJson!.triggerToolName = tool; agent.sessions!.skillKey = key;
    if (savedHome === undefined) delete process.env.KIMI_CODE_HOME; else process.env.KIMI_CODE_HOME = savedHome;
  });
  process.env.KIMI_CODE_HOME = root;
  agent.headless.streamJson!.triggerToolName = 'InvokeSkill'; agent.sessions!.skillKey = 'id';
  const script = join(root, 'fake-kimi.cjs');
  const events = [{ role: 'assistant', tool_calls: [{ function: { name: 'InvokeSkill', arguments: JSON.stringify({ id: 'review', skill: 'review-extra' }) } }] },
    { role: 'tool', content: 'loaded' }, { role: 'assistant', content: 'done' }];
  writeFileSync(script, `process.stdout.write(${JSON.stringify(events.map(e => JSON.stringify(e)).join('\n'))});`);
  agent.headless.streamJson!.argv = [process.execPath, script, ...argv.slice(1)];
  const executor = CliExecutor.forAgent('kimi-code', { triggerSkillName: 'review' });
  const result = await executor.run('file prompt fixture', root);
  assert.equal(readFileSync(join(root, '_prompt.txt'), 'utf8'), 'file prompt fixture');
  assert.equal(result.output, 'done'); assert.equal(result.skillTriggered, true);
  assert.equal(result.triggerDetection?.wireShape, 'flat-tool-call'); assert.equal(result.triggerEvidence?.complete, true);
  assert.deepEqual(result.triggerEvidence?.eventLines, [1]);
});

test('Explicit disposable install paths are frozen into Codex trigger and installed plans', async t => {
  const f = await fixture(t);
  for (const mode of ['trigger', 'installed'] as const) {
    let preview: import("./eval.js").EvalPreview | undefined;
    await runEval({ ...f.options, agent: 'codex', executor: undefined, mode, skillInstallDir: '.custom-skills',
      dryRun: true, maxCalls: 2, onPlan: value => { preview = value; } });
    assert.ok(preview);
    const declaration = mode === 'trigger' ? preview.triggerDetection : preview.executor?.triggerDetection;
    assert.deepEqual(declaration?.skillPaths, [`.custom-skills/${mode === 'trigger' ? 'review' : 'review-alias'}/SKILL.md`]);
    assert.equal(preview.agentPreflight.cost.cliInvocations, 0);
  }
  assert.equal(existsSync(f.run), false);
});

test('Codex factory uses registered project paths and retains final input, cache and output counters', async t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-codex-matrix-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const agent = getAgent('codex'), argv = agent.headless.streamJson!.argv;
  t.after(() => { agent.headless.streamJson!.argv = argv; });
  const script = join(root, 'fake-codex.cjs');
  const events = [{ type: 'thread.started', thread_id: 'offline' }, { type: 'turn.started' },
    { type: 'item.completed', item: { type: 'command_execution', command: 'cat .agents/skills/review/SKILL.md' } },
    { type: 'item.completed', item: { type: 'agent_message', text: 'done' } },
    { type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 4, output_tokens: 2 } }];
  writeFileSync(script, `process.stdin.resume();process.stdin.on('end',()=>process.stdout.write(${JSON.stringify(events.map(e => JSON.stringify(e)).join('\n'))}));`);
  agent.headless.streamJson!.argv = [process.execPath, script, ...argv.slice(1)];
  const executor = CliExecutor.forAgent('codex', { triggerSkillName: 'review' });
  const result = await executor.run('offline control', root);
  assert.equal(result.output, 'done'); assert.equal(result.skillTriggered, true);
  assert.deepEqual(result.tokens, { input: 10, cachedInput: 4, output: 2 }); assert.equal(result.usageStatus, 'final');
  assert.equal(result.triggerDetection?.method, 'skill-file-read-command'); assert.equal(result.triggerEvidence?.complete, true);
  assert.deepEqual(result.triggerDetection?.skillPaths, agent.skills.projectDirs.map(dir => `${dir}/review/SKILL.md`));
});
