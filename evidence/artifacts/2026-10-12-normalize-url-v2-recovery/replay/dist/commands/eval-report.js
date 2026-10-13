import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONCLUSIVE_TASKS, CONCLUSIVE_TRIALS, formatP, formatPp1, verdictFor } from '../harness/report.js';
import { mcnemarExactP } from '../harness/stats.js';
import { validateSkillInstallDir } from '../harness/installed-skill.js';
import { assertCostTotals, COST_METRICS, renderCostLines } from '../harness/costs.js';
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;
function object(value, label) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`${label} must be an object`);
    }
    return value;
}
function string(value, label) {
    if (typeof value !== 'string' || value.trim() === '')
        throw new Error(`${label} must be a non-empty string`);
    return value;
}
function number(value, label, min = -Infinity, max = Infinity) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        throw new Error(`${label} must be a finite number between ${min} and ${max}`);
    }
    return value;
}
function integer(value, label, min = 0) {
    const result = number(value, label, min);
    if (!Number.isInteger(result))
        throw new Error(`${label} must be an integer`);
    return result;
}
function hash(value, label) {
    const result = string(value, label);
    if (!/^[0-9a-f]{64}$/i.test(result))
        throw new Error(`${label} must be a SHA-256 hex digest`);
    return result;
}
function verdict(value, label) {
    if (value !== 'effective' && value !== 'ineffective' && value !== 'inconclusive') {
        throw new Error(`${label} must be effective, ineffective, or inconclusive`);
    }
    return value;
}
function experiment(value) {
    if (value === undefined)
        return null;
    const item = object(value, 'experiment');
    if (item['schemaVersion'] !== 1)
        throw new Error('experiment.schemaVersion must be 1');
    const status = item['status'];
    if (status !== 'completed' && status !== 'stopped' && status !== 'incomplete')
        throw new Error('experiment.status must be completed, stopped, or incomplete');
    const plannedCalls = integer(item['plannedCalls'], 'experiment.plannedCalls', 1);
    const maxCalls = integer(item['maxCalls'], 'experiment.maxCalls', 1);
    const callsStarted = integer(item['callsStarted'], 'experiment.callsStarted');
    const callsFinished = integer(item['callsFinished'], 'experiment.callsFinished');
    const stopReason = item['stopReason'] === null ? null : string(item['stopReason'], 'experiment.stopReason');
    if (![plannedCalls, maxCalls, callsStarted, callsFinished].every(Number.isSafeInteger) ||
        maxCalls < plannedCalls || callsStarted > plannedCalls || callsFinished > callsStarted ||
        (status === 'completed' && (stopReason !== null || callsFinished !== plannedCalls)) ||
        (status === 'stopped' && stopReason === null) ||
        (status === 'incomplete' && (stopReason !== null || callsFinished === plannedCalls))) {
        throw new Error('experiment status, call counts, ceiling, and stop reason contradict each other');
    }
    return { schemaVersion: 1, status, plannedCalls, maxCalls, callsStarted, callsFinished, stopReason,
        planSha256: hash(item['planSha256'], 'experiment.planSha256') };
}
function counts(value, label) {
    const item = object(value, label);
    const passes = integer(item['passes'], `${label}.passes`);
    const trials = integer(item['trials'], `${label}.trials`);
    const errors = integer(item['errors'], `${label}.errors`);
    if (passes > trials)
        throw new Error(`${label}.passes cannot exceed trials`);
    const meanScore = item['meanScore'] === undefined || item['meanScore'] === null
        ? null : number(item['meanScore'], `${label}.meanScore`, 0, 1);
    const rawTokens = item['tokens'] === undefined || item['tokens'] === null
        ? null : object(item['tokens'], `${label}.tokens`);
    const tokens = rawTokens === null ? null : {
        input: number(rawTokens['input'], `${label}.tokens.input`, 0),
        output: number(rawTokens['output'], `${label}.tokens.output`, 0),
    };
    const rawCoverage = item['tokenCoverage'] === undefined
        ? null : object(item['tokenCoverage'], `${label}.tokenCoverage`);
    const tokenCoverage = rawCoverage === null ? null : {
        input: integer(rawCoverage['input'], `${label}.tokenCoverage.input`),
        output: integer(rawCoverage['output'], `${label}.tokenCoverage.output`),
    };
    if (tokenCoverage && (tokenCoverage.input > trials || tokenCoverage.output > trials)) {
        throw new Error(`${label}.tokenCoverage cannot exceed graded trials`);
    }
    if (tokenCoverage) {
        for (const field of ['input', 'output']) {
            if ((tokenCoverage[field] > 0 && tokens === null) ||
                (tokenCoverage[field] === 0 && tokens !== null && tokens[field] !== 0)) {
                throw new Error(`${label}.tokenCoverage contradicts its recorded tokens`);
            }
        }
    }
    if (meanScore !== null && trials === 0)
        throw new Error(`${label}.meanScore requires graded trials`);
    const rawReads = item['skillReads'] === undefined ? null : object(item['skillReads'], `${label}.skillReads`);
    const skillReads = rawReads === null ? null : {
        observed: integer(rawReads['observed'], `${label}.skillReads.observed`),
        unobserved: integer(rawReads['unobserved'], `${label}.skillReads.unobserved`),
        unknown: integer(rawReads['unknown'], `${label}.skillReads.unknown`),
    };
    if (skillReads && skillReads.observed + skillReads.unobserved + skillReads.unknown !== trials) {
        throw new Error(`${label}.skillReads must total the surviving graded trials`);
    }
    return { passes, trials, errors, meanScore, tokens, tokenCoverage, skillReads };
}
function facets(value, label) {
    if (value === undefined)
        return [];
    if (!Array.isArray(value))
        throw new Error(`${label} must be an array`);
    return value.map((raw, index) => {
        const item = object(raw, `${label}[${index}]`);
        return {
            name: string(item['name'], `${label}[${index}].name`),
            baselinePassRate: number(item['baselinePassRate'], `${label}[${index}].baselinePassRate`, 0, 1),
            treatmentPassRate: number(item['treatmentPassRate'], `${label}[${index}].treatmentPassRate`, 0, 1),
            baselineTrials: integer(item['baselineTrials'], `${label}[${index}].baselineTrials`),
            treatmentTrials: integer(item['treatmentTrials'], `${label}[${index}].treatmentTrials`),
        };
    });
}
function row(value, label, id) {
    const item = object(value, label);
    const conditions = object(item['conditions'], `${label}.conditions`);
    return {
        costs: item['costs'] === undefined ? null : parseCosts(item['costs'], `${label}.costs`),
        id,
        baseline: counts(conditions['baseline'], `${label}.conditions.baseline`),
        treatment: counts(conditions['treatment'], `${label}.conditions.treatment`),
        deltaPassRate: number(item['deltaPassRate'], `${label}.deltaPassRate`, -1, 1),
        verdict: verdict(item['verdict'], `${label}.verdict`),
        scoreDelta: item['scoreDelta'] === undefined || item['scoreDelta'] === null
            ? null : number(item['scoreDelta'], `${label}.scoreDelta`, -1, 1),
        facets: facets(item['facets'], `${label}.facets`),
    };
}
function parseCosts(value, label) {
    const item = object(value, label);
    if (item['schemaVersion'] !== 1)
        throw new Error(`${label}.schemaVersion must be 1`);
    const scope = (name) => {
        const arms = object(item[name], `${label}.${name}`);
        const population = (arm) => {
            const path = `${label}.${name}.${arm}`;
            const raw = object(arms[arm], path);
            const runs = integer(raw['runs'], `${path}.runs`);
            const passes = integer(raw['passes'], `${path}.passes`);
            if (passes > runs)
                throw new Error(`${path}.passes cannot exceed runs`);
            const rawMetrics = object(raw['metrics'], `${path}.metrics`);
            const metrics = Object.fromEntries(COST_METRICS.map(metric => {
                const measure = object(rawMetrics[metric], `${path}.metrics.${metric}`);
                const coverage = object(measure['coverage'], `${path}.metrics.${metric}.coverage`);
                const parsed = {
                    knownTotal: number(measure['knownTotal'], `${path}.metrics.${metric}.knownTotal`, 0),
                    coverage: {
                        final: integer(coverage['final'], `${path}.metrics.${metric}.coverage.final`),
                        partial: integer(coverage['partial'], `${path}.metrics.${metric}.coverage.partial`),
                        unknown: integer(coverage['unknown'], `${path}.metrics.${metric}.coverage.unknown`),
                    },
                };
                const c = parsed.coverage;
                if (c.final + c.partial + c.unknown !== runs ||
                    (c.final + c.partial === 0 && parsed.knownTotal !== 0))
                    throw new Error(`${path}.metrics.${metric} contradicts coverage`);
                if (metric === 'durationSeconds' && (c.partial !== 0 || c.unknown !== 0))
                    throw new Error(`${path} elapsed time must cover every invocation`);
                return [metric, parsed];
            }));
            const cache = metrics.cachedInput;
            const uncached = metrics.uncachedInput;
            if (JSON.stringify(cache.coverage) !== JSON.stringify(uncached.coverage))
                throw new Error(`${path} cache partition coverage must match`);
            if (cache.coverage.final + cache.coverage.partial > metrics.input.coverage.final + metrics.input.coverage.partial ||
                cache.coverage.final > metrics.input.coverage.final ||
                cache.knownTotal + uncached.knownTotal > metrics.input.knownTotal + 1e-6)
                throw new Error(`${path} cache partition contradicts input`);
            if (cache.coverage.final + cache.coverage.partial === metrics.input.coverage.final + metrics.input.coverage.partial &&
                Math.abs(cache.knownTotal + uncached.knownTotal - metrics.input.knownTotal) > 1e-6)
                throw new Error(`${path} cache partition disagrees with input`);
            return { runs, passes, metrics };
        };
        return { baseline: population('baseline'), treatment: population('treatment') };
    };
    const notInvoked = object(item['notInvoked'], `${label}.notInvoked`);
    return { schemaVersion: 1, paired: scope('paired'), attempts: scope('attempts'), notInvoked: {
            baseline: integer(notInvoked['baseline'], `${label}.notInvoked.baseline`),
            treatment: integer(notInvoked['treatment'], `${label}.notInvoked.treatment`),
        } };
}
function checkCostCounts(row, declaredRuns, label) {
    const costs = row.costs;
    if (!costs)
        return;
    for (const arm of ['baseline', 'treatment']) {
        const paired = costs.paired[arm];
        const attempts = costs.attempts[arm];
        if (paired.runs !== row[arm].trials || paired.passes !== row[arm].passes ||
            attempts.runs + costs.notInvoked[arm] !== declaredRuns ||
            paired.runs > attempts.runs || paired.passes > attempts.passes ||
            attempts.passes - paired.passes > attempts.runs - paired.runs)
            throw new Error(`${label}.costs disagree with declared/graded counts`);
        for (const metric of COST_METRICS) {
            if (paired.metrics[metric].knownTotal > attempts.metrics[metric].knownTotal + 1e-6)
                throw new Error(`${label}.costs paired spending exceeds all invocations`);
            for (const status of ['final', 'partial', 'unknown']) {
                if (paired.metrics[metric].coverage[status] > attempts.metrics[metric].coverage[status])
                    throw new Error(`${label}.costs paired coverage exceeds all invocations`);
            }
        }
    }
}
function checkDelta(value, label) {
    if (value.baseline.trials !== value.treatment.trials) {
        throw new Error(`${label} must contain equal numbers of graded paired trials`);
    }
    const seen = new Set();
    for (const facet of value.facets) {
        if (seen.has(facet.name))
            throw new Error(`${label}.facets contains a duplicate check name`);
        seen.add(facet.name);
        for (const condition of ['baseline', 'treatment']) {
            const trials = condition === 'baseline' ? facet.baselineTrials : facet.treatmentTrials;
            const rate = condition === 'baseline' ? facet.baselinePassRate : facet.treatmentPassRate;
            if (trials > value[condition].trials || (trials === 0 && rate !== 0) ||
                Math.abs(rate * trials - Math.round(rate * trials)) > 1e-9) {
                throw new Error(`${label}.facets has an invalid ${condition} check denominator or rate`);
            }
        }
    }
    const rate = (counts) => counts.trials === 0 ? 0 : counts.passes / counts.trials;
    const expected = rate(value.treatment) - rate(value.baseline);
    if (Math.abs(value.deltaPassRate - expected) > 1e-9) {
        throw new Error(`${label}.deltaPassRate disagrees with its pass counts`);
    }
    if (value.baseline.meanScore !== null && value.treatment.meanScore !== null &&
        value.scoreDelta !== null && Math.abs(value.scoreDelta -
        (value.treatment.meanScore - value.baseline.meanScore)) > 1e-9 && label !== 'overall') {
        throw new Error(`${label}.scoreDelta disagrees with its mean scores`);
    }
    if (value.scoreDelta !== null && (value.baseline.meanScore === null || value.treatment.meanScore === null)) {
        throw new Error(`${label}.scoreDelta requires graded scores in both conditions`);
    }
}
/** Read only the v4 fields the Markdown report actually uses. Never reinterpret older metrics. */
export function parseEvalReport(value) {
    const manifest = object(value, 'Manifest');
    if (manifest['schemaVersion'] !== 4) {
        throw new Error(`Only evaluation manifest schemaVersion 4 can be rendered (found ${JSON.stringify(manifest['schemaVersion'])})`);
    }
    const target = object(manifest['target'], 'target');
    const kind = string(target['kind'], 'target.kind');
    if (!['skill', 'rules', 'mcp'].includes(kind))
        throw new Error('target.kind must be skill, rules, or mcp');
    const bench = object(manifest['bench'], 'bench');
    const executor = object(manifest['executor'], 'executor');
    const inputMode = manifest['inputMode'];
    if (inputMode !== undefined && inputMode !== 'snapshot' && inputMode !== 'workspace') {
        throw new Error('inputMode must be snapshot or workspace');
    }
    let skillDelivery = null;
    if (manifest['skillDelivery'] !== undefined) {
        const delivery = object(manifest['skillDelivery'], 'skillDelivery');
        if (delivery['mode'] !== 'installed' || kind !== 'skill' || inputMode !== 'workspace') {
            throw new Error('skillDelivery requires installed mode, a Skill target and workspace input');
        }
        const installDir = string(delivery['installDir'], 'skillDelivery.installDir');
        validateSkillInstallDir(installDir);
        if (!Array.isArray(target['files']) || !target['files'].includes('SKILL.md') ||
            target['files'].some((file) => typeof file !== 'string' || !file)) {
            throw new Error('Installed Skill target.files must list the complete resources including SKILL.md');
        }
        skillDelivery = { mode: 'installed', installDir };
    }
    let baselineTarget = null;
    if (manifest['baselineTarget'] !== undefined) {
        const previous = object(manifest['baselineTarget'], 'baselineTarget');
        if (!skillDelivery || previous['kind'] !== 'skill') {
            throw new Error('baselineTarget requires two installed Skill versions.');
        }
        const name = string(previous['name'], 'baselineTarget.name');
        if (name !== target['name'])
            throw new Error('baselineTarget.name must match the target Skill name.');
        const sha256 = hash(previous['bundleSha256'], 'baselineTarget.bundleSha256');
        if (sha256.toLowerCase() === hash(target['bundleSha256'], 'target.bundleSha256').toLowerCase()) {
            throw new Error('baselineTarget and target must have different complete-resource fingerprints.');
        }
        string(previous['sourceDir'], 'baselineTarget.sourceDir');
        if (!Array.isArray(previous['files']) || !previous['files'].includes('SKILL.md') ||
            previous['files'].some(file => typeof file !== 'string' || !file)) {
            throw new Error('baselineTarget.files must list the complete resources including SKILL.md.');
        }
        baselineTarget = { name, sha256 };
    }
    const rawTasks = manifest['tasks'];
    if (!Array.isArray(rawTasks))
        throw new Error('tasks must be an array');
    const tasks = rawTasks.map((task, index) => {
        const item = object(task, `tasks[${index}]`);
        return row(item, `tasks[${index}]`, string(item['id'], `tasks[${index}].id`));
    });
    const overall = object(manifest['overall'], 'overall');
    const stats = object(overall['stats'], 'overall.stats');
    const discordant = object(stats['discordant'], 'overall.stats.discordant');
    const rawCi = stats['deltaCi'];
    const ci = rawCi === null ? null : object(rawCi, 'overall.stats.deltaCi');
    const warnings = manifest['warnings'];
    if (!Array.isArray(warnings) || warnings.some((item) => typeof item !== 'string')) {
        throw new Error('warnings must be an array of strings');
    }
    const createdAt = string(manifest['createdAt'], 'createdAt');
    if (!Number.isFinite(Date.parse(createdAt)))
        throw new Error('createdAt must be a date-time');
    const taskCount = integer(bench['taskCount'], 'bench.taskCount');
    if (tasks.length !== taskCount)
        throw new Error('bench.taskCount must match tasks.length');
    const ciValue = ci === null ? null : {
        lo: number(ci['lo'], 'overall.stats.deltaCi.lo', -1, 1),
        hi: number(ci['hi'], 'overall.stats.deltaCi.hi', -1, 1),
        resamples: integer(ci['resamples'], 'overall.stats.deltaCi.resamples', 1),
    };
    if (ciValue && ciValue.lo > ciValue.hi)
        throw new Error('overall.stats.deltaCi.lo cannot exceed hi');
    const rawScoreCi = stats['scoreDeltaCi'];
    const scoreCi = rawScoreCi === undefined || rawScoreCi === null ? null
        : object(rawScoreCi, 'overall.stats.scoreDeltaCi');
    const scoreDeltaCi = scoreCi === null ? null : {
        lo: number(scoreCi['lo'], 'overall.stats.scoreDeltaCi.lo', -1, 1),
        hi: number(scoreCi['hi'], 'overall.stats.scoreDeltaCi.hi', -1, 1),
        resamples: integer(scoreCi['resamples'], 'overall.stats.scoreDeltaCi.resamples', 1),
    };
    if (scoreDeltaCi && scoreDeltaCi.lo > scoreDeltaCi.hi)
        throw new Error('overall.stats.scoreDeltaCi.lo cannot exceed hi');
    const overallRow = row(overall, 'overall', 'Overall');
    const declaredTrials = integer(manifest['trials'], 'trials', 1);
    for (const [index, task] of tasks.entries())
        checkCostCounts(task, declaredTrials, `tasks[${index}]`);
    checkCostCounts(overallRow, declaredTrials * tasks.length, 'overall');
    if (overallRow.costs) {
        if (tasks.some(t => !t.costs))
            throw new Error('overall.costs requires costs for every task');
        assertCostTotals(overallRow.costs, tasks.map(t => t.costs));
    }
    else if (tasks.some(t => t.costs))
        throw new Error('Task costs require corresponding overall costs');
    for (const [index, task] of tasks.entries())
        checkDelta(task, `tasks[${index}]`);
    checkDelta(overallRow, 'overall');
    if (scoreDeltaCi) {
        if (overallRow.scoreDelta === null || overallRow.baseline.meanScore === null ||
            overallRow.treatment.meanScore === null || !tasks.some(t => t.baseline.trials > 0 && t.baseline.meanScore !== null &&
            t.treatment.meanScore !== null && t.scoreDelta !== null)) {
            throw new Error('overall.stats.scoreDeltaCi requires paired graded score observations and overall scoreDelta');
        }
        if (scoreCi['point'] !== undefined && Math.abs(number(scoreCi['point'], 'overall.stats.scoreDeltaCi.point', -1, 1) - overallRow.scoreDelta) > 1e-9) {
            throw new Error('overall.stats.scoreDeltaCi.point disagrees with overall.scoreDelta');
        }
    }
    for (const condition of ['baseline', 'treatment']) {
        for (const field of ['passes', 'trials', 'errors']) {
            const total = tasks.reduce((sum, task) => sum + task[condition][field], 0);
            if (total !== overallRow[condition][field]) {
                throw new Error(`overall.conditions.${condition}.${field} disagrees with task totals`);
            }
        }
        const aggregate = overallRow[condition];
        if (aggregate.skillReads) {
            if (!skillDelivery || tasks.some(t => t[condition].skillReads === null))
                throw new Error('skillReads requires installed delivery and recorded observations for every task');
            for (const field of ['observed', 'unobserved', 'unknown']) {
                if (aggregate.skillReads[field] !== tasks.reduce((sum, t) => sum + t[condition].skillReads[field], 0)) {
                    throw new Error(`overall.conditions.${condition}.skillReads.${field} disagrees with task totals`);
                }
            }
        }
        else if (tasks.some(t => t[condition].skillReads !== null))
            throw new Error('Task skillReads requires corresponding overall observations');
        if (aggregate.tokenCoverage) {
            if (tasks.some(t => t[condition].tokenCoverage === null)) {
                throw new Error(`overall.conditions.${condition}.tokenCoverage requires recorded coverage for every task`);
            }
            for (const field of ['input', 'output']) {
                const coverage = tasks.reduce((sum, t) => sum + t[condition].tokenCoverage[field], 0);
                if (coverage !== aggregate.tokenCoverage[field]) {
                    throw new Error(`overall.conditions.${condition}.tokenCoverage.${field} disagrees with task totals`);
                }
                const total = tasks.reduce((sum, t) => sum + (t[condition].tokens?.[field] ?? 0), 0);
                if (total !== (aggregate.tokens?.[field] ?? 0)) {
                    throw new Error(`overall.conditions.${condition}.tokens.${field} disagrees with task totals`);
                }
            }
        }
    }
    const improved = integer(discordant['improved'], 'overall.stats.discordant.improved');
    const regressed = integer(discordant['regressed'], 'overall.stats.discordant.regressed');
    if (improved + regressed > overallRow.baseline.trials) {
        throw new Error('overall.stats.discordant exceeds the number of paired trials');
    }
    if (improved - regressed !== overallRow.treatment.passes - overallRow.baseline.passes) {
        throw new Error('overall.stats.discordant.improved - regressed disagrees with treatment.passes - baseline.passes');
    }
    const sharedSuccess = overallRow.baseline.passes - regressed;
    if (sharedSuccess < 0) {
        throw new Error('overall.stats.discordant implies a negative shared success count');
    }
    const sharedFailure = overallRow.baseline.trials - improved - regressed - sharedSuccess;
    if (sharedFailure < 0) {
        throw new Error('overall.stats.discordant implies a negative shared failure count');
    }
    const mcnemarP = number(stats['mcnemarP'], 'overall.stats.mcnemarP', 0, 1);
    if (Math.abs(mcnemarP - mcnemarExactP(improved, regressed)) > 1e-9) {
        throw new Error('overall.stats.mcnemarP disagrees with discordant counts');
    }
    const expectedVerdict = verdictFor({ improved, regressed, deltaPassRate: overallRow.deltaPassRate }).verdict;
    if (overallRow.verdict !== expectedVerdict)
        throw new Error('overall.verdict disagrees with the metrics protocol');
    const managed = experiment(manifest['experiment']);
    if (managed && managed.plannedCalls !== taskCount * integer(manifest['trials'], 'trials', 1) * (manifest['judge'] == null ? 2 : 4)) {
        throw new Error('experiment.plannedCalls contradicts the declared tasks, trials, conditions, and judge');
    }
    return {
        runGroup: string(manifest['runGroup'], 'runGroup'),
        createdAt,
        target: { kind, name: string(target['name'], 'target.name'), sha256: hash(target['bundleSha256'], 'target.bundleSha256') },
        baselineTarget,
        bench: {
            name: string(bench['name'], 'bench.name'),
            sha256: hash(bench['contentSha256'], 'bench.contentSha256'),
            taskCount,
        },
        executor: { kind: string(executor['kind'], 'executor.kind'), model: string(executor['model'], 'executor.model') },
        trials: integer(manifest['trials'], 'trials', 1),
        inputMode: inputMode ?? null,
        skillDelivery,
        experiment: managed,
        tasks,
        overall: {
            ...overallRow,
            verdictReason: string(overall['verdictReason'], 'overall.verdictReason'),
            improved,
            regressed,
            mcnemarP,
            deltaCi: ciValue,
            scoreDeltaCi,
        },
        warnings: warnings,
    };
}
function escapeMarkdown(value) {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('*', '\\*')
        .replaceAll('_', '\\_').replaceAll('[', '\\[').replaceAll(']', '\\]')
        .replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', ' ');
}
function passRate(value) {
    return `${value.passes}/${value.trials} (${value.trials === 0 ? 'n/a' : `${Math.round(100 * value.passes / value.trials)}%`})`;
}
function tableRow(value) {
    return `| ${escapeMarkdown(value.id)} | ${passRate(value.baseline)} | ${passRate(value.treatment)} | ${value.baseline.errors}/${value.treatment.errors} | ${formatPp1(value.deltaPassRate)} | ${value.verdict} |`;
}
function score(value) {
    return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}
