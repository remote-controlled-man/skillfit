import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Keep the published 0.11.0 recipe immutable. This explicit derived recipe only
// changes its asserted version; the original seven workflow checks stay intact.
assert.equal(process.argv.length, 4, 'Provide package and fresh output directories.');
const installed = resolve(process.argv[2]), parent = resolve(process.argv[3]);
assert.equal(JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')).version, '0.12.0');
assert.equal(existsSync(parent), false, 'Preserve previous receipts; choose a fresh output parent.');
const original = readFileSync(new URL('0.11.0-feature-smoke.mjs', import.meta.url), 'utf8');
const sourceSha256 = createHash('sha256').update(original).digest('hex');
assert.equal(sourceSha256, 'aeb14d990bc65e05ec1ea7dc42ac6cadbd5af2bf11603430972ccaddbe4ee870');
const derived = original.replaceAll('0.11.0', '0.12.0');
mkdirSync(parent, { recursive: true });
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(SKILLFIT_|OPENAI_|ANTHROPIC_)/.test(key)) delete env[key];
const home = join(parent, 'home'); mkdirSync(home);
Object.assign(env, { HOME: home, USERPROFILE: home, CODEX_HOME: join(home, 'codex') });
const run = (args, name, input) => {
  const result = spawnSync(process.execPath, args, { cwd: parent, env, input,
    encoding: 'utf8', timeout: 180_000, maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(join(parent, `${name}.stdout.log`), result.stdout ?? '', { flag: 'wx' });
  writeFileSync(join(parent, `${name}.stderr.log`), result.stderr ?? '', { flag: 'wx' });
  assert.equal(result.status, 0, `${name}: ${result.error || result.stderr || result.stdout}`);
  return result.stdout;
};
run(['--input-type=module', '-', installed, join(parent, 'foundations')], 'foundations', derived);
const regressions = [
  'commands/bench-source.test.js', 'commands/bench-draft.test.js',
  'commands/eval-layout.test.js', 'commands/eval-api-failure.test.js',
  'harness/verifier-timeout.test.js', 'harness/bench-location.test.js',
];
const output = run(['--test', '--test-reporter=tap', ...regressions.map(file => join(installed, 'dist', file))], 'regressions');
const count = label => Number(output.match(new RegExp(`^# ${label} (\\d+)$`, 'm'))?.[1] ?? NaN);
assert.ok(count('tests') > 0); assert.equal(count('pass'), count('tests'));
assert.equal(count('fail'), 0); assert.equal(count('skipped'), 0); assert.equal(count('cancelled'), 0);
const foundations = JSON.parse(readFileSync(join(parent, 'foundations/feature-smoke.json'), 'utf8'));
// The full CLI unit suite also asserts source architecture using unshipped .ts
// files. Keep that suite in source CI; verify the installed stream reader here
// through its real public runtime with Node-only fake subprocesses.
const { CliExecutor } = await import(pathToFileURL(join(installed, 'dist/harness/executors/cli.js')).href);
const events = [
  { type: 'item.completed', item: { type: 'agent_message', text: 'offline installed stream' } },
  { type: 'turn.completed', usage: { input_tokens: 12, cached_input_tokens: 7, output_tokens: 3 } },
];
const stream = events.map(event => JSON.stringify(event)).join('\n') + '\n';
for (const exitCode of [0, 1]) {
  const executor = new CliExecutor({ argv: [process.execPath, '-e',
    `process.stdin.resume();process.stdin.on('end',()=>{process.stdout.write(${JSON.stringify(stream)});process.exitCode=${exitCode};});`],
    shell: false, streamJson: true, env, timeoutMs: 10_000 });
  let result;
  if (exitCode === 0) result = await executor.run('offline probe', home);
  else await assert.rejects(executor.run('offline probe', home), error => {
    assert.equal(error.name, 'ExecutorFailure'); result = error.result; return true;
  });
  assert.equal(result.output, 'offline installed stream');
  assert.deepEqual(result.tokens, { input: 12, cachedInput: 7, output: 3 });
  assert.equal(result.skillTriggered, undefined);
  assert.equal(result.usageStatus, exitCode === 0 ? 'final' : 'partial');
}
const receipt = { schemaVersion: 1, kind: 'skillfit.release-workflow-smoke', version: '0.12.0',
  verifiedAt: new Date().toISOString(), packagePath: installed, nodeVersion: process.version,
  modelCalls: 0, agentCliCalls: 0, foundationRecipeSha256: sourceSha256,
  foundationChecks: foundations.checks, syntheticExecutorCalls: foundations.syntheticExecutorCalls,
  portableReplays: 5, regressionFiles: regressions, regressionsPassed: count('tests'),
  installedCliStreamSuccessAndFailure: true, syntheticNodeSubprocesses: 2,
  scope: 'Offline checks of the supplied package; no registry availability or efficacy claim.' };
writeFileSync(join(parent, 'feature-smoke.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipt));
