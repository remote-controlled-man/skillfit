import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDocumentation, readDocumentationBaseline } from './check-docs.mjs';
import { RELEASE_DOCUMENTS } from './recipes/release-docs-smoke.mjs';

const sha = value => /^[a-f0-9]{40}$/.test(value ?? '') && !/^0+$/.test(value);
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const UNKNOWN_DIFF_REASON = 'Unknown or unavailable diff baseline';

export function classifyChanges(changes) {
  if (!changes.length || changes.length > 256) return 'full';
  return changes.every(({ status, path, mode }) => {
    if (!['A', 'M'].includes(status) || mode !== '100644') return false;
    if (path === 'docs/work/current.md' && status === 'M') return true;
    if (/^docs\/plans\/[a-zA-Z0-9._-]+\.md$/.test(path)) return true;
    if (/^docs\/releases\/\d+\.\d+\.\d+\.md$/.test(path)) return true;
    if (status === 'A' && /^docs\/releases\/records\/\d+\.\d+\.\d+\/(?:registry-install|documents|examples|features|archives|history|provenance|signatures|source-ci|preview|publication|publication-intent|registry-metadata|attestations|published|prior-attempt|registry-observations|verification)\.json$/.test(path)) return true;
    if (status === 'A' && /^docs\/releases\/records\/\d+\.\d+\.\d+\/(?:signatures|registry-install-attempt-\d+)\.txt$/.test(path)) return true;
    return status === 'A' && /^docs\/releases\/\d+\.\d+\.\d+-[a-z0-9][a-z0-9-]*\.(json|txt)$/.test(path);
  }) ? 'records' : 'full';
}

export function changedFiles(base, head, git = args => execFileSync('git', args, { encoding: 'utf8' })) {
  assert.ok(sha(base) && sha(head), 'Exact diff commits are required');
  const parts = git(['diff', '--raw', '--no-abbrev', '--no-renames', '-z', base, head]).split('\0');
  const changes = [];
  while (parts[0]) {
    const header = parts.shift(), path = parts.shift();
    const match = /^:\d{6} (\d{6}) [a-f0-9]{40} [a-f0-9]{40} ([A-Z])$/.exec(header);
    assert.ok(match && path, 'Unsupported diff; use full CI');
    changes.push({ status: match[2], mode: match[1], path });
  }
  return changes;
}

export function scopeForEvent(eventName, event, head, git) {
  const base = eventName === 'pull_request' ? event.pull_request?.base?.sha : eventName === 'push' ? event.before : null;
  try {
    const changes = changedFiles(base, head, git);
    return { scope: classifyChanges(changes), base, head, changes, diffAvailable: true };
  } catch {
    return { scope: 'full', base: base ?? null, head, changes: [], diffAvailable: false, reason: UNKNOWN_DIFF_REASON };
  }
}

function localFile(root, file) {
  const requested = resolve(root, file), actual = realpathSync(requested), rel = relative(realpathSync(root), actual);
  assert.ok(rel && !isAbsolute(rel) && !rel.startsWith('..' + sep) && rel !== '..', `Unsafe record: ${file}`);
  assert.ok(lstatSync(requested).isFile() && lstatSync(requested).size <= 4 * 1024 * 1024, `Invalid record: ${file}`);
  return requested;
}

export function inspectRecordChanges(root, changes) {
  assert.equal(classifyChanges(changes), 'records', 'Only classified records can use targeted validation');
  const documentation = checkDocumentation(root, { changes });
  assert.deepEqual(documentation.errors, [], documentation.errors.join('\n'));
  return inspectLegacyRecordChanges(root, changes);
}

/** Read-only compatibility validator; admission to the current tree is a separate gate. */
export function inspectLegacyRecordChanges(root, changes) {
  assert.equal(classifyChanges(changes), 'records', 'Only classified records can use targeted validation');
  const files = changes.map(row => row.path);
  let references = 0;
  for (const file of files) {
    const source = localFile(root, file);
    if (!file.endsWith('.json')) continue;
    const value = json(source);
    if (!file.endsWith('-verification.json') && !/^docs\/releases\/records\/\d+\.\d+\.\d+\/verification\.json$/.test(file)) continue;
    const check = entry => {
      if (!entry || typeof entry !== 'object') return;
      if (typeof entry.path === 'string' && typeof entry.sha256 === 'string') {
        assert.equal(entry.path, basename(entry.path), 'Receipt references must stay in the release directory');
        assert.match(entry.sha256, /^[a-f0-9]{64}$/);
        const target = localFile(dirname(source), entry.path);
        assert.equal(digest(target), entry.sha256, `Receipt digest mismatch: ${entry.path}`);
        references++;
      }
      for (const child of Object.values(entry)) check(child);
    };
    check(value);
  }
  return { files: files.length, references, currentDocuments: RELEASE_DOCUMENTS.length };
}

function documentationForScope(root, scope) {
  try {
    // Retain the legacy reason interpretation for older local scope records.
    const knownBaseline = sha(scope.base) && scope.diffAvailable !== false && scope.reason !== UNKNOWN_DIFF_REASON;
    const context = knownBaseline ? readDocumentationBaseline(root, scope.base, scope.changes) : { changes: scope.changes ?? [] };
    const result = checkDocumentation(root, context);
    if (!knownBaseline) {
      result.anchorBaseline = 'unavailable';
      result.manualReviews.push({ path: 'Git baseline', responsibility: 'Compare old paths/fragments when the exact baseline is available.', status: 'not-machine-verified' });
    }
    return result;
  } catch (error) {
    return { schemaVersion: 1, kind: 'skillfit.documentation-check', baseline: scope.base ?? null, anchorBaseline: 'not-compared',
      files: [], errors: [error.message], impacts: [], manualReviews: [] };
  }
}

