import assert from 'node:assert/strict';
import { appendFileSync, constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewedArchive } from './release-source.mjs';
// Link receipts before CLI evaluation: they also import the acceptance contracts.
import { exportRecords } from './release-records.mjs';

const json = file => JSON.parse(readFileSync(file, 'utf8'));
const save = (file, value, exclusive = true) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', exclusive ? { flag: 'wx' } : {});
export const ACCEPTANCE_STAGES = ['registry-install', 'documents', 'examples', 'features', 'provenance', 'signatures'];

export function acceptanceMarkdown(state) {
  return `## Release ${state.version}: ${state.status}\n\nSource: \`${state.sourceCommit}\`. Upload: ${state.uploadAccepted ? 'accepted; never repeat' : 'not established'}.\n\n` +
    '| Check | Status |\n| --- | --- |\n' + state.checks.map(check => `| ${check.id} | ${check.status} |`).join('\n') +
    (state.records ? `\n\nReceipt generation: **${state.records.status}**${state.records.error ? ` (${state.records.error.replace(/[\r\n|]/g, ' ')})` : ''}.` : '') +
    '\n\nExact receipts and failed observations are retained as workflow artifacts. This status does not authorize a Skill upgrade.\n';
}

export async function runAcceptance(root, info, stages, { now = () => new Date().toISOString() } = {}) {
  assert.deepEqual(stages.map(stage => stage.id), ACCEPTANCE_STAGES, 'All release checks are required, once and in order');
  const file = join(root, 'acceptance-state.json'); assert.ok(!existsSync(file), 'Preserve previous attempts; use a new directory');
  const state = { schemaVersion: 1, ...info, status: 'running', checks: stages.map(({ id }) => ({ id, status: 'pending' })), events: [] };
  save(file, state);
  const checkpoint = (check, status, error) => {
    check.status = status;
    if (error) check.error = error.message;
    state.events.push({ id: check.id, status, at: now(), ...(error ? { error: error.message } : {}) }); save(file, state, false);
  };
  try {
    for (const [i, stage] of stages.entries()) {
      const check = state.checks[i]; checkpoint(check, 'running');
      try {
        const result = await stage.run();
        assert.ok(result && typeof result === 'object', 'A check must return an actual receipt');
        const receipt = `acceptance-${stage.id}.json`; save(join(root, receipt), result); check.receipt = receipt;
        checkpoint(check, 'passed');
      } catch (error) { checkpoint(check, 'failed', error); throw error; }
    }
    state.status = 'passed'; return state;
  } catch (error) { state.status = 'failed'; throw error;
  } finally {
    state.finishedAt = now(); save(file, state, false);
    writeFileSync(join(root, 'acceptance-summary.md'), acceptanceMarkdown(state), { flag: 'wx' });
  }
}

export function markUploaded(root, env = process.env) {
  const { pack, sha256 } = reviewedArchive(root), preview = json(join(root, 'preview.json'));
  assert.equal(env.GITHUB_SHA, preview.sourceCommit); assert.equal(env.GITHUB_RUN_ATTEMPT, '1');
  const result = { schemaVersion: 1, version: pack.version, sourceCommit: preview.sourceCommit, sha256,
    runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT, uploadAccepted: true, uploadCount: 1, at: new Date().toISOString() };
  save(join(root, 'publication.json'), result); return result;
}

