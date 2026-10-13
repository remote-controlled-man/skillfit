import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { loadBench } from './bench.js';
import { collectSkillBundle } from './bundle.js';
import { MockExecutor } from './executors/mock.js';
import { gitInit, runExperiment, runTrial } from './runner.js';
import { ExecutorFailure } from './types.js';
import { parseEvalReport, renderEvalMarkdown } from '../commands/eval-report.js';
const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BUNDLED_CODE_REVIEW = join(PACKAGE_ROOT, 'benches', 'code-review');
function tmp(t, prefix) {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    return dir;
}
function makeSkill(t) {
    const dir = tmp(t, 'skillfit-skill-');
    writeFileSync(join(dir, 'SKILL.md'), '# review discipline\ncheck boundaries and error codes\n');
    return dir;
}
function plan(overrides) {
    return {
        bench: loadBench(BUNDLED_CODE_REVIEW),
        target: collectSkillBundle(makeSkillSync(overrides.runsRoot), 'review-skill'),
        executor: new MockExecutor(),
        trials: 3,
        runGroup: 'test-group',
        ...overrides,
    };
}
let skillCounter = 0;
function makeSkillSync(runsRoot) {
    const dir = join(runsRoot, `skill-${process.pid}-${skillCounter++}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '# review discipline\ncheck boundaries and error codes\n');
    return dir;
}
test('runExperiment pairs baseline/treatment and records everything', async (t) => {
    const runsRoot = tmp(t, 'skillfit-runs-');
    const skillDir = makeSkill(t);
    const manifest = await runExperiment({
        bench: loadBench(BUNDLED_CODE_REVIEW),
        target: collectSkillBundle(skillDir, 'review-skill'),
        executor: new MockExecutor(),
        trials: 3,
        runsRoot,
        runGroup: 'test-group',
    });
    assert.equal(manifest.schemaVersion, 4);
    assert.equal(manifest.tasks.length, 5);
    const task = manifest.tasks[0];
    assert.ok(task);
    assert.equal(task.id, 'review-r1');
    assert.deepEqual({ passes: task.conditions.baseline.passes, trials: task.conditions.baseline.trials }, { passes: 0, trials: 3 });
    assert.deepEqual({ passes: task.conditions.treatment.passes, trials: task.conditions.treatment.trials }, { passes: 3, trials: 3 });
    assert.deepEqual(task.outcomes.baseline, [false, false, false]);
    assert.deepEqual(task.outcomes.treatment, [true, true, true]);
    assert.equal(task.verdict, 'inconclusive');
    assert.match(task.verdictReason, /only 3 discordant pair/);
    assert.deepEqual(task.tokenDelta, { input: 2400, output: 240 });
    assert.equal(task.conditions.treatment.meanScore, 1);
    assert.ok(task.conditions.baseline.meanScore !== null);
    // The mock baseline finds the bare-Error bug but reports the C-style-loop decoy, so it scores 1 of
    // 4 checks: bare-error only. `no-false-positives` is what costs it the fourth.
    assert.ok(Math.abs(task.conditions.baseline.meanScore - 0.25) < 1e-9);
    assert.ok(task.scoreDelta !== null);
    assert.ok(Math.abs(task.scoreDelta - 0.75) < 1e-9);
    assert.deepEqual(task.scores.baseline, [0.25, 0.25, 0.25]);
    assert.deepEqual(task.scores.treatment, [1, 1, 1]);
    assert.deepEqual(task.facets.find((facet) => facet.name === 'discount-boundary'), {
        name: 'discount-boundary',
        baselinePassRate: 0,
        treatmentPassRate: 1,
        baselineTrials: 3,
        treatmentTrials: 3,
    });
    assert.deepEqual(task.facets.find((facet) => facet.name === 'no-false-positives'), {
        name: 'no-false-positives',
        baselinePassRate: 0,
        treatmentPassRate: 1,
        baselineTrials: 3,
        treatmentTrials: 3,
    }, 'reporting a decoy must cost the review a facet, not just get recorded');
    assert.equal(task.verifierNotes.length, 0);
    // summarize-s1 is a negative control whose mock treatment arm slips into review framing and fails,
    // so the pooled run regresses on 3 pairs. Nine improved against three regressed is not significant
    // at this sample size — which is the honest reading, and the point of the task being in the bench.
    assert.equal(manifest.overall.verdict, 'inconclusive');
    assert.deepEqual(manifest.overall.stats.discordant, { improved: 9, regressed: 3 });
    assert.equal(manifest.overall.stats.mcnemarP, 0.14599609375);
    const scoreDeltaCi = manifest.overall.stats.scoreDeltaCi;
    assert.ok(scoreDeltaCi !== null);
    // pooled treatment mean 0.9333 minus pooled baseline mean 0.55 (r1 .25, r2 .5, r3 0, x1 1, s1 1)
    assert.ok(Math.abs(scoreDeltaCi.point - 23 / 60) < 1e-9);
    assert.equal(manifest.target.bundleSha256.length, 64);
    assert.ok(manifest.warnings.some((w) => w.includes('synthetic')));
    assert.ok(manifest.warnings.some((w) => w.includes('"review-r3"') && w.includes('too hard or broken')));
    assert.ok(manifest.warnings.some((w) => w.includes('"explain-x1"') && w.includes('facet "states-purpose"')));
    const trialDir = join(runsRoot, 'test-group', 'review-r1', 'treatment', 'trial-1');
    assert.ok(existsSync(join(runsRoot, 'test-group', 'manifest.json')));
    assert.ok(existsSync(join(trialDir, '_prompt.txt')));
    assert.ok(existsSync(join(trialDir, '_output.md')));
    assert.ok(existsSync(join(trialDir, '_verifier.txt')));
    assert.ok(existsSync(join(trialDir, '_result.json')));
    assert.ok(existsSync(join(trialDir, '.git')), 'run directory is a git repository');
    const treatmentPrompt = readFileSync(join(trialDir, '_prompt.txt'), 'utf8');
    assert.match(treatmentPrompt, /<skill name="review-skill">/);
    assert.match(treatmentPrompt, /--- repository file: src\/order\.js ---/);
    assert.ok(!treatmentPrompt.includes('skillfit-mock'));
    const baselinePrompt = readFileSync(join(runsRoot, 'test-group', 'review-r1', 'baseline', 'trial-1', '_prompt.txt'), 'utf8');
    assert.ok(!baselinePrompt.includes('<skill name='));
    const result = JSON.parse(readFileSync(join(trialDir, '_result.json'), 'utf8'));
    assert.equal(result.schemaVersion, 2);
    assert.equal(result.passed, true);
    assert.equal(result.score, 1);
    assert.equal(result.checks?.length, 4);
    assert.equal(result.gitInitialized, true);
    assert.equal(result.target.bundleSha256, manifest.target.bundleSha256);
    const verifierLog = readFileSync(join(runsRoot, 'test-group', 'review-r1', 'baseline', 'trial-1', '_verifier.txt'), 'utf8');
    assert.match(verifierLog, /"missed":\["discount-boundary","missing-tests"\]/);
    // The mock baseline reports the C-style-loop decoy; it is now scored, not merely recorded.
    assert.match(verifierLog, /"decoys":\["c-style-loop"\]/);
    assert.match(verifierLog, /"name":"no-false-positives","pass":false/);
    assert.match(verifierLog, /"decoys":\["c-style-loop"\]/);
});
test('trial receipts retain monotonic and executor timing without changing paired quality', async (t) => {
    const runsRoot = tmp(t, 'skillfit-timing-receipts-');
    const timing = { clock: 'performance.now', timeoutMs: 600000, heartbeatMs: 1000, anomalyThresholdMs: 5000,
        elapsedMs: 25, wallElapsedMs: 25, maxObservationGapMs: 25, maxClockSkewMs: 0,
        timeoutFiredAfterMs: null, terminationDelayMs: null, anomaly: null };
    const mock = new MockExecutor();
    const clocks = { wall: 100000, mono: 0 };
    const executor = { describe: () => mock.describe(), run: async (...args) => {
            clocks.wall -= 50000;
            clocks.mono += 250;
            return { ...await mock.run(...args), executionTiming: timing };
        } };
    const outcome = await runTrial(plan({ runsRoot, executor, trials: 1,
        clock: { wallNow: () => clocks.wall, monotonicNow: () => clocks.mono } }), 'review-r1', 'baseline', 1);
    const receipt = JSON.parse(readFileSync(join(runsRoot, 'test-group', 'review-r1', 'baseline', 'trial-1', '_result.json'), 'utf8'));
    assert.equal(receipt.timing.clock, 'performance.now');
    assert.deepEqual(receipt.timing.execution, timing);
    assert.equal(receipt.durationSeconds, 0.25);
    assert.equal(receipt.timing.wallDurationSeconds, -50);
    assert.equal(outcome.error, null);
});
test('workspace pairs inspect identical disk inputs without inlining text or binary files', async (t) => {
    const runsRoot = tmp(t, 'skillfit-workspace-');
    const benchDir = join(runsRoot, 'bench');
    for (const rel of ['fixtures/task', 'prompts', 'verifiers'])
        mkdirSync(join(benchDir, rel), { recursive: true });
    writeFileSync(join(benchDir, 'fixtures/task/source.txt'), 'source sentinel: broken');
    writeFileSync(join(benchDir, 'fixtures/task/asset.bin'), Buffer.from([0, 255, 128, 17]));
    writeFileSync(join(benchDir, 'prompts/task.md'), 'Repair source.txt and preserve the asset.');
    writeFileSync(join(benchDir, 'verifiers/check.mjs'), "import {readFileSync} from 'node:fs'; process.exit(readFileSync(process.argv[2]+'/source.txt','utf8')==='fixed' ? 0 : 1);");
    writeFileSync(join(benchDir, 'bench.json'), JSON.stringify({ schemaVersion: 1, name: 'disk-task', tasks: [{
                id: 'task', fixture: 'fixtures/task', prompt: 'prompts/task.md', verifier: 'node verifiers/check.mjs', verifierKind: 'command',
            }] }));
    const prompts = [];
    const executor = {
        describe: () => ({ kind: 'cli', model: 'offline-disk-probe' }),
        run: (prompt, workdir) => {
            prompts.push(prompt);
            assert.equal(readFileSync(join(workdir, 'source.txt'), 'utf8'), 'source sentinel: broken');
            assert.deepEqual(readFileSync(join(workdir, 'asset.bin')), Buffer.from([0, 255, 128, 17]));
            assert.ok(!prompt.includes('source sentinel'));
            assert.ok(!prompt.includes('Repository snapshot:'));
            assert.ok(!prompt.includes('Your final message is the deliverable'));
            writeFileSync(join(workdir, 'source.txt'), 'fixed');
            return Promise.resolve({ output: 'Repaired and checked.' });
        },
    };
    const target = collectSkillBundle(makeSkill(t), 'disk-skill');
    const manifest = await runExperiment({ bench: loadBench(benchDir), target, executor, inputMode: 'workspace',
        trials: 1, runsRoot, runGroup: 'disk-pair' });
    assert.equal(manifest.inputMode, 'workspace');
    assert.equal(manifest.overall.conditions.baseline.passes, 1);
    assert.equal(manifest.overall.conditions.treatment.passes, 1);
    assert.equal(prompts[1], `${prompts[0].trimEnd()}\n\n${target.payload}\n`);
    for (const condition of ['baseline', 'treatment']) {
        const receipt = JSON.parse(readFileSync(join(runsRoot, 'disk-pair/task', condition, 'trial-1/_result.json'), 'utf8'));
        assert.equal(receipt.inputMode, 'workspace');
    }
});
test('workspace runner rejects API access before creating the run group', async (t) => {
    const runsRoot = tmp(t, 'skillfit-workspace-api-');
    const executor = { describe: () => ({ kind: 'api', model: 'offline' }), run: () => { throw new Error('must not run'); } };
    await assert.rejects(() => runExperiment(plan({ runsRoot, inputMode: 'workspace', executor })), /requires a CLI executor/);
    assert.ok(!existsSync(join(runsRoot, 'test-group')));
});
test('token coverage counts usage fields only on surviving graded pairs', async (t) => {
    const runsRoot = tmp(t, 'skillfit-token-coverage-');
    const bench = loadBench(BUNDLED_CODE_REVIEW);
    bench.tasks = bench.tasks.slice(0, 1);
    let calls = 0;
    const executor = {
        describe: () => ({ kind: 'mock', model: 'offline-usage' }),
        run: () => Promise.resolve({ output: 'No findings', tokens: ++calls === 1 ? { input: 10 } : undefined }),
    };
    const manifest = await runExperiment(plan({ runsRoot, bench, executor, trials: 1 }));
    assert.deepEqual(manifest.overall.conditions.baseline.tokenCoverage, { input: 1, output: 0 });
    assert.deepEqual(manifest.overall.conditions.treatment.tokenCoverage, { input: 0, output: 0 });
});
test('runExperiment preserves failure costs and distinguishes invocations from guard refusals', async (t) => {
    const runsRoot = tmp(t, 'skillfit-failure-costs-');
    const benchDir = join(runsRoot, 'bench');
    for (const dir of ['fixtures/t1', 'prompts', 'verifiers'])
        mkdirSync(join(benchDir, dir), { recursive: true });
    writeFileSync(join(benchDir, 'fixtures/t1/input.txt'), 'input');
    writeFileSync(join(benchDir, 'prompts/t1.md'), 'Solve the task.');
    writeFileSync(join(benchDir, 'verifiers/t1.mjs'), 'import { readFileSync } from "node:fs"; process.exit(readFileSync(process.argv[2]+"/_output.md","utf8")==="pass"?0:1);');
    writeFileSync(join(benchDir, 'bench.json'), JSON.stringify({ schemaVersion: 1, tasks: [{ id: 't1', fixture: 'fixtures/t1', prompt: 'prompts/t1.md', verifier: 'node verifiers/t1.mjs', verifierKind: 'output' }] }));
    let calls = 0;
    const executor = { describe: () => ({ kind: 'mock', model: 'cost-fixture' }), run: async () => {
            calls++;
            if (calls === 4)
                throw new ExecutorFailure('timeout', { output: 'unfinished', rawOutput: 'public partial transcript', tokens: { input: 3, cachedInput: 2, output: 1 }, usageStatus: 'partial' });
            if (calls >= 5)
                throw new ExecutorFailure('stopped before call', { output: '' }, false);
            return { output: calls === 2 ? 'fail' : 'pass', tokens: { input: 10, cachedInput: 8, output: 2 } };
        } };
    const manifest = await runExperiment(plan({ runsRoot, bench: loadBench(benchDir), executor, trials: 3 }));
    const costs = manifest.overall.costs;
    assert.equal(manifest.overall.conditions.baseline.trials, 1);
    assert.equal(manifest.overall.conditions.treatment.passes, 0);
    assert.equal(costs.attempts.baseline.passes, 2);
    assert.equal(costs.attempts.treatment.runs, 2);
    assert.equal(costs.attempts.treatment.metrics.input.knownTotal, 13);
    assert.deepEqual(costs.attempts.treatment.metrics.input.coverage, { final: 1, partial: 1, unknown: 0 });
    assert.deepEqual(costs.notInvoked, { baseline: 1, treatment: 1 });
    const receipt = JSON.parse(readFileSync(join(runsRoot, 'test-group/t1/treatment/trial-2/_result.json'), 'utf8'));
    assert.equal(receipt.executorInvoked, true);
    assert.equal(receipt.usageStatus, 'partial');
    assert.deepEqual(receipt.tokens, { input: 3, cachedInput: 2, output: 1 });
    assert.equal(readFileSync(join(runsRoot, 'test-group/t1/treatment/trial-2/_transcript.jsonl'), 'utf8'), 'public partial transcript');
    assert.match(renderEvalMarkdown(parseEvalReport(manifest)), /All agent executor invocations/);
});
test('runExperiment applies workspace config after snapshotting so prompts stay identical', async (t) => {
    const runsRoot = tmp(t, 'skillfit-config-runs-');
    const benchDir = join(runsRoot, 'bench');
    mkdirSync(join(benchDir, 'fixtures', 't1'), { recursive: true });
    mkdirSync(join(benchDir, 'prompts'), { recursive: true });
    mkdirSync(join(benchDir, 'verifiers'), { recursive: true });
    writeFileSync(join(benchDir, 'fixtures', 't1', 'input.txt'), 'same task input\n');
    writeFileSync(join(benchDir, 'prompts', 't1.md'), 'Use the available project tools and say whether config was active.\n');
    writeFileSync(join(benchDir, 'verifiers', 't1.mjs'), "import { readFileSync } from 'node:fs'; process.exit(readFileSync(process.argv[2] + '/_output.md', 'utf8').includes('configured') ? 0 : 1);\n");
    writeFileSync(join(benchDir, 'bench.json'), JSON.stringify({
        schemaVersion: 1,
        tasks: [{ id: 't1', fixture: 'fixtures/t1', prompt: 'prompts/t1.md', verifier: 'node verifiers/t1.mjs', verifierKind: 'output' }],
    }));
    const treatment = join(runsRoot, 'experiment', 'treatment');
    mkdirSync(join(treatment, '.codex'), { recursive: true });
    writeFileSync(join(treatment, '.codex', 'config.toml'), '[mcp_servers.demo]\ncommand = "demo"\n');
    const target = {
        kind: 'mcp',
        name: 'demo-mcp',
        sourceDir: join(runsRoot, 'experiment'),
        files: ['treatment/.codex/config.toml'],
        sha256: 'c'.repeat(64),
        payload: null,
        overlays: { treatment },
    };
    const executor = {
        describe: () => ({ kind: 'cli', model: 'workspace-probe' }),
        run: (_prompt, workdir) => Promise.resolve({
            output: existsSync(join(workdir, '.codex', 'config.toml')) ? 'configured' : 'plain',
        }),
    };
    const manifest = await runExperiment({
        bench: loadBench(benchDir),
        target,
        executor,
        trials: 1,
        runsRoot,
        runGroup: 'config-group',
    });
    assert.equal(manifest.target.kind, 'mcp');
    assert.equal(manifest.tasks[0]?.conditions.baseline.passes, 0);
    assert.equal(manifest.tasks[0]?.conditions.treatment.passes, 1);
    const baselineDir = join(runsRoot, 'config-group', 't1', 'baseline', 'trial-1');
    const treatmentDir = join(runsRoot, 'config-group', 't1', 'treatment', 'trial-1');
    assert.ok(!existsSync(join(baselineDir, '.codex', 'config.toml')));
    assert.ok(existsSync(join(treatmentDir, '.codex', 'config.toml')));
    assert.equal(readFileSync(join(baselineDir, '_prompt.txt'), 'utf8'), readFileSync(join(treatmentDir, '_prompt.txt'), 'utf8'), 'only workspace configuration may differ between paired arms');
    const prompt = readFileSync(join(treatmentDir, '_prompt.txt'), 'utf8');
    assert.ok(!prompt.includes('mcp_servers.demo'));
    assert.match(prompt, /inspect, edit, and run things there directly/);
    assert.ok(!prompt.includes('Do not use tools'));
});
test('runExperiment keeps executor errors as failed trials instead of crashing', async (t) => {
    const runsRoot = tmp(t, 'skillfit-runs-');
    const failing = {
        describe: () => ({ kind: 'cli', model: 'broken' }),
        run: () => Promise.reject(new Error('agent exploded')),
    };
    const manifest = await runExperiment({
        bench: loadBench(BUNDLED_CODE_REVIEW),
        target: collectSkillBundle(makeSkill(t)),
        executor: failing,
        trials: 1,
        runsRoot,
        runGroup: 'test-group',
    });
    const task = manifest.tasks[0];
    assert.ok(task);
    assert.equal(task.conditions.baseline.passes, 0);
    assert.equal(task.conditions.treatment.passes, 0);
    assert.equal(manifest.overall.verdict, 'inconclusive');
    const errorFile = join(runsRoot, 'test-group', 'review-r1', 'baseline', 'trial-1', '_executor-error.txt');
    assert.match(readFileSync(errorFile, 'utf8'), /agent exploded/);
});
test('runExperiment marks verdicts inconclusive when discordant pairs are too few', async (t) => {
    const runsRoot = tmp(t, 'skillfit-runs-');
    const manifest = await runExperiment(plan({ runsRoot, trials: 1 }));
    const task = manifest.tasks[0];
    assert.ok(task);
    assert.equal(task.verdict, 'inconclusive');
    assert.match(task.verdictReason, /only 1 discordant pair/);
});
test('runExperiment warns when the baseline already passes (bench too easy)', async (t) => {
    const runsRoot = tmp(t, 'skillfit-runs-');
    const benchDir = join(runsRoot, 'easy-bench');
    mkdirSync(join(benchDir, 'fixtures', 't1'), { recursive: true });
    mkdirSync(join(benchDir, 'prompts'), { recursive: true });
    mkdirSync(join(benchDir, 'verifiers'), { recursive: true });
    writeFileSync(join(benchDir, 'fixtures', 't1', 'index.txt'), 'x\n');
    writeFileSync(join(benchDir, 'fixtures', 't1', '.skillfit-mock.json'), JSON.stringify({ baseline: { output: 'ok' }, treatment: { output: 'ok' } }));
    writeFileSync(join(benchDir, 'prompts', 't1.md'), 'do it\n');
    writeFileSync(join(benchDir, 'verifiers', 't1.mjs'), 'console.log("{\\"passed\\":true}");\n');
    writeFileSync(join(benchDir, 'bench.json'), JSON.stringify({
        schemaVersion: 1,
        tasks: [{ id: 't1', fixture: 'fixtures/t1', prompt: 'prompts/t1.md', verifier: 'node verifiers/t1.mjs' }],
    }));
    const manifest = await runExperiment({
        bench: loadBench(benchDir),
        target: collectSkillBundle(makeSkill(t)),
        executor: new MockExecutor(),
        trials: 3,
        runsRoot,
        runGroup: 'test-group',
    });
    assert.equal(manifest.overall.verdict, 'inconclusive');
    assert.ok(manifest.warnings.some((w) => w.includes('"t1"') && w.includes('too easy')));
});
test('runExperiment refuses to reuse an existing run group', async (t) => {
    const runsRoot = tmp(t, 'skillfit-runs-');
    const base = plan({ runsRoot });
    await runExperiment(base);
    await assert.rejects(() => runExperiment(base), /already exists/);
});
test('runExperiment validates the run group name', async (t) => {
    const runsRoot = tmp(t, 'skillfit-runs-');
    await assert.rejects(() => runExperiment(plan({ runsRoot, runGroup: '../evil' })), /Invalid run group/);
});
test('runExperiment validates trials', async (t) => {
    const runsRoot = tmp(t, 'skillfit-runs-');
    await assert.rejects(() => runExperiment(plan({ runsRoot, trials: 0 })), /trials must be/);
});
test('runExperiment aggregates blind judge scores per task', async (t) => {
    const runsRoot = tmp(t, 'skillfit-runs-');
    const judge = {
        describe: () => ({ kind: 'api', model: 'judge-model' }),
        run: () => Promise.resolve({
            output: '{"A": {"correct":true,"complete":true,"grounded":true}, "B": {"correct":false,"complete":false,"grounded":false}}',
        }),
    };
    const manifest = await runExperiment({ ...plan({ runsRoot }), judge });
    const task = manifest.tasks[0];
    assert.ok(task);
    assert.ok(task.judge);
    assert.equal(task.judge?.judgedTrials, 3);
    assert.equal(task.judge?.consistentTrials, 0, 'a judge that always favors A is inconsistent');
    assert.equal(task.judge?.baselineMean, null);
    assert.equal(task.judge?.treatmentMean, null);
    assert.equal(manifest.judge?.model, 'judge-model');
    assert.ok(existsSync(join(runsRoot, 'test-group', 'review-r1', 'judge-trial-1.json')));
});
test('runExperiment never runs the judge inside the run group', async (t) => {
    const runsRoot = tmp(t, 'skillfit-runs-judgecwd-');
    const cwds = [];
    const listings = [];
    const judge = {
        describe: () => ({ kind: 'api', model: 'judge-model' }),
        run: (_prompt, workdir) => {
            cwds.push(workdir);
            listings.push(readdirSync(workdir).sort());
            return Promise.resolve({
                output: '{"A": {"correct":true,"complete":true,"grounded":true}, "B": {"correct":false,"complete":false,"grounded":false}}',
            });
        },
    };
    await runExperiment({ ...plan({ runsRoot }), judge, trials: 1 });
    const groupDir = join(runsRoot, 'test-group');
    assert.ok(cwds.length > 0, 'the judge ran');
    cwds.forEach((cwd, index) => {
        assert.ok(!cwd.startsWith(groupDir), `judge call ${index} ran inside the run group (${cwd}), where both arms and their _result.json live`);
        assert.deepEqual(listings[index], ['answerA.md', 'answerB.md']);
    });
    // The transcript is still written to the task directory, after the call rather than around it.
    assert.ok(existsSync(join(groupDir, 'review-r1', 'judge-trial-1.json')));
});
test('runExperiment averages judge scores only over consistent trials', async (t) => {
    const runsRoot = tmp(t, 'skillfit-runs-');
    const judge = {
        describe: () => ({ kind: 'api', model: 'judge-model' }),
        run: (prompt) => {
            const aIndex = prompt.indexOf('Answer A:');
            const bIndex = prompt.indexOf('Answer B:');
            const aIsTreatment = prompt.slice(aIndex, bIndex).includes('bulk discount');
            const win = '{"correct":true,"complete":true,"grounded":true}';
            const partial = '{"correct":true,"complete":false,"grounded":true}';
            return Promise.resolve({ output: aIsTreatment ? `{"A": ${win}, "B": ${partial}}` : `{"A": ${partial}, "B": ${win}}` });
        },
    };
    const manifest = await runExperiment({ ...plan({ runsRoot }), judge });
    const task = manifest.tasks[0];
    assert.ok(task?.judge);
    assert.equal(task.judge?.judgedTrials, 3);
    assert.equal(task.judge?.consistentTrials, 3);
    assert.equal(task.judge?.baselineMean, 2);
    assert.equal(task.judge?.treatmentMean, 3);
});
test('runExperiment strips the mock marker for non-mock executors', async (t) => {
    const runsRoot = tmp(t, 'skillfit-runs-');
    const fake = {
        describe: () => ({ kind: 'api', model: 'fake' }),
        run: () => Promise.resolve({ output: 'nothing useful' }),
    };
    await runExperiment({ ...plan({ runsRoot, trials: 1 }), executor: fake });
    const runDir = join(runsRoot, 'test-group', 'review-r1', 'baseline', 'trial-1');
    assert.ok(!existsSync(join(runDir, '.skillfit-mock.json')));
});
test('gitInit initializes a real repository', async (t) => {
    const dir = tmp(t, 'skillfit-git-');
    writeFileSync(join(dir, 'file.txt'), 'x\n');
    const ok = await gitInit(dir);
    assert.equal(ok, true);
    assert.ok(existsSync(join(dir, '.git')));
});
test('runExperiment drops an errored trial from both arms instead of scoring it as a failure', async (t) => {
    const runsRoot = tmp(t, 'skillfit-runs-errored-');
    const inner = new MockExecutor();
    const flaky = {
        // Must report kind 'mock': runTrial deletes .skillfit-mock.json for any other kind, which
        // would starve the delegate and fail both arms for the wrong reason.
        describe: () => inner.describe(),
        run: (prompt, workdir) => {
            const tail = workdir.split(/[\\/]/).slice(-2).join('/');
            if (tail === 'baseline/trial-2') {
                return Promise.reject(new Error('simulated API timeout'));
            }
            return inner.run(prompt, workdir);
        },
    };
    const manifest = await runExperiment(plan({ runsRoot, executor: flaky }));
    const task = manifest.tasks[0];
    assert.ok(task);
    assert.equal(task.id, 'review-r1');
    assert.equal(task.conditions.baseline.errors, 1);
    assert.equal(task.conditions.treatment.errors, 0);
    assert.equal(task.conditions.baseline.trials, 2);
    assert.equal(task.conditions.treatment.trials, 2, 'the paired treatment trial is dropped too');
    assert.equal(task.outcomes.baseline.length, 2);
    assert.equal(task.outcomes.treatment.length, 2);
    assert.equal(task.scores.baseline.length, 2);
    assert.equal(task.scores.treatment.length, 2);
    // Five tasks x two surviving pairs. review-r1/r2/r3 improve (6 discordant), explain-x1 passes in
    // both arms so its 2 pairs are concordant, and summarize-s1 regresses (2 more). Before the fix the
    // errored baseline trial counted as a failure, which also flipped explain-x1's pairs to "improved"
    // and inflated the count — a timeout masquerading as a result.
    assert.deepEqual(manifest.overall.stats.discordant, { improved: 6, regressed: 2 });
    assert.equal(manifest.overall.conditions.baseline.errors, 5);
    assert.equal(manifest.overall.conditions.baseline.trials, 10);
    assert.equal(manifest.overall.conditions.treatment.trials, 10);
    assert.equal(manifest.overall.verdict, 'inconclusive', 'the hole must not manufacture the significance a real effect would need');
    assert.ok(manifest.warnings.some((w) => w.includes('"review-r1" (baseline)') && w.includes('executor, verifier, or engagement error')), 'the exclusion is surfaced, not silent');
});
test('runExperiment excludes a trial whose verifier could not be spawned', async (t) => {
    const runsRoot = tmp(t, 'skillfit-runs-nospawn-');
    const benchDir = tmp(t, 'skillfit-bench-nospawn-');
    cpSync(BUNDLED_CODE_REVIEW, benchDir, { recursive: true });
    const benchJson = JSON.parse(readFileSync(join(benchDir, 'bench.json'), 'utf8'));
    const broken = benchJson.tasks[0];
    assert.ok(broken);
    // Swap only the executable, so the path token still resolves: this is the shape a Windows author
    // hits with `"verifier": "npm test"` (ENOENT) or a `.cmd` wrapper (EINVAL). There is no exit code,
    // so there is no verdict — and "no verdict" used to be recorded as the agent failing the task.
    broken.verifier = `no-such-verifier-binary ${broken.verifier.split(/\s+/).slice(1).join(' ')}`;
    writeFileSync(join(benchDir, 'bench.json'), `${JSON.stringify(benchJson, null, 2)}\n`);
    const manifest = await runExperiment({
        bench: loadBench(benchDir),
        target: collectSkillBundle(makeSkillSync(runsRoot), 'review-skill'),
        executor: new MockExecutor(),
        trials: 1,
        runsRoot,
        runGroup: 'test-group',
    });
    const task = manifest.tasks[0];
    assert.ok(task);
    assert.equal(task.id, broken.id);
    assert.equal(task.conditions.baseline.errors, 1);
    assert.equal(task.conditions.baseline.passes, 0);
    assert.equal(task.conditions.baseline.trials, 0, 'an unrunnable verifier grades nothing');
    assert.equal(task.conditions.treatment.trials, 0, 'and its paired arm is dropped with it');
    assert.ok(manifest.warnings.some((w) => w.includes(`"${broken.id}" (baseline)`) && w.includes('executor, verifier, or engagement error')), 'the exclusion is surfaced, not silent');
    const result = JSON.parse(readFileSync(join(runsRoot, 'test-group', broken.id, 'baseline', 'trial-1', '_result.json'), 'utf8'));
    assert.equal(result.passed, false);
    assert.equal(result.verifierExitCode, null);
    assert.match(result.error ?? '', /verifier could not be started/);
    assert.match(result.error ?? '', /spawned without a shell/);
});
test('runExperiment interleaves conditions within each trial and records sampling', async (t) => {
    const runsRoot = tmp(t, 'skillfit-runs-order-');
    const inner = new MockExecutor();
    const order = [];
    const spy = {
        describe: () => inner.describe(),
        run: (prompt, workdir) => {
            order.push(workdir.split(/[\\/]/).slice(-3).join('/'));
            return inner.run(prompt, workdir);
        },
    };
    const manifest = await runExperiment(plan({ runsRoot, executor: spy, trials: 2 }));
    assert.deepEqual(order.slice(0, 4), [
        'review-r1/baseline/trial-1',
        'review-r1/treatment/trial-1',
        'review-r1/baseline/trial-2',
        'review-r1/treatment/trial-2',
    ], 'the two arms of a pair must run adjacently; all-baselines-first confounds condition with elapsed time');
    assert.equal(manifest.executor.sampling, null, 'the matrix CLIs expose no seed or temperature knob, and the manifest says so rather than implying one');
});
function outputBench(root, kind) {
    for (const rel of ['fixtures/task', 'prompts', 'verifiers'])
        mkdirSync(join(root, rel), { recursive: true });
    writeFileSync(join(root, 'fixtures/task/source.txt'), 'broken');
    writeFileSync(join(root, 'prompts/task.md'), 'Fix it.');
    const verifier = kind === 'output'
        ? "import {readFileSync} from 'node:fs'; const out = readFileSync(process.argv[2]+'/_output.md','utf8'); const scored = out.includes('score'); const high = out.includes('high'); if (!scored) { console.log('unscored'); process.exit(out.includes('ok') ? 0 : 1); } console.log(JSON.stringify({passed: high, checks:[{name:'a',pass:high},{name:'b',pass:high}]})); process.exit(high ? 0 : 1);"
        : "import {readFileSync} from 'node:fs'; process.exit(readFileSync(process.argv[2]+'/source.txt','utf8')==='fixed' ? 0 : 1);";
    writeFileSync(join(root, 'verifiers/check.mjs'), verifier);
    writeFileSync(join(root, 'bench.json'), JSON.stringify({
        schemaVersion: 1, name: 'engagement', tasks: [{
                id: 'task', fixture: 'fixtures/task', prompt: 'prompts/task.md', verifier: 'node verifiers/check.mjs', verifierKind: kind,
            }],
    }));
}
test('empty output is an engagement error for an output task', async (t) => {
    const runsRoot = tmp(t, 'skillfit-engage-');
    const benchDir = join(runsRoot, 'bench');
    outputBench(benchDir, 'output');
    const executor = { describe: () => ({ kind: 'cli', model: 'silent' }), run: () => Promise.resolve({ output: '   \n' }) };
    const manifest = await runExperiment({
        bench: loadBench(benchDir), target: collectSkillBundle(makeSkill(t), 's'), executor, trials: 1, runsRoot, runGroup: 'silent',
    });
    assert.equal(manifest.overall.conditions.baseline.trials, 0);
    assert.equal(manifest.overall.conditions.baseline.errors, 1);
    assert.equal(manifest.overall.conditions.baseline.passes, 0);
    const receipt = JSON.parse(readFileSync(join(runsRoot, 'silent/task/baseline/trial-1/_result.json'), 'utf8'));
    assert.match(receipt.error, /engagement error/);
    assert.equal(existsSync(join(runsRoot, 'silent/task/baseline/trial-1/_verifier.txt')), false);
});
test('a command task with an empty message still counts when the fixture changed', async (t) => {
    const runsRoot = tmp(t, 'skillfit-engage-edit-');
    const benchDir = join(runsRoot, 'bench');
    outputBench(benchDir, 'command');
    const executor = {
        describe: () => ({ kind: 'cli', model: 'editor' }),
        run: (_prompt, workdir) => {
            writeFileSync(join(workdir, 'source.txt'), 'fixed');
            return Promise.resolve({ output: '' });
        },
    };
    const manifest = await runExperiment({
        bench: loadBench(benchDir), target: collectSkillBundle(makeSkill(t), 's'), executor, trials: 1, runsRoot, runGroup: 'edited',
    });
    assert.equal(manifest.overall.conditions.baseline.passes, 1);
    assert.equal(manifest.overall.conditions.baseline.errors, 0);
});
test('a command task that changes nothing is an engagement error', async (t) => {
    const runsRoot = tmp(t, 'skillfit-engage-idle-');
    const benchDir = join(runsRoot, 'bench');
    outputBench(benchDir, 'command');
    const executor = { describe: () => ({ kind: 'cli', model: 'idle' }), run: () => Promise.resolve({ output: '' }) };
    const manifest = await runExperiment({
        bench: loadBench(benchDir), target: collectSkillBundle(makeSkill(t), 's'), executor, trials: 1, runsRoot, runGroup: 'idle',
    });
    assert.equal(manifest.overall.conditions.baseline.trials, 0);
    assert.equal(manifest.overall.conditions.baseline.errors, 1);
});
test('Δscore drops a trial unless both arms produced a score', async (t) => {
    const runsRoot = tmp(t, 'skillfit-score-pair-');
    const benchDir = join(runsRoot, 'bench');
    outputBench(benchDir, 'output');
    let call = 0;
    const executor = {
        describe: () => ({ kind: 'cli', model: 'scorer' }),
        run: () => {
            call += 1;
            const output = call === 1 ? 'score low' : call === 4 ? 'score high' : 'plain';
            return Promise.resolve({ output });
        },
    };
    const manifest = await runExperiment({
        bench: loadBench(benchDir), target: collectSkillBundle(makeSkill(t), 's'), executor, trials: 2, runsRoot, runGroup: 'scores',
    });
    assert.equal(manifest.tasks[0]?.scoreDelta, null);
    assert.equal(manifest.overall.scoreDelta, null);
});