export function testCounts(output) {
  const counts = {};
  for (const match of output.matchAll(/^(?:#|ℹ)\s+(tests|pass|fail|cancelled|skipped) (\d+)\s*$/gm)) counts[match[1]] = Number(match[2]);
  assert.ok(['tests', 'pass', 'fail', 'cancelled', 'skipped'].every(k => Number.isSafeInteger(counts[k])), 'Missing actual test counts');
  assert.ok(counts.tests > 0);
  return counts;
}

export function ciReceipt(env, scope, test, nodeVersion = process.version) {
  return { schemaVersion: 1, kind: 'skillfit.ci-result', repository: env.GITHUB_REPOSITORY,
    sourceCommit: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT,
    job: env.SKILLFIT_CI_JOB, os: env.SKILLFIT_CI_OS, nodeTarget: env.SKILLFIT_CI_NODE_TARGET, nodeVersion,
    scope, status: env.SKILLFIT_JOB_STATUS === 'success' && test?.exitCode === 0 && test?.counts?.fail === 0 &&
      test?.counts?.cancelled === 0 ? 'passed' : 'failed', counts: test?.counts ?? null };
}

function main(mode) {
  const root = process.cwd(), dir = process.env.SKILLFIT_CI_DIR ?? (process.env.RUNNER_TEMP ? join(process.env.RUNNER_TEMP, 'skillfit-ci') : null);
  assert.ok(dir, 'Set SKILLFIT_CI_DIR to a fresh result directory');
  if (mode === 'classify') {
    mkdirSync(dir);
    const result = scopeForEvent(process.env.GITHUB_EVENT_NAME, json(process.env.GITHUB_EVENT_PATH), process.env.GITHUB_SHA);
    if (process.env.SKILLFIT_CI_FORCE_FULL === '1') {
      result.scope = 'full'; result.reason = 'Full offline Node compatibility validation required';
    }
    save(join(dir, 'scope.json'), result);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `scope=${result.scope}\n`);
    console.log(`CI scope: ${result.scope}${result.reason ? ` (${result.reason})` : ''}`);
  } else if (mode === 'documentation' || mode === 'test' || mode === 'minimum') {
    const scope = json(join(dir, 'scope.json'));
    if (mode !== 'minimum') {
      const documentation = documentationForScope(root, scope);
      save(join(dir, 'documentation.json'), documentation);
      assert.deepEqual(documentation.errors, [], 'Documentation gate failed; see documentation.json\n' + documentation.errors.join('\n'));
      console.log(`Documentation gate: ${documentation.files.length} files; anchors ${documentation.anchorBaseline}; ${documentation.impacts.length} topics require manual review.`);
      if (mode === 'documentation') return;
    }
    const run = (command, args) => spawnSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' && command === 'npm',
      timeout: 20 * 60_000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, FORCE_COLOR: '0', NODE_DISABLE_COLORS: '1' } });
    let built;
    if (scope.scope === 'records' || mode === 'minimum') {
      built = run('npm', ['run', 'build']);
      writeFileSync(join(dir, 'build.log'), (built.stdout ?? '') + (built.stderr ?? ''), { flag: 'wx' });
      assert.equal(built.status, 0, 'Targeted CI build failed; see build.log');
    }
    const result = mode === 'minimum' ? run(process.execPath,
      ['--test', '--test-reporter=tap', 'tools/verify/node-minimum.test.mjs']) : scope.scope === 'full' ? run('npm', ['test']) : run(process.execPath,
      ['--test', '--test-reporter=tap', 'tools/verify/check-package.test.mjs', 'tools/verify/check-docs.test.mjs', 'tools/verify/documentation-registry.test.mjs', 'tools/verify/check-release-docs.test.mjs', 'tools/verify/ci-scope.test.mjs']);
    const output = (result.stdout ?? '') + (result.stderr ?? '');
    writeFileSync(join(dir, 'tests.log'), output, { flag: 'wx' });
    let counts = null;
    try { counts = testCounts(output); } catch { /* Retain the failed run without inventing counts. */ }
    const testedScope = mode === 'minimum' ? 'minimum' : scope.scope;
    save(join(dir, 'test-result.json'), { scope: testedScope, exitCode: result.status, counts });
    assert.equal(result.status, 0, `CI tests failed; see tests.log\n${output.slice(-2000)}`);
    assert.ok(counts && counts.fail === 0 && counts.cancelled === 0, 'Successful test counts are required');
    if (mode !== 'minimum' && scope.scope === 'records') save(join(dir, 'records.json'), inspectRecordChanges(root, scope.changes));
    console.log(`CI ${testedScope}: ${counts.pass}/${counts.tests} passed, ${counts.skipped} skipped.`);
  } else if (mode === 'record') {
    const scope = existsSync(join(dir, 'scope.json')) ? json(join(dir, 'scope.json')).scope : 'unknown';
    const test = existsSync(join(dir, 'test-result.json')) ? json(join(dir, 'test-result.json')) : null;
    const result = ciReceipt(process.env, test?.scope ?? scope, test);
    save(join(dir, 'ci-result.json'), result);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `### ${result.job} / ${result.os} / ${result.nodeVersion}: ${result.status}\n\nScope: **${result.scope}**; actual test counts: ${JSON.stringify(result.counts)}.\n`);
    console.log(JSON.stringify(result));
  } else throw new Error('Use classify, documentation, test, minimum or record');
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv[2]);
