import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPOSITORY = 'remote-controlled-man/skillfit';
export const SYSTEMS = ['windows-latest', 'ubuntu-latest', 'macos-latest'];
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const numeric = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 && String(Number(value)) === String(value);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function mainRun(run, source, workflow) {
  assert.match(source, /^[a-f0-9]{40}$/);
  assert.equal(run.repository?.full_name, REPOSITORY, 'Run must belong to the release repository');
  assert.equal(run.head_repository?.full_name, REPOSITORY, 'Fork artifacts cannot be promoted');
  assert.equal(run.path, `.github/workflows/${workflow}`);
  assert.equal(run.head_branch, 'main');
  assert.equal(run.head_sha, source, 'Run source changed');
  assert.ok(numeric(run.id) && numeric(run.run_attempt), 'Exact run and attempt required');
  assert.equal(run.status, 'completed', `Source run is not complete: https://github.com/${REPOSITORY}/actions/runs/${run.id}`);
  assert.equal(run.conclusion, 'success', 'Source run did not succeed');
}

export function validateCiEvidence(run, jobs, receipts, source) {
  mainRun(run, source, 'ci.yml');
  assert.equal(run.event, 'push', 'Release requires main push CI');
  assert.equal(receipts.length, SYSTEMS.length);
  for (const os of SYSTEMS) {
    const found = jobs.filter(job => job.name === `test (${os})`);
    assert.equal(found.length, 1, `Missing or ambiguous CI job: ${os}`);
    assert.equal(found[0].status, 'completed'); assert.equal(found[0].conclusion, 'success');
    const rows = receipts.filter(row => row.os === os); assert.equal(rows.length, 1);
    const row = rows[0];
    assert.equal(row.schemaVersion, 1); assert.equal(row.kind, 'skillfit.ci-result');
    assert.equal(row.repository, REPOSITORY); assert.equal(row.sourceCommit, source);
    assert.equal(String(row.runId), String(run.id)); assert.equal(String(row.runAttempt), String(run.run_attempt));
    assert.equal(row.scope, 'full', 'Record-only CI cannot authorize a release');
    assert.equal(row.status, 'passed');
    const c = row.counts;
    assert.ok(c && ['tests', 'pass', 'fail', 'cancelled', 'skipped'].every(k => Number.isSafeInteger(c[k]) && c[k] >= 0));
    assert.ok(c.tests > 0 && c.pass > 0 && c.fail === 0 && c.cancelled === 0 && c.pass + c.skipped === c.tests, 'Actual successful test counts required');
  }
  return { schemaVersion: 1, repository: REPOSITORY, sourceCommit: source, runId: String(run.id), runAttempt: String(run.run_attempt),
    url: `https://github.com/${REPOSITORY}/actions/runs/${run.id}`, systems: receipts };
}

export function reviewedArchive(root) {
  assert.ok(lstatSync(join(root, 'pack.json')).isFile(), 'Pack manifest must be an ordinary file');
  const entries = json(join(root, 'pack.json')); assert.equal(entries.length, 1);
  const pack = entries[0]; assert.equal(pack.name, 'skillfit'); assert.match(pack.version, /^\d+\.\d+\.\d+$/);
  assert.equal(pack.filename, `skillfit-${pack.version}.tgz`);
  const file = join(root, pack.filename); assert.ok(lstatSync(file).isFile(), 'Archive must be an ordinary file');
  const bytes = readFileSync(file); assert.equal(bytes.length, pack.size);
  assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, pack.integrity, 'Archive integrity changed');
  return { pack, sha256: sha256(bytes), bytes };
}

export function validatePreview(run, preview, archive, source, version, ci) {
  mainRun(run, source, 'npm-release.yml'); assert.equal(run.event, 'workflow_dispatch');
  assert.equal(preview.schemaVersion, 2); assert.equal(preview.dryRun, true, 'Only a preview may authorize publication');
  assert.equal(String(preview.runId), String(run.id)); assert.equal(String(preview.runAttempt), String(run.run_attempt));
  assert.equal(preview.sourceCommit, source); assert.equal(preview.version, version);
  assert.equal(archive.pack.version, version); assert.equal(preview.name, archive.pack.name);
  assert.equal(preview.integrity, archive.pack.integrity); assert.equal(preview.sha256, archive.sha256);
  assert.equal(preview.size, archive.pack.size);
  assert.equal(preview.ci.runId, ci.runId); assert.equal(preview.ci.runAttempt, ci.runAttempt);
  assert.equal(preview.ci.sourceCommit, source);
  return preview;
}

export function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', timeout: 90_000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

