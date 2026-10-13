import { mcnemarExactP, MIN_DISCORDANT_FOR_SIGNIFICANCE } from './stats.js';
import { CONDITIONS } from './types.js';
import { renderCostLines } from './costs.js';
export const DISCRIMINATION_BASELINE_THRESHOLD = 0.9;
export const FLOOR_BASELINE_THRESHOLD = 0.1;
export const CONCLUSIVE_TASKS = 8;
export const CONCLUSIVE_TRIALS = 5;
export function formatPassRate(passes, trials) {
    if (trials === 0)
        return `${passes}/${trials} (n/a)`;
    return `${passes}/${trials} (${Math.round((passes / trials) * 100)}%)`;
}
export function formatDeltaPp(delta) {
    const pp = Math.round(delta * 100);
    return `${pp > 0 ? '+' : ''}${pp}pp`;
}
/**
 * Percentage points to one decimal. Interval bounds need this: rounding a CI to whole points turns
 * [-0.044, 0.610] into [-4pp, +61pp], which reports the run's resolution as ±33pp when it is ±32.7 —
 * and at the small sample sizes this tool targets, the tenths are the difference between "resolves a
 * realistic effect" and "resolves nothing".
 */
export function formatPp1(value) {
    const pp = Math.round(value * 1000) / 10;
    return `${pp > 0 ? '+' : ''}${pp.toFixed(1)}pp`;
}
export function formatP(p) {
    return p < 0.0001 ? '<0.0001' : p.toFixed(4);
}
export function verdictFor(input) {
    const { improved, regressed, deltaPassRate } = input;
    const discordant = improved + regressed;
    if (discordant < MIN_DISCORDANT_FOR_SIGNIFICANCE) {
        return {
            verdict: 'inconclusive',
            reason: `only ${discordant} discordant pair(s) (Δpass ${formatDeltaPp(deltaPassRate)}); significance needs at least ${MIN_DISCORDANT_FOR_SIGNIFICANCE}`,
        };
    }
    const p = mcnemarExactP(improved, regressed);
    const detail = `${improved} improved vs ${regressed} regressed of ${discordant} discordant pair(s), McNemar exact p=${formatP(p)}`;
    if (p < 0.05 && deltaPassRate > 0) {
        return { verdict: 'effective', reason: detail };
    }
    if (p < 0.05 && deltaPassRate < 0) {
        return { verdict: 'ineffective', reason: detail };
    }
    return { verdict: 'inconclusive', reason: `not significant: ${detail}` };
}
export function buildWarnings(manifest) {
    const warnings = [];
    if (manifest.experiment && manifest.experiment.status !== 'completed') {
        warnings.push('Experiment did not complete its declared calls; no installation recommendation. Inspect _session.json and _calls.jsonl before planning a fresh run.');
    }
    if (manifest.skillDelivery) {
        warnings.push('Installed Skill mode measures task outcomes with native discovery and complete resources; activation is not guaranteed. Inherited agent configuration still applies.');
    }
    if (manifest.baselineTarget) {
        warnings.push('Skill revision comparison measures the target against the previous version, not against no Skill. A positive delta does not establish installation benefit or guarantee non-regression on unseen tasks.');
    }
    if (manifest.executor.kind === 'mock') {
        warnings.push('Executor is a mock: results are synthetic and only exercise the harness.');
    }
    for (const task of manifest.tasks) {
        for (const condition of CONDITIONS) {
            const stats = task.conditions[condition];
            if (stats.errors > 0) {
                const other = condition === 'baseline' ? 'treatment' : 'baseline';
                warnings.push(`Task "${task.id}" (${condition}): ${stats.errors} trial(s) hit an executor, verifier, or engagement error and were excluded from the rates, together with their paired ${other} trial(s) — an ungraded run is not a failure.`);
            }
        }
        const rate = task.conditions.baseline.passRate;
        if (rate >= DISCRIMINATION_BASELINE_THRESHOLD) {
            warnings.push(`Task "${task.id}": baseline pass rate is ${Math.round(rate * 100)}% (>= 90%) — this bench task may be too easy and the experiment may lack discriminative power.`);
        }
        if (task.conditions.baseline.trials > 0 && rate <= FLOOR_BASELINE_THRESHOLD) {
            warnings.push(`Task "${task.id}": baseline pass rate is ${Math.round(rate * 100)}% (<= 10%) — this bench task may be too hard or broken, and all-zero arms are uninformative.`);
        }
        for (const facet of task.facets) {
            if (facet.baselineTrials > 0 && facet.baselinePassRate >= DISCRIMINATION_BASELINE_THRESHOLD) {
                warnings.push(`Task "${task.id}" facet "${facet.name}": baseline check pass rate is ${Math.round(facet.baselinePassRate * 100)}% (>= 90%) — this facet is saturated and measures no lift.`);
            }
        }
        warnings.push(...task.verifierNotes);
    }
    const overallRate = manifest.overall.conditions.baseline.passRate;
    if (manifest.tasks.length > 1 && overallRate >= DISCRIMINATION_BASELINE_THRESHOLD) {
        warnings.push(`Overall baseline pass rate is ${Math.round(overallRate * 100)}% (>= 90%) — this bench may be too easy and the experiment may lack discriminative power.`);
    }
    const discordant = manifest.overall.stats.discordant.improved + manifest.overall.stats.discordant.regressed;
    if (discordant < MIN_DISCORDANT_FOR_SIGNIFICANCE) {
        warnings.push(`Only ${discordant} discordant pair(s) between conditions — a run this size can only certify very large effects; treat any delta as indicative.`);
    }
    return warnings;
}
function pad(text, width) {
    return text.length >= width ? text : text + ' '.repeat(width - text.length);
}
export function renderSummary(manifest, manifestPath) {
    const lines = [];
    lines.push(`Target   : ${manifest.target.name} (${manifest.target.kind}, bundle sha256 ${manifest.target.bundleSha256.slice(0, 12)}…, ${manifest.target.files.length} files)`);
    if (manifest.baselineTarget)
        lines.push(`Baseline : ${manifest.baselineTarget.name} (previous Skill, bundle sha256 ${manifest.baselineTarget.bundleSha256.slice(0, 12)}…, ${manifest.baselineTarget.files.length} files)`);
    lines.push(`Bench    : ${manifest.bench.name} (${manifest.bench.taskCount} task(s), content sha256 ${manifest.bench.contentSha256.slice(0, 12)}…)`);
    lines.push(`Input    : ${manifest.inputMode ?? 'snapshot (legacy manifest; not recorded)'}`);
    if (manifest.skillDelivery)
        lines.push('Delivery : installed complete Skill ' + (manifest.baselineTarget ? 'in both conditions ' : '') + 'at ' + manifest.skillDelivery.installDir + '/' + manifest.target.name);
    lines.push(`Executor : ${describeExecutor(manifest.executor)}`);
    lines.push(`Judge    : ${manifest.judge ? describeExecutor(manifest.judge) : 'disabled'}`);
    lines.push(`Trials   : ${manifest.trials} per condition`);
    if (manifest.experiment)
        lines.push(`Session  : ${manifest.experiment.status}; ${manifest.experiment.callsStarted}/${manifest.experiment.plannedCalls} calls started (ceiling ${manifest.experiment.maxCalls})`);
    lines.push('');
    const idWidth = Math.max(7, ...manifest.tasks.map((t) => t.id.length));
    const header = `${pad('TASK', idWidth)}  BASELINE     TREATMENT    DELTA    VERDICT`;
    lines.push(header);
    for (const task of manifest.tasks) {
        lines.push(renderRow(task.id, idWidth, task.conditions, task.deltaPassRate, task.verdict));
    }
    lines.push(renderRow('OVERALL', idWidth, manifest.overall.conditions, manifest.overall.deltaPassRate, manifest.overall.verdict));
    lines.push('');
    const stats = manifest.overall.stats;
    lines.push(`Significance (overall): ${stats.discordant.improved} improved vs ${stats.discordant.regressed} regressed discordant pair(s), McNemar exact p=${formatP(stats.mcnemarP)}`);
    lines.push(stats.deltaCi
        ? `Δpass 95% CI (paired bootstrap, ${stats.deltaCi.resamples} resamples): [${formatPp1(stats.deltaCi.lo)}, ${formatPp1(stats.deltaCi.hi)}]`
        : 'Δpass 95% CI: n/a (no trials)');
    if (stats.deltaCi) {
        const halfWidthPp = ((stats.deltaCi.hi - stats.deltaCi.lo) / 2) * 100;
        lines.push(`Observed Δpass CI half-width: ±${halfWidthPp.toFixed(1)}pp; this is a bootstrap summary, not a validated minimum detectable effect`);
    }
    const anyScores = manifest.tasks.some((task) => task.scoreDelta !== null);
    if (anyScores) {
        lines.push(stats.scoreDeltaCi
            ? `Δscore 95% CI (paired bootstrap, ${stats.scoreDeltaCi.resamples} resamples): [${signedScore(stats.scoreDeltaCi.lo)}, ${signedScore(stats.scoreDeltaCi.hi)}]`
            : 'Δscore 95% CI: n/a (no task scored in both arms)');
    }
    if ((stats.deltaCi && stats.deltaCi.lo === stats.deltaCi.hi)
        || (anyScores && stats.scoreDeltaCi && stats.scoreDeltaCi.lo === stats.scoreDeltaCi.hi)) {
        lines.push('The bootstrap interval collapsed on the observed tasks; it does not establish zero uncertainty or validated effect resolution.');
    }
    const replicatedTasks = manifest.tasks.filter(t => Math.min(t.conditions.baseline.trials, t.conditions.treatment.trials) >= CONCLUSIVE_TRIALS).length;
    if (replicatedTasks < CONCLUSIVE_TASKS) {
        lines.push(`Scale: ${manifest.bench.taskCount} task(s) × ${manifest.trials} trials per condition — below the conclusive bar (${CONCLUSIVE_TASKS} tasks × ${CONCLUSIVE_TRIALS} trials); results are indicative for broader claims even if the within-bench verdict is statistically significant.`);
        lines.push(`Completed scale: ${replicatedTasks} task(s) have at least ${CONCLUSIVE_TRIALS} graded pairs after exclusions.`);
    }
    const tokenLines = renderTokenDeltas(manifest);
    if (tokenLines.length > 0) {
        lines.push('');
        lines.push(...tokenLines);
    }
    if (manifest.overall.costs)
        lines.push('', 'Cost accounting:', ...renderCostLines(manifest.overall.costs));
    const facetLines = renderFacetScores(manifest);
    if (facetLines.length > 0) {
        lines.push('');
        lines.push(...facetLines);
    }
    lines.push('');
    lines.push('Warnings:');
    if (manifest.warnings.length === 0) {
        lines.push('- none');
    }
    else {
        for (const warning of manifest.warnings)
            lines.push(`- ${warning}`);
    }
    lines.push('');
    lines.push(`Manifest: ${manifestPath}`);
    return lines.join('\n');
}
function renderRow(id, idWidth, conditions, deltaPassRate, verdict) {
    const baseline = formatPassRate(conditions.baseline.passes, conditions.baseline.trials);
    const treatment = formatPassRate(conditions.treatment.passes, conditions.treatment.trials);
    return `${pad(id, idWidth)}  ${pad(baseline, 12)} ${pad(treatment, 12)} ${pad(formatDeltaPp(deltaPassRate), 8)} ${verdict}`;
}
function renderTokenDeltas(manifest) {
    const rows = manifest.tasks.filter((task) => task.tokenDelta !== null);
    if (rows.length === 0 || manifest.overall.tokenDelta === null)
        return [];
    const lines = ['Token delta (treatment - baseline):'];
    for (const task of rows) {
        const delta = task.tokenDelta;
        if (delta)
            lines.push(`- ${task.id}: input ${signed(delta.input)}, output ${signed(delta.output)}`);
    }
    const overall = manifest.overall.tokenDelta;
    if (overall)
        lines.push(`- overall: input ${signed(overall.input)}, output ${signed(overall.output)}`);
    const baseline = manifest.overall.conditions.baseline;
    const treatment = manifest.overall.conditions.treatment;
    const totalTokens = (condition) => condition.tokens ? condition.tokens.input + condition.tokens.output : null;
    const costBaseline = totalTokens(baseline);
    const costTreatment = totalTokens(treatment);
    const covered = (condition) => condition.trials > 0 &&
        condition.tokenCoverage !== undefined &&
        condition.tokenCoverage.input === condition.trials &&
        condition.tokenCoverage.output === condition.trials;
    if (costBaseline !== null &&
        costTreatment !== null &&
        baseline.passRate > 0 &&
        treatment.passRate > 0 &&
        covered(baseline) &&
        covered(treatment)) {
        const ratio = costTreatment / treatment.trials / treatment.passRate / (costBaseline / baseline.trials / baseline.passRate);
        lines.push(`- cost-of-pass ratio (treatment / baseline): ${ratio.toFixed(2)} (lower is better)`);
    }
    return lines;
}
function signed(value) {
    return value > 0 ? `+${value}` : String(value);
}
function signedScore(value) {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}
function renderFacetScores(manifest) {
    const rows = manifest.tasks.filter((task) => task.facets.length > 0);
    if (rows.length === 0)
        return [];
    const percent = (rate) => `${Math.round(rate * 100)}%`;
    const mean = (value) => (value === null ? 'n/a' : value.toFixed(2));
    const delta = (value) => (value === null ? 'n/a' : signedScore(value));
    const lines = ['Facet scores (mean checks passed, baseline → treatment):'];
    for (const task of rows) {
        lines.push(`- ${task.id}: score ${mean(task.conditions.baseline.meanScore)} → ${mean(task.conditions.treatment.meanScore)} (Δ ${delta(task.scoreDelta)})`);
        for (const facet of task.facets) {
            lines.push(`  - ${facet.name}: ${percent(facet.baselinePassRate)} → ${percent(facet.treatmentPassRate)}`);
        }
    }
    return lines;
}
function describeExecutor(descriptor) {
    const base = `${descriptor.kind} (${descriptor.model})`;
    return descriptor.detail ? `${base} — ${descriptor.detail}` : base;
}
