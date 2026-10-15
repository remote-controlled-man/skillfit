// Read-only proposal audit. No model, agent CLI, network or live launcher.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hashFileSet, listFilesRecursive, sha256File, sha256Text} from '../../dist/harness/hash.js';
import {loadBench} from '../../dist/harness/bench.js';
import {parseAcceptancePolicy} from '../../dist/harness/eval-contract.js';
import {parseSpendingBudget, spendingBudgetState} from '../../dist/harness/eval-budget.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
assert.equal(process.argv.length, 3, 'Supply the extracted unchanged failure archive directory');
const saved = resolve(process.argv[2]);
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const p = json(resolve(root, 'docs/plans/2026-10-15-receiver-mechanism-proposal.json'));
assert.equal(p.authorizedModelCalls, 0);
assert.equal(p.readyForModelCalls, false);
assert.equal(p.liveControllerImplemented, false);
assert.equal(p.plannedMaximumExecutorCalls, 2);
assert.equal(p.execution.executorTimeoutSeconds, 600);
assert.deepEqual(p.execution.order.map(row => row.arm), ['candidate', 'control']);
assert.ok(Object.values(p.execution.extraCalls).every(value => value === 0));
assert.equal(p.purpose, 'development');
assert.equal(p.independentValidation, false);
assert.equal(p.automaticUpgrade, false);
assert.equal(p.oldStoppedCohort.transferUnusedAllowance, false);
assert.equal(p.historicalStudyCalls + p.plannedMaximumExecutorCalls, p.maximumStudyCallsIfSeparatelyAuthorized);
for (const pin of p.pins) assert.equal(sha256File(resolve(root, pin.path)), pin.sha256, pin.path);
const basis = p.historicalBudgetBasis;
assert.equal(sha256File(resolve(root, basis.archive)), basis.archiveSha256);
assert.equal(sha256File(resolve(saved, 'package-index.json')), basis.extractedIndexSha256);
const index = json(resolve(saved, 'package-index.json'));
for (const row of index.files) assert.equal(sha256File(resolve(saved, row.path)), row.sha256, row.path);
const historical = json(resolve(saved, 'execution/analysis.json'));
assert.equal(historical.cumulative.actualExecutorCalls, p.historicalStudyCalls);
assert.equal(historical.cumulative.missingPublicFinalUsage, p.historicalUnknownPublicFinalUsages);
const bench = loadBench(resolve(root, p.task.sourceBench));
assert.equal(bench.contentSha256, p.task.sourceBenchSha256);
assert.deepEqual(bench.tasks.find(task => task.id === p.task.id), p.task.definition);
assert.equal(sha256File(resolve(bench.dir, p.task.prompt)), p.task.promptSha256);
const fixture = resolve(bench.dir, p.task.fixture);
assert.equal(hashFileSet(fixture, listFilesRecursive(fixture)), p.task.fixtureSha256);
for (const arm of Object.values(p.arms).filter(value => value.path)) {
	const dir = resolve(root, arm.path);
	assert.equal(hashFileSet(dir, listFilesRecursive(dir)), arm.sha256);
}
const control = resolve(root, p.arms.control.path), candidate = resolve(root, p.arms.candidate.path);
assert.deepEqual(listFilesRecursive(control), listFilesRecursive(candidate));
for (const file of listFilesRecursive(control).filter(file => file !== 'SKILL.md')) {
	assert.equal(sha256File(resolve(control, file)), sha256File(resolve(candidate, file)));
}
assert.equal(readFileSync(resolve(candidate, 'SKILL.md')).length - readFileSync(resolve(control, 'SKILL.md')).length, p.arms.onlySkillDelta.addedBytes);
const policy = parseAcceptancePolicy(p.acceptance.adoptionPolicyUnchanged);
assert.equal(sha256Text(JSON.stringify(policy)), p.acceptance.adoptionPolicySha256);
assert.equal(policy.minTasks, 8);
assert.equal(policy.minTrialsPerTask, 5);
const limits = parseSpendingBudget(p.budget.stopLines), metrics = Object.keys(limits);
const round = n => Math.round(n * 1000) / 1000;
for (const sample of basis.samples) {
	const path = resolve(saved, sample.recordPath), row = json(path);
	assert.equal(sha256File(path), sample.recordSha256);
	assert.deepEqual(sample.metrics, {input: row.tokens.input, cachedInput: row.tokens.cachedInput,
		uncachedInput: row.tokens.input - row.tokens.cachedInput, output: row.tokens.output, durationSeconds: row.durationSeconds});
	assert.equal(row.passed, sample.passed);
}
for (const metric of metrics) {
	assert.equal(basis.historicalMixedOriginalAndV4Reference[metric], round(basis.samples.reduce((sum, row) => sum + row.metrics[metric], 0)));
	assert.equal(basis.twiceHistoricalV4Reference[metric], round(basis.samples[0].metrics[metric] * 2));
	assert.equal(p.budget.secondCallAdmission.firstReceiptMustBeStrictlyBelow[metric] * 2, limits[metric]);
}
const observation = (input = 197021, cachedInput = 172800, output = 5912, durationSeconds = 184.285) => ({
	executorInvoked: true, passed: true, error: null, usageStatus: 'final',
	tokens: {input, cachedInput, output}, durationSeconds,
});
// A simulation of the proposed rule, not certification of a future live controller.
const mayStartControl = (receipts, flags = [true, true, true, true, true, true]) => {
	if (receipts.length !== 1 || !flags.every(value => value === true)) return false;
	const state = spendingBudgetState(limits, receipts);
	return !state.reason && metrics.every(metric => state.metrics[metric].knownTotal < p.budget.secondCallAdmission.firstReceiptMustBeStrictlyBelow[metric]);
};
const simulations = [];
const check = (name, operation) => { operation(); simulations.push(name); };
check('Complete low-cost candidate may reach the control gate', () => assert.equal(mayStartControl([observation()]), true));
check('No call or a completed pair cannot start the control', () => {
	assert.equal(mayStartControl([]), false); assert.equal(mayStartControl([observation(), observation()]), false);
});
check('Each false or unknown prerequisite blocks the control', () => {
	for (let i = 0; i < 6; i++) for (const value of [false, null]) {
		const flags = Array(6).fill(true); flags[i] = value;
		assert.equal(mayStartControl([observation()], flags), false);
	}
});
const reachedRows = {
	input: observation(600000, 500000, 1, 1), cachedInput: observation(500001, 500000, 1, 1),
	uncachedInput: observation(100001, 1, 1, 1), output: observation(2, 1, 20000, 1),
	durationSeconds: observation(2, 1, 1, 1200),
};
for (const metric of metrics) check(`${metric}: at the batch line stops further calls`, () => {
	const state = spendingBudgetState(limits, [reachedRows[metric]]);
	assert.ok(state.reached.includes(metric)); assert.equal(state.reason, 'SPENDING_BUDGET_REACHED');
	assert.equal(mayStartControl([reachedRows[metric]]), false);
});
const reserveRows = {
	input: observation(300000, 250000, 1, 1), cachedInput: observation(250001, 250000, 1, 1),
	uncachedInput: observation(50001, 1, 1, 1), output: observation(2, 1, 10000, 1),
	durationSeconds: observation(2, 1, 1, 600),
};
for (const metric of metrics) check(`${metric}: at the first-call admission line also stops`, () => {
	assert.equal(spendingBudgetState(limits, [reserveRows[metric]]).reason, null);
	assert.equal(mayStartControl([reserveRows[metric]]), false);
});
for (const [name, row, reason] of [
	['Missing final usage', {...observation(), tokens: null, usageStatus: 'unknown'}, 'FINAL_USAGE_MISSING'],
	['Partial final usage', {...observation(), usageStatus: 'partial'}, 'FINAL_USAGE_MISSING'],
	['Execution failure', {...observation(), error: 'failed'}, 'EXECUTION_FAILED'],
]) check(`${name} prevents continuation`, () => {
	assert.equal(spendingBudgetState(limits, [row]).reason, reason); assert.equal(mayStartControl([row]), false);
});
console.log(JSON.stringify({kind: 'skillfit.receiver-mechanism-proposal-audit', proposalValid: true,
	modelCalls: 0, agentCliCalls: 0, authorizedFutureModelCalls: 0, readyForModelCalls: false,
	liveControllerTested: false, indexedHistoricalFilesVerified: index.files.length,
	historicalStudyCalls: p.historicalStudyCalls, policySha256: p.acceptance.adoptionPolicySha256,
	stopLines: limits, historicalMixedReference: basis.historicalMixedOriginalAndV4Reference,
	twiceV4Reference: basis.twiceHistoricalV4Reference, simulations}, null, 2));