export function collectSourceCi(root, source, command = gh) {
  assert.match(source, /^[a-f0-9]{40}$/);
  mkdirSync(root); // Exclusive, including failed source checks.
  const response = JSON.parse(command(['api', `repos/${REPOSITORY}/actions/workflows/ci.yml/runs?head_sha=${source}&event=push&per_page=1`]));
  assert.equal(response.workflow_runs?.length, 1, 'No exact-source main CI; wait for its run, then start preview');
  const run = response.workflow_runs[0]; mainRun(run, source, 'ci.yml');
  save(join(root, 'source-ci-run.json'), run);
  const jobs = JSON.parse(command(['api', `repos/${REPOSITORY}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`]));
  assert.ok(jobs.total_count <= 100, 'Unexpected CI pagination');
  const receipts = [];
  for (const os of SYSTEMS) {
    const dir = join(root, 'ci', os); mkdirSync(dir, { recursive: true });
    command(['run', 'download', String(run.id), '--repo', REPOSITORY, '--name', `ci-result-${run.run_attempt}-${os}`, '--dir', dir]);
    receipts.push(json(join(dir, 'ci-result.json')));
  }
  const result = validateCiEvidence(run, jobs.jobs, receipts, source); save(join(root, 'source-ci.json'), result);
  return result;
}

export function recordPreview(root, env = process.env) {
  const archive = reviewedArchive(root), ci = json(join(root, 'source-ci.json'));
  assert.equal(ci.sourceCommit, env.GITHUB_SHA); assert.ok(numeric(env.GITHUB_RUN_ID) && numeric(env.GITHUB_RUN_ATTEMPT));
  const result = { schemaVersion: 2, name: archive.pack.name, version: archive.pack.version, integrity: archive.pack.integrity,
    size: archive.pack.size, sha256: archive.sha256, sourceCommit: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT, ci, dryRun: true, modelCalls: 0 };
  save(join(root, 'preview.json'), result); return result;
}

export function promotePreview(root, id, source, version, command = gh, attempt = '1') {
  assert.ok(numeric(id), 'Formal publication requires an explicit preview_run_id');
  assert.ok(numeric(attempt), 'An exact reviewed preview attempt is required');
  const run = JSON.parse(command(['api', `repos/${REPOSITORY}/actions/runs/${id}/attempts/${attempt}`]));
  mainRun(run, source, 'npm-release.yml');
  assert.equal(String(run.id), String(id)); assert.equal(String(run.run_attempt), String(attempt));
  const dir = join(root, 'approved-preview'); mkdirSync(dir);
  command(['run', 'download', String(id), '--repo', REPOSITORY, '--name', `npm-release-${id}-${run.run_attempt}`, '--dir', dir]);
  const archive = reviewedArchive(dir), preview = json(join(dir, 'preview.json'));
  validatePreview(run, preview, archive, source, version, json(join(root, 'source-ci.json')));
  for (const file of ['pack.json', archive.pack.filename, 'preview.json']) copyFileSync(join(dir, file), join(root, file), constants.COPYFILE_EXCL);
  save(join(root, 'approved-preview-run.json'), { id: String(id), attempt: String(run.run_attempt), sourceCommit: source, sha256: archive.sha256 });
  return preview;
}

export function claimPublication(root, env = process.env, command = gh) {
  assert.equal(env.GITHUB_RUN_ATTEMPT, '1', 'Publication reruns are forbidden; use read-only verification');
  const { pack, sha256: digest } = reviewedArchive(root);
  const previous = JSON.parse(command(['api', `repos/${REPOSITORY}/actions/artifacts?name=npm-publication-intent-${pack.version}&per_page=100`]));
  assert.equal(previous.total_count, 0, 'This version already has a publication intent; verify the original run, never upload again');
  assert.match(env.GITHUB_SHA, /^[a-f0-9]{40}$/); assert.ok(numeric(env.GITHUB_RUN_ID));
  const intent = { schemaVersion: 1, version: pack.version, sourceCommit: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT, sha256: digest, status: 'publication-intended', uploadCountLimit: 1 };
  save(join(root, 'publication-intent.json'), intent); return intent;
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, requested, id, attempt = '1'] = process.argv.slice(2);
  assert.ok(requested, 'Provide a release result directory'); const root = resolve(requested);
  let result;
  if (mode === 'ci') result = collectSourceCi(root, process.env.GITHUB_SHA);
  else if (mode === 'preview') result = recordPreview(root);
  else if (mode === 'promote') result = promotePreview(root, id, process.env.GITHUB_SHA, json('package.json').version, gh, attempt);
  else if (mode === 'claim') result = claimPublication(root);
  else throw new Error('Use ci, preview, promote or claim');
  if (process.env.GITHUB_OUTPUT && result.version) appendFileSync(process.env.GITHUB_OUTPUT, `version=${result.version}\n`);
  console.log(JSON.stringify({ mode, sourceCommit: result.sourceCommit, version: result.version, runId: result.runId }));
}
