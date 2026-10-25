import { documentationFiles, inspectDocumentation } from './check-docs.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { materializeHistoricalSource } from '../history/historical-source.mjs';
import { PACKAGE_POLICY, inspectBuiltPackage, validatePackageContents } from './check-package.mjs';

const fixture = () => ({ size: 100, unpackedSize: 200, files:
  [...new Set([...PACKAGE_POLICY.requiredFiles, ...PACKAGE_POLICY.retainedTests, ...PACKAGE_POLICY.archives])].map(path => ({ path })) });

test('package policy retains installed workflows, six recipe tests and the on-demand archive catalog', () => {
  assert.ok(validatePackageContents(fixture()).files > 0);
  for (const path of [PACKAGE_POLICY.requiredFiles[0], PACKAGE_POLICY.retainedTests[0], 'evidence/README.md']) {
    const pack = fixture(); pack.files = pack.files.filter(file => file.path !== path);
    assert.throws(() => validatePackageContents(pack), /Required package file/);
  }
});

test('package policy rejects private paths, unknown archives and active development tests', () => {
  for (const path of ['workspace4skills/private.md', 'docs/runs/output.json', 'docs/auth.json',
    'docs/tmp.tgz', PACKAGE_POLICY.externalArchives[0], 'dist/cli/main.test.js', '../escape', 'docs/../escape']) {
    const pack = fixture(); pack.files.push({ path });
    assert.throws(() => validatePackageContents(pack), undefined, path);
  }
});

test('package policy rejects duplicate paths, growth beyond review and missing runtime modules', () => {
  const duplicate = fixture(); duplicate.files.push(duplicate.files[0]);
  assert.throws(() => validatePackageContents(duplicate), /unique/);
  for (const [field, limit] of [['size', PACKAGE_POLICY.maxArchiveBytes], ['unpackedSize', PACKAGE_POLICY.maxUnpackedBytes]]) {
    const pack = fixture(); pack[field] = limit + 1;
    assert.throws(() => validatePackageContents(pack), /reviewed limit/);
  }
  assert.throws(() => validatePackageContents(fixture(), ['dist/harness/new-runtime.js']), /Required package file/);
});

