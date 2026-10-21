import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectBuiltPackage } from './check-package.mjs';
import { validateReleaseDocuments } from '../docs/releases/release-docs-smoke.mjs';

export function validateRelease(pkg, lock, pack) {
  assert.equal(pkg.name, 'skillfit');
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'Release stable versions with latest');
  assert.equal(lock.version, pkg.version, 'Lockfile version must match');
  assert.equal(lock.packages[''].version, pkg.version, 'Lockfile root must match');
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, 'No runtime dependencies');
  assert.equal(pkg.repository.url, 'git+https://github.com/remote-controlled-man/skillfit.git');
  assert.equal(pack.name, pkg.name);
  assert.equal(pack.version, pkg.version);
  assert.ok(pack.files.length > 0, 'An inspected archive is required');
}

export function assertUnused(status) {
  assert.equal(status, 404, status === 200
    ? 'Version already exists; prepare a new version before publishing'
    : 'Cannot establish that the version is unused');
}

export async function waitForPublished(expected, {
  lookup, sleep = ms => new Promise(r => setTimeout(r, ms)), now = Date.now,
  timeoutMs = 20 * 60_000, intervalMs = 30_000, onAttempt = () => {},
}) {
  const started = now(), attempts = [];
  while (true) {
    const { version, latest } = await lookup();
    attempts.push({ at: new Date(now()).toISOString(), versionStatus: version.status, latestStatus: latest.status });
    onAttempt(attempts.at(-1));
    for (const response of [version, latest]) {
      assert.ok(response.status === 200 || response.status === 404 || response.status >= 500,
        `Unexpected registry response ${response.status}`);
    }
    if (version.status === 200) {
      assert.equal(version.body.version, expected.version);
      assert.equal(version.body.dist.integrity, expected.integrity, 'Registry archive integrity differs');
      if (latest.status === 200 && latest.body.version === expected.version) {
        assert.equal(latest.body.dist.integrity, expected.integrity, 'Latest archive integrity differs');
        return { metadata: version.body, attempts };
      }
    }
    assert.ok(now() - started < timeoutMs, 'Registry availability deadline exceeded; retain the failed release');
    await sleep(Math.min(intervalMs * 2 ** Math.min(attempts.length - 1, 2), 60_000, timeoutMs - (now() - started)));
  }
}

export async function retryRegistryInstall(install, {
  deadline, now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)), onAttempt = () => {},
}) {
  const attempts = [];
  while (true) {
    assert.ok(now() < deadline, 'Registry installation deadline exceeded; do not republish');
    try {
      const installed = await install(Math.min(5 * 60_000, deadline - now()));
      attempts.push({ at: new Date(now()).toISOString(), status: 'passed' }); onAttempt(attempts.at(-1));
      return { installed, attempts };
    } catch (error) {
      const detail = String(error.stderr ?? error.message);
      const code = /npm error code (\w+)/.exec(detail)?.[1] ?? null;
      attempts.push({ at: new Date(now()).toISOString(), status: 'failed', code }); onAttempt(attempts.at(-1), error);
      if (!['ETARGET', 'E404', 'E502', 'E503', 'EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT'].includes(code)) throw error;
      assert.ok(now() < deadline, 'Registry installation deadline exceeded; do not republish');
      await sleep(Math.min(60_000, deadline - now()));
    }
  }
}

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const registry = 'https://registry.npmjs.org';
async function lookup(name, version) {
  const response = await fetch(`${registry}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`, {
    headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30_000),
  });
  return { status: response.status, body: response.status === 200 ? await response.json() : null };
}

