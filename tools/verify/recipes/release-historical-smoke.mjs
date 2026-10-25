import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageRecipes = {
  '2026-10-13-debugging-completed-development': 'replay/scripts/replay-completed-development.mjs',
  '2026-10-13-debugging-controls-and-sleep-stop': 'replay-all.mjs',
  '2026-10-13-debugging-development-stops': 'replay/scripts/replay-development-stops.mjs',
  '2026-10-14-debugging-followup-routing-stop': 'replay-routing-stop.mjs',
  '2026-10-14-debugging-independent-validation': 'replay-validation.mjs',
  '2026-10-14-debugging-reading-pilot-and-cost-review': 'replay.mjs',
  '2026-10-14-debugging-spending-stop': 'replay-spending-stop.mjs',
  '2026-10-15-independent-comparison-regression-stop': 'replay.mjs',
  '2026-10-15-native-diff-mechanism': 'replay.mjs',
  '2026-10-15-receiver-mechanism-stop': 'replay.mjs',
};
export function historicalRecipe(row) {
  const folder = basename(dirname(row.path)), file = basename(row.path);
  assert.equal(row.id, `${folder}-${file.replace(/\.tar\.gz$/, '')}`, 'Historical archive ID must match its reviewed path');
  if (folder === '2026-10-12-diagnosing-revision') {
    const phase = file.replace('-records.tar.gz', '');
    const group = { calibration: 'calibration-20261012', interrupted: 'validation-20261012', validation: 'validation-20261012-rtk' }[phase];
    assert.ok(group, `Unknown historical phase: ${row.id}`);
    return { support: 'replay/scripts/regrade-diagnosing-revision.mjs', group };
  }
  if (folder === '2026-10-12-diagnosing-v2') {
    assert.ok(['regression-records.tar.gz', 'transfer-records.tar.gz'].includes(file));
    return { support: 'replay/scripts/replay-diagnosing-v2.mjs', group: file.startsWith('regression-') ? 'regression-v2-20261012' : 'transfer-v2-20261012' };
  }
  if (folder === '2026-10-12-normalize-url-v2-available') { assert.equal(file, 'readiness-records.tar.gz', 'Unknown historical export archive'); return { exportIndex: true }; }
  if (/^2026-10-12-normalize-url-v2-(comparison|recovery|validated)$/.test(folder)) {
    assert.equal(file, 'records.tar.gz', 'Unknown historical replay archive');
    const phase = folder.split('-').at(-1);
    return { support: `replay/scripts/replay-normalize-url-v2-${phase}.mjs`, group: `normalize-url-v2-${phase}-20261012` };
  }
  assert.ok(packageRecipes[folder], `Unknown historical recipe: ${row.id}; add and review its replay explicitly`);
  assert.equal(file, 'package.tar.gz', 'Unknown embedded replay archive');
  return { embedded: packageRecipes[folder], nested: folder === '2026-10-13-debugging-development-stops' };
}

export async function verifyHistorical(installed, workspace, output) {
  assert.equal(process.versions.node, '24.21.0', 'Retain historical Node 24.21.0 requirements');
  assert.ok(['linux', 'darwin'].includes(process.platform), 'Historical recipes require POSIX');
  installed = realpathSync(installed); workspace = realpathSync(workspace);
  const { readCatalog } = await import(pathToFileURL(join(installed, 'evidence/fetch-archives.mjs')));
  const catalog = await readCatalog(installed), plans = catalog.archives.map(row => historicalRecipe(row));
  // Verify every saved input before extracting or executing a frozen recipe.
  for (const row of [...catalog.archives, ...catalog.supportFiles]) {
    const file = join(workspace, row.path), rel = relative(workspace, realpathSync(file));
    assert.ok(rel && !isAbsolute(rel) && !rel.startsWith('..') && lstatSync(file).isFile());
    const bytes = readFileSync(file); assert.equal(bytes.length, row.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256, row.path);
  }
  mkdirSync(output); const work = mkdtempSync(join(tmpdir(), 'skillfit-history-')), results = [], logs = [];
  const run = (command, args, cwd, label) => {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024 });
    const bytes = (result.stdout ?? '') + '\n' + (result.stderr ?? '');
    writeFileSync(join(output, label + '.log'), bytes, { flag: 'wx' }); logs.push({ path: label + '.log', sha256: createHash('sha256').update(bytes).digest('hex') });
    assert.equal(result.status, 0, `Historical ${label} failed; inspect its retained log`);
  };
  for (const [i, row] of catalog.archives.entries()) {
    const recipe = plans[i], extracted = join(work, row.id), support = join(workspace, dirname(row.path)); mkdirSync(extracted);
    run('tar', ['-xzf', join(workspace, row.path), '-C', extracted], work, row.id + '-extract');
    if (recipe.exportIndex) {
      for (const file of JSON.parse(readFileSync(join(support, 'export-index.json')))) {
        assert.ok([join(extracted, file.path), join(extracted, '_availability', file.path)].some(candidate => {
          try { return createHash('sha256').update(readFileSync(candidate)).digest('hex') === file.exportSha256; } catch { return false; }
        }), `Missing original export: ${file.path}`);
      }
    } else {
      let args = recipe.group ? [join(extracted, recipe.group)] : [];
      if (recipe.nested) { run('tar', ['-xzf', join(extracted, 'records.tar.gz'), '-C', extracted], extracted, row.id + '-nested'); args = [join(extracted, 'records')]; }
      run(process.execPath, [recipe.support ? join(support, recipe.support) : join(extracted, recipe.embedded), ...args], support, row.id + '-replay');
    }
    results.push({ id: row.id, verified: true, kind: recipe.exportIndex ? 'export-hashes' : 'frozen-replay' });
  }
  const receipt = { schemaVersion: 1, version: JSON.parse(readFileSync(join(installed, 'package.json'))).version,
    node: process.version, platform: process.platform, originalRequirementsRetained: true, sourceCommit: catalog.source.commit,
    results, logs, modelCalls: 0, agentCliCalls: 0 };
  writeFileSync(join(output, 'historical-smoke.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' }); return receipt;
}
if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 5, 'Provide installed package, verified workspace and fresh log directory');
  const result = await verifyHistorical(...process.argv.slice(2)); console.log(JSON.stringify(result));
}
