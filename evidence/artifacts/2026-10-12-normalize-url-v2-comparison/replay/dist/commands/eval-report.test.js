import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseEvalReport, renderEvalMarkdown, runEvalReport } from './eval-report.js';
import { summarizeCosts } from '../harness/costs.js';
function manifest() {
    const conditions = {
        baseline: { passes: 0, trials: 2, errors: 0 },
        treatment: { passes: 2, trials: 2, errors: 0 },
    };
    return {
        schemaVersion: 4,
        runGroup: 'eval-20261001-123000',
        createdAt: '2026-10-01T12:30:00.000Z',
        target: { kind: 'skill', name: 'test | Skill', bundleSha256: 'a'.repeat(64) },
        bench: { name: 'one-task', contentSha256: 'b'.repeat(64), taskCount: 1 },
        executor: { kind: 'mock', model: 'mock' },
        trials: 2,
        tasks: [{ id: 'task-1', conditions, deltaPassRate: 1, verdict: 'inconclusive' }],
        overall: {
            conditions,
            deltaPassRate: 1,
            verdict: 'inconclusive',
            verdictReason: 'only 2 discordant pairs',
            stats: {
                discordant: { improved: 2, regressed: 0 },
                mcnemarP: 0.5,
                deltaCi: { lo: 0.2, hi: 1, resamples: 1000 },
            },
        },
        warnings: ['Only two pairs: indicative.', 'Avoid <private> details.'],
    };
}
function sixPairManifest() {
    const value = manifest();
    const conditions = {
        baseline: { passes: 3, trials: 6, errors: 0 },
        treatment: { passes: 6, trials: 6, errors: 0 },
    };
    value['trials'] = 6;
    const task = value['tasks'][0];
    Object.assign(task, { conditions, deltaPassRate: 0.5 });
    const overall = value['overall'];
    Object.assign(overall, { conditions, deltaPassRate: 0.5, verdictReason: 'only 3 discordant pairs' });
    Object.assign(overall['stats'], {
        discordant: { improved: 3, regressed: 0 },
        mcnemarP: 0.25,
    });
    return value;
}
function costManifest() {
    const value = manifest();
    value['trials'] = 3;
    const run = (input, passed) => ({ executorInvoked: true, passed, error: null,
        durationSeconds: 5, tokens: { input, cachedInput: input / 2, output: 2 }, usageStatus: 'final' });
    const baseline = [run(10, true), run(10, true), run(10, true)];
    const treatment = [run(8, true), run(8, false), { ...run(3, false), durationSeconds: 600, error: 'timeout', usageStatus: 'partial' }];
    const costs = summarizeCosts({ baseline, treatment }, { baseline: baseline.slice(0, 2), treatment: treatment.slice(0, 2) });
    const conditions = { baseline: { passes: 2, trials: 2, errors: 0 }, treatment: { passes: 1, trials: 2, errors: 1 } };
    const task = value['tasks'][0];
    Object.assign(task, { costs: structuredClone(costs), conditions, deltaPassRate: -0.5 });
    const overall = value['overall'];
    Object.assign(overall, { costs: structuredClone(costs), conditions, deltaPassRate: -0.5 });
    Object.assign(overall['stats'], { discordant: { improved: 0, regressed: 1 }, mcnemarP: 1 });
    return value;
}
test('report eval renders cache partitions, per-success regressions and timeout lower bounds', () => {
    const output = renderEvalMarkdown(parseEvalReport(costManifest()));
    assert.match(output, /Input tokens \| 20 \| 16 \| -20.0% \| 10.000 \/ 16.000 \| \+60.0%/);
    assert.match(output, /Input tokens \| 30 \| >= 19 \| n\/a \| 10.000 \/ >= 19.000 \| n\/a/);
    assert.match(output, /Cached input tokens/);
    assert.match(output, /Uncached input tokens/);
    assert.match(output, /Elapsed seconds/);
    assert.match(output, /3\/0\/0 \/ 2\/1\/0/);
    assert.match(output, /Overall verdict: \*\*inconclusive\*\*/);
});
test('report eval rejects contradictory cost counts, coverage, partitions and pooled totals', () => {
    const scenarios = [
        (costs) => { costs.paired.baseline.passes = 0; },
        (costs) => { costs.attempts.treatment.metrics.input.coverage.unknown = 3; },
        (costs) => { costs.attempts.treatment.metrics.cachedInput.knownTotal = 100; },
        (costs) => { costs.attempts.baseline.metrics.output.knownTotal = 99; },
        (costs) => { costs.notInvoked.baseline = 1; },
    ];
    for (const change of scenarios) {
        const value = costManifest();
        change(value['overall']['costs']);
        assert.throws(() => parseEvalReport(value), /costs|cache partition/);
    }
});
test('report eval keeps legacy manifests readable and does not infer missing cache usage', () => {
    const output = renderEvalMarkdown(parseEvalReport(manifest()));
    assert.match(output, /all-invocation costs were not recorded in this legacy manifest/);
    assert.ok(!output.includes('| Cached input tokens | 0'));
});
test('report eval renders a v4 manifest without executing an agent or writing a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skillfit-eval-report-'));
    try {
        const path = join(dir, 'manifest.json');
        const original = `${JSON.stringify(manifest(), null, 2)}\n`;
        writeFileSync(path, original);
        const output = [];
        runEvalReport(path, (line) => output.push(line));
        assert.equal(readFileSync(path, 'utf8'), original);
        assert.equal(output.length, 1);
        const markdown = output[0] ?? '';
        assert.match(markdown, /# skillfit evaluation: test \\\| Skill/);
        assert.match(markdown, /Synthetic harness run/);
        assert.match(markdown, /\| task-1 \| 0\/2 \(0%\) \| 2\/2 \(100%\) \| 0\/0 \| \+100\.0pp \| inconclusive \|/);
        assert.match(markdown, /McNemar exact p=0\.5000/);
        assert.match(markdown, /\[\+20\.0pp, \+100\.0pp\]/);
        assert.match(markdown, /below the conclusive bar \(8 tasks × 5 trials\)/);
        assert.match(markdown, /&lt;private&gt;/);
        assert.ok(!markdown.includes(dir), 'the portable report must not include the local manifest directory');
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
test('report eval refuses old and incomplete manifests instead of guessing metrics', () => {
    assert.throws(() => parseEvalReport({ ...manifest(), schemaVersion: 3 }), /Only evaluation manifest schemaVersion 4/);
    const missing = manifest();
    delete missing['overall'];
    assert.throws(() => parseEvalReport(missing), /overall must be an object/);
    const wrongCount = manifest();
    wrongCount['bench'] = { name: 'one-task', contentSha256: 'b'.repeat(64), taskCount: 2 };
    assert.throws(() => parseEvalReport(wrongCount), /taskCount must match/);
    const wrongVerdict = manifest();
    wrongVerdict['overall']['verdict'] = 'effective';
    assert.throws(() => parseEvalReport(wrongVerdict), /disagrees with the metrics protocol/);
    const impossiblePairs = manifest();
    const impossibleStats = impossiblePairs['overall']['stats'];
    impossibleStats['discordant'] = { improved: 3, regressed: 0 };
    assert.throws(() => parseEvalReport(impossiblePairs), /exceeds the number of paired trials/);
});
test('report eval rejects discordant counts that contradict the marginal pass difference', () => {
    const value = sixPairManifest();
    const overall = value['overall'];
    overall['verdict'] = 'effective';
    overall['verdictReason'] = '6 improvements, no regressions';
    Object.assign(overall['stats'], {
        discordant: { improved: 6, regressed: 0 },
        mcnemarP: 0.03125,
    });
    const original = JSON.stringify(value);
    assert.throws(() => parseEvalReport(value), /discordant\.improved - regressed disagrees with treatment\.passes - baseline\.passes/);
    assert.equal(JSON.stringify(value), original, 'contradictory counts must not be silently corrected');
});
for (const { passes, sharedOutcome } of [
    { passes: 1, sharedOutcome: 'success' },
    { passes: 5, sharedOutcome: 'failure' },
]) {
    test(`report eval rejects negative shared ${sharedOutcome} counts despite a matching pass difference`, () => {
        const value = sixPairManifest();
        const task = value['tasks'][0];
        const overall = value['overall'];
        const conditions = task['conditions'];
        conditions['baseline']['passes'] = passes;
        conditions['treatment']['passes'] = passes;
        task['deltaPassRate'] = 0;
        overall['deltaPassRate'] = 0;
        Object.assign(overall['stats'], {
            discordant: { improved: 2, regressed: 2 },
            mcnemarP: 1,
        });
        assert.throws(() => parseEvalReport(value), new RegExp(`discordant implies a negative shared ${sharedOutcome} count`));
    });
}
test('report eval accepts the valid six-pair counterpart as inconclusive without changing its data', () => {
    const value = sixPairManifest();
    const original = JSON.stringify(value);
    const report = parseEvalReport(value);
    assert.equal(report.overall.improved, 3);
    assert.equal(report.overall.regressed, 0);
    assert.equal(report.overall.mcnemarP, 0.25);
    assert.equal(report.overall.verdict, 'inconclusive');
    assert.match(renderEvalMarkdown(report), /McNemar exact p=0\.2500/);
    assert.equal(JSON.stringify(value), original);
});
test('report eval renders missing CI and zero graded trials explicitly', () => {
    const value = manifest();
    const overall = value['overall'];
    const stats = overall['stats'];
    stats['deltaCi'] = null;
    stats['discordant'] = { improved: 0, regressed: 0 };
    stats['mcnemarP'] = 1;
    const conditions = {
        baseline: { passes: 0, trials: 0, errors: 2 },
        treatment: { passes: 0, trials: 0, errors: 2 },
    };
    overall['conditions'] = conditions;
    overall['deltaPassRate'] = 0;
    value['tasks'][0]['conditions'] = conditions;
    value['tasks'][0]['deltaPassRate'] = 0;
    const markdown = renderEvalMarkdown(parseEvalReport(value));
    assert.match(markdown, /0\/0 \(n\/a\)/);
    assert.match(markdown, /Δpass 95% CI: n\/a \(no graded pairs\)/);
});
test('report eval escapes Markdown links supplied by manifest fields', () => {
    const value = manifest();
    value['target']['name'] = '[click](https://example.com)';
    const markdown = renderEvalMarkdown(parseEvalReport(value));
    assert.match(markdown, /# skillfit evaluation: \\\[click\\\]\(https:\/\/example\.com\)/);
    assert.ok(!markdown.includes('# skillfit evaluation: [click]('));
});
test('real reports show facets, bounded decisions and partial token coverage', () => {
    const value = manifest();
    value['executor'] = { kind: 'cli', model: 'cli-configured' };
    value['inputMode'] = 'workspace';
    const task = value['tasks'][0];
    const conditions = task['conditions'];
    Object.assign(conditions['baseline'], { meanScore: 0.5, tokens: { input: 40, output: 2 }, tokenCoverage: { input: 1, output: 1 } });
    Object.assign(conditions['treatment'], { meanScore: 1, tokens: { input: 80, output: 4 }, tokenCoverage: { input: 2, output: 2 } });
    task['scoreDelta'] = 0.5;
    value['overall']['scoreDelta'] = 0.5;
    task['facets'] = [{ name: 'Unicode | regression', baselinePassRate: 0.5, treatmentPassRate: 1, baselineTrials: 2, treatmentTrials: 2 }];
    const stats = value['overall']['stats'];
    stats['scoreDeltaCi'] = { lo: 0.1, hi: 0.9, resamples: 1000 };
    const markdown = renderEvalMarkdown(parseEvalReport(value));
    assert.match(markdown, /Input: workspace/);
    assert.match(markdown, /\| task-1 \| 50\.0% \| 100\.0% \| \+50\.0pp \|/);
    assert.match(markdown, /Unicode \\\| regression \| 50\.0% \(n=2\) \| 100\.0% \(n=2\)/);
    assert.match(markdown, /Δscore 95% paired-bootstrap CI/);
    assert.match(markdown, /Inconclusive means insufficient evidence/);
    assert.match(markdown, /Activation is unmeasured/);
    assert.match(markdown, /Token coverage is partial or unrecorded/);
    assert.match(markdown, /40 \(1\/2 runs\)/);
    assert.ok(!markdown.includes('Mean recorded tokens'));
});
test('report warns when only the graded-score interval collapses', () => {
    const value = manifest();
    const task = value['tasks'][0];
    const conditions = task['conditions'];
    conditions['baseline']['meanScore'] = 0.5;
    conditions['treatment']['meanScore'] = 1;
    task['scoreDelta'] = 0.5;
    const overall = value['overall'];
    overall['scoreDelta'] = 0.5;
    overall['stats']['scoreDeltaCi'] = { point: 0.5, lo: 0.5, hi: 0.5, resamples: 1000 };
    const markdown = renderEvalMarkdown(parseEvalReport(value));
    assert.match(markdown, /Δpass 95% paired-bootstrap CI.*\[\+20\.0pp, \+100\.0pp\]/);
    assert.match(markdown, /Δscore 95% paired-bootstrap CI.*\[\+50\.0pp, \+50\.0pp\]/);
    assert.match(markdown, /interval collapsed.*does not establish zero uncertainty/);
});
test('report rejects invalid score, facet denominators, coverage and unpaired counts', () => {
    for (const mutate of [
        (task) => { task['facets'] = [{ name: 'a', baselinePassRate: 1, treatmentPassRate: 1, baselineTrials: 3, treatmentTrials: 2 }]; },
        (task) => { task['facets'] = [{ name: 'a', baselinePassRate: 0.5, treatmentPassRate: 1, baselineTrials: 1, treatmentTrials: 2 }]; },
        (task) => { (task['conditions']['baseline'])['meanScore'] = 2; },
        (task) => { (task['conditions']['baseline'])['tokenCoverage'] = { input: 3, output: 0 }; },
        (task) => { (task['conditions']['baseline'])['trials'] = 1; },
    ]) {
        const value = manifest();
        mutate(value['tasks'][0]);
        assert.throws(() => parseEvalReport(value), /denominator|finite number|coverage cannot|tokenCoverage cannot|equal numbers/);
    }
    const value = manifest();
    value['inputMode'] = 'invented';
    assert.throws(() => parseEvalReport(value), /inputMode must/);
});
test('legacy real manifests expose missing provenance and token coverage', () => {
    const value = manifest();
    value['executor'] = { kind: 'cli', model: 'cli-configured' };
    const conditions = value['overall']['conditions'];
    for (const c of Object.values(conditions))
        c['tokens'] = { input: 40, output: 2 };
    const markdown = renderEvalMarkdown(parseEvalReport(value));
    assert.match(markdown, /legacy manifest; not recorded/);
    assert.match(markdown, /coverage unrecorded/);
    assert.match(markdown, /Token coverage is partial or unrecorded/);
});
test('report cross-checks usage coverage/totals and rejects contradictory usage', () => {
    for (const mutation of ['coverage-total', 'token-total', 'missing-task', 'null-tokens', 'zero-coverage']) {
        const value = JSON.parse(JSON.stringify(manifest()));
        const task = value['tasks'][0];
        const taskConditions = task['conditions'];
        const overallConditions = value['overall']['conditions'];
        for (const conditions of [taskConditions, overallConditions]) {
            for (const c of Object.values(conditions))
                Object.assign(c, {
                    tokens: { input: 10, output: 2 }, tokenCoverage: { input: 1, output: 1 },
                });
        }
        const aggregate = overallConditions['baseline'];
        if (mutation === 'coverage-total')
            aggregate['tokenCoverage'] = { input: 2, output: 2 };
        if (mutation === 'token-total')
            aggregate['tokens'] = { input: 10000, output: 1000 };
        if (mutation === 'missing-task')
            delete taskConditions['baseline']['tokenCoverage'];
        if (mutation === 'null-tokens')
            aggregate['tokens'] = null;
        if (mutation === 'zero-coverage')
            aggregate['tokenCoverage'] = { input: 0, output: 0 };
        assert.throws(() => parseEvalReport(value), /disagrees with task totals|requires recorded coverage|contradicts/);
    }
});
test('report refuses a score interval without paired score observations', () => {
    const value = manifest();
    const overall = value['overall'];
    overall['stats']['scoreDeltaCi'] = { lo: 0.5, hi: 1, resamples: 1000 };
    assert.throws(() => parseEvalReport(value), /scoreDeltaCi requires paired graded score observations/);
});
test('report uses completed scale after exclusions and warns about collapsed intervals', () => {
    const value = manifest();
    value['executor'] = { kind: 'cli', model: 'offline' };
    value['trials'] = 5;
    value['bench']['taskCount'] = 8;
    const conditions = { baseline: { passes: 0, trials: 4, errors: 1 }, treatment: { passes: 4, trials: 4, errors: 0 } };
    value['tasks'] = Array.from({ length: 8 }, (_, i) => ({ id: `task-${i}`, conditions, deltaPassRate: 1, verdict: 'inconclusive' }));
    Object.assign(value['overall'], {
        conditions: { baseline: { passes: 0, trials: 32, errors: 8 }, treatment: { passes: 32, trials: 32, errors: 0 } },
        verdict: 'effective', stats: { discordant: { improved: 32, regressed: 0 }, mcnemarP: 2 * 0.5 ** 32,
            deltaCi: { lo: 1, hi: 1, resamples: 1000 } },
    });
    const markdown = renderEvalMarkdown(parseEvalReport(value));
    assert.match(markdown, /Completed scale: 0 task\(s\) have at least 5 graded pairs/);
    assert.match(markdown, /interval collapsed.*does not establish zero uncertainty/);
    assert.match(markdown, /No installation recommendation: this run is below 8 tasks/);
});
test('managed reports refuse contradictory call coverage and withhold decisions for partial runs', () => {
    const value = manifest();
    value['executor'] = { kind: 'cli', model: 'offline' };
    value['experiment'] = { schemaVersion: 1, status: 'stopped', plannedCalls: 4, maxCalls: 4,
        callsStarted: 1, callsFinished: 1, stopReason: 'frozen input changed', planSha256: 'c'.repeat(64) };
    const markdown = renderEvalMarkdown(parseEvalReport(value));
    assert.match(markdown, /Session: stopped; 1\/4/);
    assert.match(markdown, /No installation decision: the frozen experiment/);
    assert.match(markdown, /Retain this run without adding replacement samples/);
    const session = value['experiment'];
    for (const change of [{ status: 'completed', stopReason: null }, { callsStarted: 5 }, { callsFinished: 2 },
        { maxCalls: 3 }, { status: 'incomplete', stopReason: null, callsStarted: 4, callsFinished: 4 }]) {
        assert.throws(() => parseEvalReport({ ...value, experiment: { ...session, ...change } }), /contradict/);
    }
});
test('installed report validates and distinguishes read observations from task quality', () => {
    const value = manifest();
    value['inputMode'] = 'workspace';
    value['skillDelivery'] = { mode: 'installed', installDir: '.agents/skills' };
    value['target']['files'] = ['SKILL.md'];
    const conditions = value['overall']['conditions'];
    conditions['baseline']['skillReads'] = { observed: 0, unobserved: 0, unknown: 2 };
    conditions['treatment']['skillReads'] = { observed: 1, unobserved: 1, unknown: 0 };
    const markdown = renderEvalMarkdown(parseEvalReport(value));
    assert.match(markdown, /Native Skill-read observations/);
    assert.match(markdown, /no body read was detected/);
    assert.match(markdown, /not trigger precision or recall/);
    conditions['treatment']['skillReads'] = { observed: 2, unobserved: 1, unknown: 0 };
    assert.throws(() => parseEvalReport(value), /must total the surviving graded trials/);
});
test('revision report rejects incompatible baseline identities and preserves legacy interpretation', () => {
    const value = manifest();
    assert.ok(!renderEvalMarkdown(parseEvalReport(value)).includes('Baseline Skill:'));
    value['inputMode'] = 'workspace';
    value['skillDelivery'] = { mode: 'installed', installDir: '.agents/skills' };
    value['target']['files'] = ['SKILL.md'];
    const baseline = { kind: 'skill', name: 'test | Skill', bundleSha256: 'b'.repeat(64), sourceDir: '/previous', files: ['SKILL.md'] };
    value['baselineTarget'] = baseline;
    assert.match(renderEvalMarkdown(parseEvalReport(value)), /Baseline Skill: test \\?\| Skill/);
    for (const change of [{ kind: 'rules' }, { name: 'different' }, { bundleSha256: 'a'.repeat(64) },
        { bundleSha256: 'bad' }, { files: ['script.js'] }, { sourceDir: '' }]) {
        assert.throws(() => parseEvalReport({ ...value, baselineTarget: { ...baseline, ...change } }), /baselineTarget|fingerprint/);
    }
    assert.throws(() => parseEvalReport({ ...value, skillDelivery: undefined }), /requires two installed Skill/);
});
