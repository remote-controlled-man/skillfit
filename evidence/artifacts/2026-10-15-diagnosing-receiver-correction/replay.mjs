// Offline development replay: no model, agent CLI, network or dependency install.
import assert from 'node:assert/strict';
import {cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
assert.ok(process.argv[2], 'Usage: node replay.mjs <extracted regression-stop archive>');
const saved = resolve(process.argv[2]);
const read = path => readFileSync(path, 'utf8');
const json = path => JSON.parse(read(path));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const archive = join(here, '../2026-10-15-independent-comparison-regression-stop/package.tar.gz');
const archiveSha256 = '6a4d29e55a1b48b7e8cd4e790eb057341b08e92ede7e6fe903a015a6edfe3ed6';
assert.equal(sha(archive), archiveSha256, 'original failure archive must remain unchanged');
for (const row of json(join(saved, 'package-index.json')).files) {
	assert.equal(sha(join(saved, row.path)), row.sha256, row.path);
}
// Regrade all twelve original deliveries, including the rejected v4, unchanged.
const oldReplay = JSON.parse(execFileSync(process.execPath, [join(saved, 'replay.mjs')], {
	encoding: 'utf8', timeout: 120_000,
}));
assert.equal(oldReplay.decision, 'reject');
assert.equal(oldReplay.cumulativeCalls, 194);
assert.equal(oldReplay.regraded, 12);

const {testRun} = await import(pathToFileURL(join(saved, 'bench/verifiers/regression-evidence.mjs')));
const {hashFileSet, listFilesRecursive} = await import(pathToFileURL(join(saved, 'runner/dist/harness/hash.js')));
const fixture = join(saved, 'bench/fixtures/timeout-custom-timers');
const treatment = join(saved, 'records/continuation/timeout-custom-timers/treatment/trial-1');
const baseline = join(saved, 'records/continuation/timeout-custom-timers/baseline/trial-1');
const v4Source = read(join(treatment, 'index.js'));
// A human-written repair demonstration. No claim that the new Skill generated it.
const optionsEnd = '\t} = options;\n';
assert.equal(v4Source.split(optionsEnd).length, 2);
let manualSource = v4Source.replace(optionsEnd, optionsEnd + '\tconst {setTimeout: scheduleTimeout, clearTimeout: cancelTimeout} = customTimers;\n');
for (const [before, after] of [
	['customTimers.setTimeout.call(globalThis, ', 'scheduleTimeout('],
	['customTimers.clearTimeout.call(globalThis, ', 'cancelTimeout('],
]) {
	assert.equal(manualSource.split(before).length, 2);
	manualSource = manualSource.replace(before, after);
}
const sources = {
	original: read(join(fixture, 'index.js')),
	v4Delivery: v4Source,
	baselineDelivery: read(join(baseline, 'index.js')),
	maintainer: read(join(saved, 'bench/ground-truth/timeout-custom-timers/index.js')),
	manualRepair: manualSource,
};
const summarize = result => {
	assert.equal(result.completed, true, 'a timeout is not diagnostic evidence');
	assert.equal(result.tests, true, 'registered tests required');
	assert.equal(result.noSkips, true, 'skips, cancellations or todos are not evidence');
	const records = result.records.filter(row => row.registered && row.leaf);
	return {passed: result.passed, tests: records.length, passing: records.filter(row => row.pass).length,
		failing: records.filter(row => !row.pass).map(row => row.path)};
};
const variants = [];
for (const [variant, source] of Object.entries(sources)) {
	const scratch = mkdtempSync(join(tmpdir(), 'skillfit-receiver-correction-'));
	try {
		// Immutable fixture and failed delivery remain the backups of all scratch edits.
		cpSync(fixture, scratch, {recursive: true});
		writeFileSync(join(scratch, 'index.js'), source);
		cpSync(join(treatment, 'custom-timers.test.mjs'), join(scratch, 'custom-timers.test.mjs'));
		const originalGeneratedTests = summarize(testRun(scratch, ['custom-timers.test.mjs']));
		assert.equal(originalGeneratedTests.tests, 5);
		assert.equal(originalGeneratedTests.passing, variant === 'v4Delivery' ? 5 : 0);
		// Keep the wrong regression in the saved archive; use the corrected seam only here.
		rmSync(join(scratch, 'custom-timers.test.mjs'));
		cpSync(join(here, 'receiver-contract.test.mjs'), join(scratch, 'receiver-contract.test.mjs'));
		const receiverContracts = summarize(testRun(scratch, ['receiver-contract.test.mjs']));
		const repaired = ['baselineDelivery', 'maintainer', 'manualRepair'].includes(variant);
		assert.equal(receiverContracts.tests, 18);
		assert.equal(receiverContracts.passing, repaired ? 18 : 8);
		const env = {...process.env};
		delete env.NODE_TEST_CONTEXT;
		const graded = spawnSync(process.execPath, [join(saved, 'bench/verifiers/timeout-custom-timers.mjs'), scratch], {
			encoding: 'utf8', timeout: 60_000, env,
		});
		assert.ifError(graded.error);
		assert.equal(graded.signal, null);
		assert.equal(graded.status, repaired ? 0 : 1);
		const grade = JSON.parse(graded.stdout.trim());
		assert.equal(grade.checks.length, 6);
		assert.equal(grade.checks.filter(row => row.pass).length, repaired ? 6 : 3);
		assert.equal(grade.passed, repaired);
		if (repaired) {
			assert.ok(grade.evidence.every(row => row.finalPassed && row.referencePassed && row.originalFailed));
			assert.equal(grade.evidence.flatMap(row => row.caseWitnesses).length, 10);
		}
		variants.push({variant, sourceSha256: createHash('sha256').update(source).digest('hex'),
			originalGeneratedTests, receiverContracts,
			verifierWithCorrectedRegression: {passed: grade.passed, checks: grade.checks.map(({name, pass}) => ({name, pass})),
				witnesses: grade.evidence.flatMap(row => row.caseWitnesses)}});
	} finally {
		rmSync(scratch, {recursive: true, force: true});
	}
}
const candidate = resolve(here, '../../inputs/diagnosing-bugs-compact-v4.1-receiver');
const oldSkill = join(saved, 'skills/v4');
assert.deepEqual(listFilesRecursive(candidate), listFilesRecursive(oldSkill));
for (const file of listFilesRecursive(candidate).filter(file => file !== 'SKILL.md')) {
	assert.equal(sha(join(candidate, file)), sha(join(oldSkill, file)), file);
}
const oldText = read(join(oldSkill, 'SKILL.md')), newText = read(join(candidate, 'SKILL.md'));
assert.equal(newText.split('---')[1], oldText.split('---')[1], 'frontmatter must remain unchanged');
const result = {
	kind: 'skillfit.offline-receiver-correction', schemaVersion: 1,
	modelCalls: 0, extraScoredTasks: 0, independentValidation: false,
	skillBehaviorTested: false, automaticUpgrade: false, cumulativeCalls: 194,
	archiveSha256, originalReplay: oldReplay,
	candidate: {sha256: hashFileSet(candidate, listFilesRecursive(candidate)),
		parentSha256: hashFileSet(oldSkill, listFilesRecursive(oldSkill)),
		skillMdBeforeBytes: Buffer.byteLength(oldText), skillMdAfterBytes: Buffer.byteLength(newText),
		addedBytes: Buffer.byteLength(newText) - Buffer.byteLength(oldText),
		addedWhitespaceWords: newText.trim().split(/\s+/).length - oldText.trim().split(/\s+/).length,
		measuredModelTokenDelta: null, otherResourcesUnchanged: true},
	receiverTestSha256: sha(join(here, 'receiver-contract.test.mjs')),
	variants,
};
if (existsSync(join(here, 'expected.json'))) assert.deepEqual(result, json(join(here, 'expected.json')));
console.log(JSON.stringify(result, null, 2));