test('actual offline npm package matches the reviewed inventory and active runtime', t => {
  const cache = mkdtempSync(join(tmpdir(), 'skillfit-pack-cache-'));
  t.after(() => rmSync(cache, { recursive: true, force: true }));
  const result = spawnSync('npm', ['pack', '--ignore-scripts', '--offline', '--json'], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)), encoding: 'utf8', timeout: 60_000,
    shell: process.platform === 'win32', maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, npm_config_cache: cache, npm_config_pack_destination: cache, npm_config_update_notifier: 'false' },
  });
  assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stderr}`);
  const entries = JSON.parse(result.stdout);
  assert.equal(entries.length, 1);
  inspectBuiltPackage(entries[0]);
  assert.deepEqual(entries[0].files.map(file => file.path).filter(path => path.startsWith('evidence/')).sort(),
    ['evidence/README.md', 'evidence/archive-catalog.v1.json', 'evidence/fetch-archives.mjs']);
  const extracted = spawnSync('tar', ['-xzf', join(cache, entries[0].filename), '-C', cache], {
    encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(extracted.status, 0, `${extracted.error ?? ''}\n${extracted.stderr}`);
  const consumer = join(cache, 'consumer');
  const installation = spawnSync('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', consumer, join(cache, entries[0].filename)], {
    encoding: 'utf8', timeout: 60_000, shell: process.platform === 'win32',
    env: { ...process.env, npm_config_cache: cache, npm_config_update_notifier: 'false' },
  });
  assert.equal(installation.status, 0, `${installation.error ?? ''}\n${installation.stderr}`);
  const binary = join(consumer, 'node_modules/.bin', process.platform === 'win32' ? 'skillfit.cmd' : 'skillfit');
  const binaryHelp = spawnSync(binary, ['--help'], { encoding: 'utf8', timeout: 30_000, shell: process.platform === 'win32' });
  assert.equal(binaryHelp.status, 0, `${binaryHelp.error ?? ''}\n${binaryHelp.stderr}`);
  assert.match(binaryHelp.stdout, /skillfit/);
  const installed = join(cache, 'package');
  const shipped = new Set(entries[0].files.map(file => file.path));
  const publicDocs = documentationFiles().filter(file => shipped.has(file));
  assert.deepEqual(inspectDocumentation(installed, publicDocs), [], 'Every shipped public page must resolve its local links and anchors');
  const documents = spawnSync(process.execPath, [join(installed, 'tools/verify/recipes/release-docs-smoke.mjs'), installed], {
    encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(documents.status, 0, `${documents.error ?? ''}\n${documents.stderr}`);
  assert.equal(JSON.parse(documents.stdout).documents.length, 5);
  const request = spawnSync(process.execPath, [join(installed, 'dist/cli.js'), 'eval', '--request',
    join(installed, 'docs/examples/eval-request.json'), '--dry-run'], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(request.status, 0, request.stderr);
  const requestPlan = JSON.parse(request.stdout);
  assert.equal(requestPlan.status, 'planned');
  assert.equal(requestPlan.acceptance.eligibleForUpgrade, false);
  assert.equal(existsSync(join(installed, 'runs')), false);
  const controls = ['bench', 'self-test', join(installed, 'benches/_self-test/example'), '--json',
    '--runs-root', join(cache, 'self-test-runs'), '--run-group', 'installed-controls'];
  const preview = spawnSync(process.execPath, [join(installed, 'dist/cli.js'), ...controls, '--dry-run'], {
    encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(preview.status, 0, `${preview.error ?? ''}\n${preview.stderr}`);
  // Four complete suites dispatch 27 mocks plus local verifier/git processes on Windows.
  // This is the package-test envelope, not an executor or verifier deadline.
  const checked = spawnSync(process.execPath, [join(installed, 'dist/cli.js'), ...controls, '--plan-sha', JSON.parse(preview.stdout).plan.sha256], {
    encoding: 'utf8', timeout: 120_000, env: { ...process.env, HOME: cache, USERPROFILE: cache, SKILLFIT_JUDGE: '1' },
  });
  assert.equal(checked.status, 0, `${checked.error ?? ''}\n${checked.stderr}`);
  const selfTest = JSON.parse(checked.stdout);
  assert.equal(selfTest.status, 'passed'); assert.equal(selfTest.harnessModelCalls, 0);
  assert.equal(selfTest.simulatedExecutorInvocations, 27); assert.equal(selfTest.acceptance.eligibleForUpgrade, false);
  assert.deepEqual(selfTest.suites.map(s => s.observed.statisticalVerdict), ['effective', 'ineffective', 'inconclusive', null]);
  const declaredBench = join(cache, 'schema-two');
  const init = spawnSync(process.execPath, [join(installed, 'dist/cli.js'), 'bench', 'init', declaredBench, '--schema-version', '2', '--yes'], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(init.status, 0, init.stderr);
  const listed = spawnSync(process.execPath, [join(installed, 'dist/cli.js'), 'bench', 'list', declaredBench, '--json'], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(JSON.parse(listed.stdout).benchSchemaVersion, 2);
  assert.deepEqual(JSON.parse(listed.stdout).tasks[0].claims, ['quality']);
  const integrity = spawnSync(process.execPath, [join(installed, 'dist/cli.js'), 'bench', 'check', declaredBench, '--json'], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(integrity.status, 0, integrity.stderr);
  assert.equal(JSON.parse(integrity.stdout).measurementScope.assessment, 'not-applicable');
  const alias = join(cache, 'package-alias');
  symlinkSync(installed, alias, 'junction');
  const blocked = spawnSync(process.execPath, [join(installed, 'tools/verify/recipes/archive-delivery-smoke.mjs'), installed,
    fileURLToPath(new URL('../..', import.meta.url)), join(alias, 'in-place-output')], { encoding: 'utf8', timeout: 30_000 });
  assert.notEqual(blocked.status, 0);
  assert.equal(existsSync(join(installed, 'in-place-output')), false, 'Invalid aliased output must not modify the package');
  const history = materializeHistoricalSource(fileURLToPath(new URL('../..', import.meta.url)));
  t.after(history.dispose);
  const restored = spawnSync(process.execPath, [join(installed, 'tools/verify/recipes/archive-delivery-smoke.mjs'), installed,
    history.directory, join(cache, 'archive-smoke')], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(restored.status, 0, `${restored.error ?? ''}\n${restored.stderr}`);
  const receipt = JSON.parse(restored.stdout);
  assert.equal(receipt.archivesRestored, 19);
  assert.equal(receipt.supportFilesRestored, 1583);
  assert.equal(receipt.inlineSupportFiles, 4);
  assert.equal(receipt.networkAttempts, 0);
});


test('package excludes source-maintenance records and on-demand frozen artifacts', () => {
  const pack = fixture();
  pack.files = pack.files.filter(file => !file.path.startsWith('evidence/artifacts/'));
  assert.ok(validatePackageContents(pack).files > 0);
  for (const path of ['evidence/artifacts/saved/replay/dist/cli.js', 'docs/plans/completed.md', 'docs/decisions/old.md', 'docs/releases/0.13.1-verification.json', 'docs/releases/records/0.14.0/features.json']) {
    assert.throws(() => validatePackageContents({ ...pack, files: [...pack.files, { path }] }), /Source-only/);
  }
});