export function prepareRecovery(original, requested) {
  original = realpathSync(original);
  const target = join(realpathSync(dirname(resolve(requested))), basename(requested)), rel = relative(original, target);
  assert.ok(rel && (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\')), 'Recovery output must be fresh and outside the original evidence');
  const archive = reviewedArchive(original), preview = json(join(original, 'preview.json')), intent = json(join(original, 'publication-intent.json'));
  assert.equal(intent.sha256, archive.sha256); assert.equal(intent.version, archive.pack.version); assert.equal(intent.sourceCommit, preview.sourceCommit);
  mkdirSync(target);
  for (const name of ['pack.json', archive.pack.filename, 'preview.json', 'source-ci.json', 'publication-intent.json', ...(existsSync(join(original, 'publication.json')) ? ['publication.json'] : [])]) {
    copyFileSync(join(original, name), join(target, name), constants.COPYFILE_EXCL);
  }
  const observations = readdirSync(original).filter(name => /^registry-(read|install-attempt)-\d+\.json$/.test(name)).map(name => ({ name, value: json(join(original, name)) }));
  save(join(target, 'prior-attempt.json'), { original, sourceCommit: intent.sourceCommit, runId: intent.runId,
    ...(existsSync(join(original, 'acceptance-state.json')) ? { state: json(join(original, 'acceptance-state.json')) } : {}), observations });
  return target;
}

export function summarize(root, status, dryRun, summaryPath = process.env.GITHUB_STEP_SUMMARY) {
  const stateFile = join(root, 'acceptance-state.json');
  const read = file => { try { return json(file); } catch { return null; } };
  const original = read(stateFile);
  const state = original ?? {
    version: read(join(root, 'pack.json'))?.[0]?.version ?? 'unknown',
    sourceCommit: process.env.GITHUB_SHA ?? 'unknown', status: dryRun && status === 'success' ? 'preview-passed' : 'preparation-or-upload-failed',
    uploadAccepted: existsSync(join(root, 'publication.json')), checks: ACCEPTANCE_STAGES.map(id => ({ id, status: 'pending' })),
  };
  if (original && status !== 'success' && state.status === 'running') state.status = 'interrupted';
  if (original && status !== 'success' && state.status === 'passed') state.status = 'verification-passed-delivery-failed';
  mkdirSync(root, { recursive: true });
  save(join(root, 'workflow-summary.json'), { ...state, jobStatusAtSummary: status });
  let text = acceptanceMarkdown(state);
  const preview = read(join(root, 'preview.json'));
  if (dryRun && status === 'success' && preview?.schemaVersion === 2) text +=
    `\nPreview run/attempt: **${preview.runId}/${preview.runAttempt}**; archive SHA-256: \`${preview.sha256}\`.\n` +
    `\n[Complete source CI](${preview.ci.url}). After review and publication authorization:\n\n` +
    '```bash\n' + `gh workflow run npm-release.yml --repo remote-controlled-man/skillfit --ref main -f dry_run=false -f preview_run_id=${preview.runId} -f preview_run_attempt=${preview.runAttempt}\n` + '```\n';
  writeFileSync(join(root, 'workflow-summary.md'), text, { flag: 'wx' });
  if (summaryPath) appendFileSync(summaryPath, text); return state;
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, requested, status, dry] = process.argv.slice(2); assert.ok(requested, 'Provide a release result directory'); const root = resolve(requested);
  if (mode === 'uploaded') markUploaded(root);
  else if (mode === 'summary') summarize(root, status, dry === 'true');
  else if (mode === 'verify' || mode === 'recover') {
    const { acceptanceChecks, recoverUpload } = await import('./release-checks.mjs');
    const attempt = mode === 'recover' ? prepareRecovery(root, status) : root;
    if (!existsSync(join(attempt, 'publication.json'))) await recoverUpload(attempt);
    const publication = json(join(attempt, 'publication.json')), archive = reviewedArchive(attempt);
    assert.equal(publication.version, archive.pack.version); assert.equal(publication.sha256, archive.sha256);
    assert.equal(publication.uploadAccepted, true); assert.match(publication.sourceCommit, /^[a-f0-9]{40}$/);
    const state = await runAcceptance(attempt, publication, acceptanceChecks(attempt, publication));
    try { exportRecords(attempt, state); state.records = { status: 'generated' };
    } catch (error) { state.records = { status: 'failed', error: error.message }; state.status = 'failed'; throw error;
    } finally { save(join(attempt, 'acceptance-state.json'), state, false); }
  } else throw new Error('Use uploaded, verify, recover or summary; these commands never publish');
}