async function main(mode, packFile) {
  assert.ok(['check', 'guard', 'verify'].includes(mode), 'Use check, guard or verify');
  assert.ok(packFile, 'Provide npm pack --json output');
  packFile = resolve(packFile);
  const entries = json(packFile);
  assert.equal(entries.length, 1);
  const pack = entries[0], pkg = json('package.json');
  validateRelease(pkg, json('package-lock.json'), pack);
  validateReleaseDocuments(process.cwd());
  inspectBuiltPackage(pack);
  assert.equal(pack.filename, basename(pack.filename));
  assert.ok(pack.filename.endsWith('.tgz'));
  const archive = readFileSync(join(dirname(packFile), pack.filename));
  assert.equal(archive.length, pack.size);
  assert.equal(`sha512-${createHash('sha512').update(archive).digest('base64')}`, pack.integrity,
    'Reviewed archive changed');
  if (mode === 'guard') assertUnused((await lookup(pkg.name, pkg.version)).status);
  if (mode !== 'verify') {
    console.log(`${pkg.name}@${pkg.version}: ${mode} passed; no publication`);
    return;
  }
  const deadline = Date.now() + 20 * 60_000;
  let readCount = 0;
  const result = await waitForPublished({ version: pkg.version, integrity: pack.integrity }, {
    timeoutMs: deadline - Date.now(),
    onAttempt: attempt => {
      const file = join(dirname(packFile), `registry-read-${++readCount}.json`);
      writeFileSync(file, JSON.stringify(attempt, null, 2) + '\n', { flag: 'wx' });
      assert.deepEqual(json(file), attempt);
    },
    lookup: async () => {
      const [version, latest] = await Promise.all([lookup(pkg.name, pkg.version), lookup(pkg.name, 'latest')]);
      return { version, latest };
    },
  });
  let installCount = 0;
  const install = await retryRegistryInstall(timeout => {
    const prefix = mkdtempSync(join(dirname(packFile), 'registry-install-'));
    writeFileSync(join(prefix, 'package.json'), JSON.stringify({ name: 'skillfit-release-smoke', version: '0.0.0', private: true }), { flag: 'wx' });
    execFileSync('npm', ['install', '--prefix', prefix, '--cache', join(prefix, 'cache'), '--registry', registry,
      '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund', '--package-lock', '--fetch-retries=0', `${pkg.name}@${pkg.version}`],
    { stdio: ['ignore', 'pipe', 'pipe'], timeout });
    return prefix;
  }, { deadline, onAttempt: (attempt, error) => {
    const file = join(dirname(packFile), `registry-install-attempt-${++installCount}`);
    writeFileSync(file + '.json', JSON.stringify(attempt, null, 2) + '\n', { flag: 'wx' });
    if (error) writeFileSync(file + '.log', String(error.stderr ?? error.message), { flag: 'wx' });
  } });
  const prefix = install.installed;
  const installedLock = json(join(prefix, 'package-lock.json'));
  assert.equal(Object.keys(installedLock.packages).length, 2);
  assert.equal(installedLock.packages['node_modules/skillfit'].integrity, pack.integrity);
  const installed = join(prefix, 'node_modules/skillfit');
  const comparison = resolve(process.env.SKILLFIT_RELEASE_COMPARE_ROOT ?? process.cwd());
  for (const file of pack.files) {
    assert.equal(digest(readFileSync(join(installed, file.path))), digest(readFileSync(join(comparison, file.path))), file.path);
  }
  const cli = args => execFileSync(process.execPath, [join(installed, 'dist/cli.js'), ...args], {
    cwd: prefix, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(cli(['--version']).trim(), pkg.version);
  assert.match(cli(['--help']), /--request/);
  const preview = JSON.parse(cli(['eval', '--request', join(installed, 'docs/examples/eval-request.diagnosing-v4-efficiency.json'), '--dry-run']));
  assert.equal(preview.acceptance.eligibleForUpgrade, false);
  assert.equal(preview.acceptance.automaticUpgrade, false);
  const receipt = {
    schemaVersion: 1, verifiedAt: new Date().toISOString(), version: pkg.version,
    latest: pkg.version, integrity: pack.integrity, sha256: digest(archive),
    sourceCommit: process.env.GITHUB_SHA ?? null, installedFilesVerified: pack.files.length,
    zeroRuntimeDependencies: true, globalInstall: false, modelCalls: 0,
    smoke: { version: true, help: true, requestPreview: true }, attempts: result.attempts,
    installAttempts: install.attempts, installPrefix: prefix, installedPackage: installed,
  };
  writeFileSync(join(dirname(packFile), 'verified-registry-install.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(receipt));
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv[2], process.argv[3]);
}