function replicatedTaskCount(report) {
    return report.tasks.filter(t => Math.min(t.baseline.trials, t.treatment.trials) >= CONCLUSIVE_TRIALS).length;
}
function decisionNotes(report) {
    const notes = [];
    if (report.experiment && report.experiment.status !== 'completed') {
        return ['No installation decision: the frozen experiment stopped or did not complete its declared calls. Inspect _session.json, _calls.jsonl and the error receipts; repair the inputs/environment, then declare a fresh run. Retain this run without adding replacement samples.'];
    }
    if (report.executor.kind === 'mock') {
        return ['No installation decision: this synthetic run only checks the harness.'];
    }
    if (report.overall.baseline.trials === 0) {
        notes.push('No installation decision: no graded pairs. Repair the execution or verifier environment first.');
    }
    else if (report.overall.verdict === 'inconclusive') {
        notes.push('No installation recommendation from this run. Inconclusive means insufficient evidence to distinguish benefit from variation; it does not mean ineffective.');
    }
    else {
        notes.push(report.overall.verdict === 'effective'
            ? 'The statistical quality result favors treatment on this bench; it does not by itself establish installation value.'
            : 'The statistical quality result favors baseline on this bench; review the regressions before enabling this configuration for these tasks.');
    }
    notes.push(`Scope: ${report.bench.taskCount} evaluated task(s), this target hash and executor configuration. A single task does not establish general OSS contribution quality.`);
    if (replicatedTaskCount(report) < CONCLUSIVE_TASKS) {
        notes.push('No installation recommendation: this run is below 8 tasks × 5 graded pairs and is indicative. Freeze a varied task set and trial count before a separate validation run; do not keep adding trials until significance appears.');
    }
    if (report.overall.baseline.errors + report.overall.treatment.errors > 0) {
        notes.push('Executor/verifier errors removed pairs. Inspect the raw error receipts before spending more calls.');
    }
    const saturated = report.tasks.filter(t => t.baseline.trials > 0 && t.baseline.passes / t.baseline.trials >= 0.9);
    if (saturated.length > 0) {
        notes.push(`Observed baseline saturation: ${saturated.map(t => t.id).join(', ')}. Retain these as regression controls; add independent real failures to measure lift.`);
    }
    if (report.tasks.some(t => t.baseline.trials > 0 && t.baseline.passes === 0 && t.treatment.passes === 0)) {
        notes.push('Some tasks failed in both arms. Inspect facet misses, dependencies and the issue-to-check contract before interpreting the pass-rate floor as task difficulty.');
    }
    if (report.target.kind === 'skill') {
        notes.push(report.baselineTarget
            ? 'Skill revision comparison: baseline contains the previous complete Skill and treatment contains the target version. Results describe revision effects, not installation benefit over no Skill. A positive delta does not guarantee non-regression on unseen tasks. Inspect per-run read observations and separate positive/negative trigger tests.'
            : report.skillDelivery
                ? 'Complete Skill resources were installed only in treatment. Task outcomes include native discovery; inspect per-run activation/transcript receipts and run separate positive/negative trigger tests. Installation does not guarantee activation, and inherited agent configuration still applies.'
                : 'Activation is unmeasured by this paired run: Skill content was force-injected. Run separate trigger tests with relevant requests and negative controls before an installation decision.');
    }
    if (report.baselineTarget) {
        const regressions = report.tasks.filter(task => task.deltaPassRate < 0 || (task.scoreDelta !== null && task.scoreDelta < 0));
        if (regressions.length > 0) {
            notes.push(`Observed task regressions: ${regressions.map(task => task.id).join(', ')}. Inspect their outcomes and checks before accepting the revision, even if the pooled verdict favors treatment.`);
        }
    }
    if (!report.overall.baseline.tokens || !report.overall.treatment.tokens) {
        notes.push('Token overhead is unavailable. Elapsed time or prompt-size estimates do not establish token cost.');
    }
    else if ([report.overall.baseline, report.overall.treatment].some(c => !c.tokenCoverage || c.tokenCoverage.input < c.trials || c.tokenCoverage.output < c.trials)) {
        notes.push('Token coverage is partial or unrecorded. Available usage totals cannot establish complete token overhead.');
    }
    else {
        notes.push('Recorded token usage is shown below; it is not a billing estimate or a statistically established cost effect.');
    }
    return notes;
}
export function renderEvalMarkdown(report) {
    const lines = [
        `# skillfit evaluation: ${escapeMarkdown(report.target.name)}`,
        '',
    ];
    if (report.executor.kind === 'mock') {
        lines.push('> **Synthetic harness run.** These numbers do not measure an agent or Skill effect.', '');
    }
    lines.push(`- Run: ${escapeMarkdown(report.runGroup)} (${escapeMarkdown(report.createdAt)})`, `- Target: ${escapeMarkdown(report.target.kind)}; SHA-256 \`${report.target.sha256}\``, ...(report.baselineTarget ? [`- Baseline Skill: ${escapeMarkdown(report.baselineTarget.name)} (previous version); SHA-256 \`${report.baselineTarget.sha256}\``] : []), `- Bench: ${escapeMarkdown(report.bench.name)} (${report.bench.taskCount} ${report.bench.taskCount === 1 ? 'task' : 'tasks'}); SHA-256 \`${report.bench.sha256}\``, `- Executor: ${escapeMarkdown(report.executor.kind)} / ${escapeMarkdown(report.executor.model)}`, `- Trials: ${report.trials} per condition`, `- Input: ${report.inputMode ?? 'snapshot (legacy manifest; not recorded)'}`, ...(report.skillDelivery ? ['- Delivery: complete Skill installed ' + (report.baselineTarget ? 'in both conditions' : 'in treatment') + ' at ' + escapeMarkdown(report.skillDelivery.installDir)] : []), ...(report.experiment ? [`- Session: ${report.experiment.status}; ${report.experiment.callsStarted}/${report.experiment.plannedCalls} calls started, ${report.experiment.callsFinished} finished; ceiling ${report.experiment.maxCalls}`, `- Frozen plan SHA-256: \`${report.experiment.planSha256}\``] : []), '', '| Task | Baseline | Treatment | Errors B/T | Δpass | Verdict |', '|---|---:|---:|---:|---:|---|', ...report.tasks.map(tableRow), tableRow(report.overall), '', '## Statistical readout', '', `- Overall verdict: **${report.overall.verdict}** — ${escapeMarkdown(report.overall.verdictReason)}`, `- Discordant pairs: ${report.overall.improved} improved, ${report.overall.regressed} regressed; McNemar exact p=${formatP(report.overall.mcnemarP)}`);
    if (report.overall.deltaCi) {
        const ci = report.overall.deltaCi;
        lines.push(`- Δpass 95% paired-bootstrap CI (${ci.resamples} resamples): [${formatPp1(ci.lo)}, ${formatPp1(ci.hi)}]`);
        lines.push(`- Observed Δpass CI half-width: ±${((ci.hi - ci.lo) * 50).toFixed(1)}pp; not a validated minimum detectable effect.`);
    }
    else {
        lines.push('- Δpass 95% CI: n/a (no graded pairs)');
    }
    if (report.overall.scoreDeltaCi) {
        const ci = report.overall.scoreDeltaCi;
        lines.push(`- Δscore 95% paired-bootstrap CI (${ci.resamples} resamples): [${formatPp1(ci.lo)}, ${formatPp1(ci.hi)}]`);
    }
    if ((report.overall.deltaCi && report.overall.deltaCi.lo === report.overall.deltaCi.hi)
        || (report.overall.scoreDeltaCi && report.overall.scoreDeltaCi.lo === report.overall.scoreDeltaCi.hi)) {
        lines.push('- The bootstrap interval collapsed on the observed tasks; this does not establish zero uncertainty or validated effect resolution.');
    }
    if (replicatedTaskCount(report) < CONCLUSIVE_TASKS) {
        lines.push(`- Scale: ${report.bench.taskCount} ${report.bench.taskCount === 1 ? 'task' : 'tasks'} × ${report.trials} ${report.trials === 1 ? 'trial' : 'trials'} per condition; below the conclusive bar (${CONCLUSIVE_TASKS} tasks × ${CONCLUSIVE_TRIALS} trials). Treat broader claims as indicative even if the within-bench verdict is statistically significant.`);
        lines.push(`- Completed scale: ${replicatedTaskCount(report)} task(s) have at least ${CONCLUSIVE_TRIALS} graded pairs after exclusions.`);
    }
    if (report.overall.treatment.skillReads) {
        lines.push('', '## Native Skill-read observations', '', '| Task / arm | Read observed | Read unobserved | Unknown |', '|---|---:|---:|---:|');
        for (const item of [...report.tasks, report.overall])
            for (const arm of ['baseline', 'treatment']) {
                const reads = item[arm].skillReads;
                if (reads)
                    lines.push(`| ${escapeMarkdown(item.id)} / ${arm} | ${reads.observed} | ${reads.unobserved} | ${reads.unknown} |`);
            }
        lines.push('', 'Observed means a long-body read was detected. Unobserved means no body read was detected; the description may still have been in the catalog. Counts cover surviving graded pairs only. A read does not establish benefit. These are not trigger precision or recall.', '');
    }
    lines.push('', '## Checks and graded scores', '', '| Task | Baseline mean check score | Treatment mean check score | Δscore |', '|---|---:|---:|---:|', ...report.tasks.map(t => `| ${escapeMarkdown(t.id)} | ${score(t.baseline.meanScore)} | ${score(t.treatment.meanScore)} | ${t.scoreDelta === null ? 'n/a' : formatPp1(t.scoreDelta)} |`));
    for (const task of report.tasks) {
        if (task.facets.length === 0)
            continue;
        lines.push('', `### ${escapeMarkdown(task.id)}`, '', '| Check | Baseline pass rate (graded observations) | Treatment pass rate (graded observations) |', '|---|---:|---:|', ...task.facets.map(f => `| ${escapeMarkdown(f.name)} | ${f.baselineTrials === 0 ? 'n/a' : `${score(f.baselinePassRate)} (n=${f.baselineTrials})`} | ${f.treatmentTrials === 0 ? 'n/a' : `${score(f.treatmentPassRate)} (n=${f.treatmentTrials})`} |`));
    }
    if (report.tasks.every(t => t.facets.length === 0)) {
        lines.push('', 'No per-check observations recorded.');
    }
    lines.push('', '## Installation decision and next steps', '', ...decisionNotes(report).map(note => `- ${escapeMarkdown(note)}`));
    if (report.overall.baseline.tokens && report.overall.treatment.tokens) {
        const cell = (c, field) => `${c.tokens[field]} (${c.tokenCoverage ? `${c.tokenCoverage[field]}/${c.trials} runs` : 'coverage unrecorded'})`;
        lines.push('', '| Recorded token totals (field coverage) | Baseline | Treatment |', '|---|---:|---:|', `| Input | ${cell(report.overall.baseline, 'input')} | ${cell(report.overall.treatment, 'input')} |`, `| Output | ${cell(report.overall.baseline, 'output')} | ${cell(report.overall.treatment, 'output')} |`);
    }
    lines.push('', '## Cost accounting', '');
    if (report.overall.costs)
        lines.push(...renderCostLines(report.overall.costs));
    else
        lines.push('Cache partitions and all-invocation costs were not recorded in this legacy manifest. Missing usage is unknown; the report does not infer it from prompt size or treat it as zero.');
    lines.push('', '## Warnings', '');
    if (report.warnings.length === 0)
        lines.push('- None');
    else
        lines.push(...report.warnings.map((warning) => `- ${escapeMarkdown(warning)}`));
    lines.push('', 'The verdict follows [the skillfit metrics protocol](https://github.com/remote-controlled-man/skillfit/blob/main/docs/metrics.md). Review the pinned manifest before comparing runs.', '');
    return lines.join('\n');
}
export function runEvalReport(manifestPath, log = console.log) {
    const path = resolve(manifestPath);
    if (statSync(path).size > MAX_MANIFEST_BYTES)
        throw new Error(`Evaluation manifest exceeds ${MAX_MANIFEST_BYTES} bytes`);
    let value;
    try {
        value = JSON.parse(readFileSync(path, 'utf8'));
    }
    catch (error) {
        throw new Error(`Cannot read evaluation manifest: ${error.message}`);
    }
    log(renderEvalMarkdown(parseEvalReport(value)));
}
