import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changedFiles, classifyChanges } from './ci-scope.mjs';

test('real Git diff identifies bookkeeping and mixed/delete changes without a path filter bypass', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-ci-diff-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const hooks = join(root, 'empty-hooks'); mkdirSync(hooks);
  const git = args => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${hooks}`, ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init']); mkdirSync(join(root, 'docs/plans'), { recursive: true }); writeFileSync(join(root, 'docs/plans/release.md'), '# Prepared\n');
  git(['add', '.']); git(['commit', '-m', 'baseline']); const base = git(['rev-parse', 'HEAD']).trim();
  writeFileSync(join(root, 'docs/plans/release.md'), '# Complete\n'); git(['add', '.']); git(['commit', '-m', 'records']); const head = git(['rev-parse', 'HEAD']).trim();
  assert.equal(classifyChanges(changedFiles(base, head, git)), 'records');
  const event = join(root, 'event.json'); writeFileSync(event, JSON.stringify({ before: base }));
  const resultDir = join(root, 'compat-ci');
  const classified = spawnSync(process.execPath, [fileURLToPath(new URL('./ci-scope.mjs', import.meta.url)), 'classify'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, SKILLFIT_CI_DIR: resultDir, SKILLFIT_CI_FORCE_FULL: '1',
      GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_PATH: event, GITHUB_SHA: head, GITHUB_OUTPUT: '' },
  });
  assert.equal(classified.status, 0, classified.stderr);
  const scope = JSON.parse(readFileSync(join(resultDir, 'scope.json'), 'utf8'));
  assert.equal(scope.scope, 'full', 'compatibility jobs must not shrink record-only changes to targeted tests');
  assert.match(scope.reason, /Node compatibility/);
  writeFileSync(join(root, 'package.json'), '{}'); git(['add', '.']); git(['commit', '-m', 'mixed']);
  assert.equal(classifyChanges(changedFiles(base, git(['rev-parse', 'HEAD']).trim(), git)), 'full');
  git(['rm', 'docs/plans/release.md']); git(['commit', '-m', 'deleted']);
  assert.equal(classifyChanges(changedFiles(head, git(['rev-parse', 'HEAD']).trim(), git)), 'full');
});
test('release and CI entrypoints execute through directory aliases rather than silently returning success', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-release-alias-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const alias = join(root, 'repo'); symlinkSync(new URL('..', import.meta.url), alias, 'junction');
  for (const [file, usage] of [['scripts/ci-scope.mjs', /Set SKILLFIT_CI_DIR|Use classify/], ['scripts/release-source.mjs', /Provide a release result directory/], ['scripts/release-acceptance.mjs', /Provide a release result directory/], ['scripts/release-records.mjs', /Provide records bundle and repository/], ['scripts/npm-release.mjs', /Use check, guard or verify/], ['docs/releases/release-historical-smoke.mjs', /Provide installed package, verified workspace/]]) {
    const result = spawnSync(process.execPath, [join(alias, file)], { encoding: 'utf8', timeout: 30_000 });
    assert.notEqual(result.status, 0, `${file} must reject missing arguments through aliases`); assert.match(result.stderr, usage);
  }
});
test('workflow enforces source gate, explicit preview attempt and persisted intent before its only upload', () => {
  const release = readFileSync(new URL('../.github/workflows/npm-release.yml', import.meta.url), 'utf8');
  assert.equal([...release.matchAll(/npm publish /g)].length, 1);
  assert.ok(release.indexOf('release-source.mjs ci') < release.indexOf('npm pack '));
  assert.ok(release.indexOf('Persist publication intent before upload') < release.indexOf('npm publish '));
  assert.match(release, /preview_run_attempt:/); assert.match(release, /promote .*"\$PREVIEW_RUN_ATTEMPT"/);
  assert.match(release, /cancel-in-progress: false/); assert.match(release, /retention-days: 90/);
  assert.doesNotMatch(release, /npm test|contents: write|actions: write|continue-on-error/);
  const preparation = release.slice(release.indexOf('if [ "$DRY_RUN"'), release.indexOf('Persist publication intent'));
  assert.match(preparation.split('else')[0], /npm pack /); assert.doesNotMatch(preparation.split('else')[1], /npm pack /);
  assert.match(release, /if: always\(\)[\s\S]*release-acceptance.mjs summary/);
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(ci, /os: \[windows-latest, ubuntu-latest, macos-latest\]/); assert.match(ci, /\n  test:/);
  assert.doesNotMatch(ci, /paths-ignore:|\n    if:.*scope/); assert.match(ci, /cancel-in-progress: \$\{\{ github.event_name == 'pull_request' \}\}/);
  const compatible = ci.slice(ci.indexOf('\n  node-compat:'), ci.indexOf('\n  node-minimum:'));
  assert.match(compatible, /node: \['22\.13\.0', '22\.14\.0', '24', '26'\]/);
  assert.match(compatible, /SKILLFIT_CI_FORCE_FULL: '1'/);
  assert.match(compatible, /node scripts\/ci-scope.mjs test/);
  assert.match(compatible, /node scripts\/check-contrib-benches.mjs/);
  const minimum = ci.slice(ci.indexOf('\n  node-minimum:'));
  assert.match(minimum, /node-version: '22\.0\.0'/);
  assert.match(minimum, /node scripts\/ci-scope.mjs minimum/);
  assert.match(ci, /name: ci-result-\$\{\{ github.run_attempt \}\}-test-\$\{\{ matrix.os \}\}-node-22/);
  assert.match(compatible, /name: ci-result-\$\{\{ github.run_attempt \}\}-node-compat-ubuntu-latest-node-\$\{\{ matrix.node \}\}/);
  assert.match(minimum, /name: ci-result-\$\{\{ github.run_attempt \}\}-node-minimum-ubuntu-latest-node-22\.0\.0/);
  assert.doesNotMatch(ci, /continue-on-error/);
});
