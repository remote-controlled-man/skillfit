import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentationFiles, inspectDocumentation } from './check-docs.mjs';
import { validateReleaseDocuments } from '../docs/releases/release-docs-smoke.mjs';

const sha = value => /^[a-f0-9]{40}$/.test(value ?? '') && !/^0+$/.test(value);
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

export function classifyChanges(changes) {
  if (!changes.length || changes.length > 256) return 'full';
  return changes.every(({ status, path, mode }) => {
    if (!['A', 'M'].includes(status) || mode !== '100644') return false;
    if (/^docs\/plans\/[a-zA-Z0-9._-]+\.md$/.test(path)) return true;
    if (/^docs\/releases\/\d+\.\d+\.\d+\.md$/.test(path)) return true;
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
    return { scope: classifyChanges(changes), base, head, changes };
  } catch {
    return { scope: 'full', base: base ?? null, head, changes: [], reason: 'Unknown or unavailable diff baseline' };
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
  const files = changes.map(row => row.path);
  const links = inspectDocumentation(root, [...new Set([...documentationFiles(root), ...files.filter(file => file.endsWith('.md'))])]);
  assert.deepEqual(links, [], links.join('\n'));
  validateReleaseDocuments(root);
  let references = 0;
  for (const file of files) {
    const source = localFile(root, file);
    if (!file.endsWith('.json')) continue;
    const value = json(source);
    if (!file.endsWith('-verification.json')) continue;
    const check = entry => {
      if (!entry || typeof entry !== 'object') return;
      if (typeof entry.path === 'string' && typeof entry.sha256 === 'string') {
        assert.equal(entry.path, basename(entry.path), 'Receipt references must stay in the release directory');
        assert.match(entry.sha256, /^[a-f0-9]{64}$/);
        const target = localFile(join(root, 'docs/releases'), entry.path);
        assert.equal(digest(target), entry.sha256, `Receipt digest mismatch: ${entry.path}`);
        references++;
      }
      for (const child of Object.values(entry)) check(child);
    };
    check(value);
  }
  return { files: files.length, references, currentDocuments: 5 };
}

export function testCounts(output) {
  const counts = {};
  for (const match of output.matchAll(/^(?:#|ℹ)\s+(tests|pass|fail|cancelled|skipped) (\d+)\s*$/gm)) counts[match[1]] = Number(match[2]);
  assert.ok(['tests', 'pass', 'fail', 'cancelled', 'skipped'].every(k => Number.isSafeInteger(counts[k])), 'Missing actual test counts');
  assert.ok(counts.tests > 0);
  return counts;
}

function main(mode) {
  const root = process.cwd(), dir = process.env.SKILLFIT_CI_DIR ?? (process.env.RUNNER_TEMP ? join(process.env.RUNNER_TEMP, 'skillfit-ci') : null);
  assert.ok(dir, 'Set SKILLFIT_CI_DIR to a fresh result directory');
  if (mode === 'classify') {
    mkdirSync(dir);
    const result = scopeForEvent(process.env.GITHUB_EVENT_NAME, json(process.env.GITHUB_EVENT_PATH), process.env.GITHUB_SHA);
    save(join(dir, 'scope.json'), result);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `scope=${result.scope}\n`);
    console.log(`CI scope: ${result.scope}${result.reason ? ` (${result.reason})` : ''}`);
  } else if (mode === 'test') {
    const scope = json(join(dir, 'scope.json'));
    const run = (command, args) => spawnSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' && command === 'npm',
      timeout: 20 * 60_000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, FORCE_COLOR: '0', NODE_DISABLE_COLORS: '1' } });
    let built;
    if (scope.scope === 'records') {
      built = run('npm', ['run', 'build']);
      writeFileSync(join(dir, 'build.log'), (built.stdout ?? '') + (built.stderr ?? ''), { flag: 'wx' });
      assert.equal(built.status, 0, 'Targeted CI build failed; see build.log');
    }
    const result = scope.scope === 'full' ? run('npm', ['test']) : run(process.execPath,
      ['--test', '--test-reporter=tap', 'scripts/check-package.test.mjs', 'scripts/check-docs.test.mjs', 'scripts/check-release-docs.test.mjs', 'scripts/ci-scope.test.mjs']);
    const output = (result.stdout ?? '') + (result.stderr ?? '');
    writeFileSync(join(dir, 'tests.log'), output, { flag: 'wx' });
    let counts = null;
    try { counts = testCounts(output); } catch { /* Retain the failed run without inventing counts. */ }
    save(join(dir, 'test-result.json'), { scope: scope.scope, exitCode: result.status, counts });
    assert.equal(result.status, 0, `CI tests failed; see tests.log\n${output.slice(-2000)}`);
    assert.ok(counts && counts.fail === 0 && counts.cancelled === 0, 'Successful test counts are required');
    if (scope.scope === 'records') save(join(dir, 'records.json'), inspectRecordChanges(root, scope.changes));
    console.log(`CI ${scope.scope}: ${counts.pass}/${counts.tests} passed, ${counts.skipped} skipped.`);
  } else if (mode === 'record') {
    const scope = existsSync(join(dir, 'scope.json')) ? json(join(dir, 'scope.json')).scope : 'unknown';
    const test = existsSync(join(dir, 'test-result.json')) ? json(join(dir, 'test-result.json')) : null;
    const result = { schemaVersion: 1, kind: 'skillfit.ci-result', repository: process.env.GITHUB_REPOSITORY,
      sourceCommit: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      os: process.env.SKILLFIT_CI_OS, scope, status: process.env.SKILLFIT_JOB_STATUS === 'success' && test?.exitCode === 0 && test?.counts?.fail === 0 ? 'passed' : 'failed',
      counts: test?.counts ?? null };
    save(join(dir, 'ci-result.json'), result);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `### ${result.os}: ${result.status}\n\nScope: **${scope}**; actual test counts: ${JSON.stringify(result.counts)}.\n`);
    console.log(JSON.stringify(result));
  } else throw new Error('Use classify, test or record');
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv[2]);
