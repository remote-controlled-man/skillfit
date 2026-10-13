// Explicit live entry point. Offline tests never import or execute it.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runEval } from '../dist/commands/eval.js';
import { runBenchCheck } from '../dist/commands/bench.js';
import { loadBench } from '../dist/harness/bench.js';
import { collectInstalledSkillTarget } from '../dist/harness/installed-skill.js';
import { hashFileSet, listFilesRecursive, sha256File } from '../dist/harness/hash.js';
import { getAgent } from '../dist/agents.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const declaration = JSON.parse(readFileSync(join(root, 'evidence/plans/2026-10-12-normalize-url-v2-comparison.json'), 'utf8'));
const { values } = parseArgs({ options: {
  phase: { type: 'string', default: 'plan' },
  'runs-root': { type: 'string', default: join(tmpdir(), 'skillfit-normalize-url-v2-comparison-20261012') },
} });
assert.ok(['plan', 'run'].includes(values.phase), 'phase must be plan or run');
const runsRoot = resolve(values['runs-root']);
const agent = getAgent(declaration.configured.agent);
const expand = spec => spec.replace(/^~\//, homedir() + '/');
const rtkPath = join(dirname(expand(agent.rules.userFiles[0])), 'RTK.md');
const checkInputs = () => {
  assert.equal(sha256File(rtkPath), declaration.environment.rtkSha256, 'Referenced RTK changed; retain records and declare a new batch.');
  for (const input of [declaration.baseline, declaration.treatment]) assert.equal(
    collectInstalledSkillTarget(join(root, input.path)).sha256, input.sha256, 'Frozen Skill changed.');
  assert.equal(hashFileSet(join(root, 'dist'), listFilesRecursive(join(root, 'dist'))), declaration.runner.compiledSha256, 'Frozen compiled runner changed.');
  assert.equal(sha256File(fileURLToPath(import.meta.url)), declaration.runner.entrypointSha256, 'Frozen live entry point changed.');
  const settings = agent.headless.runtime.settings;
  assert.equal(settings.format, 'toml');
  const settingsPath = settings.homeOverride && process.env[settings.homeOverride.env]
    ? join(process.env[settings.homeOverride.env], settings.homeOverride.relativePath) : expand(settings.file);
  const top = readFileSync(settingsPath, 'utf8').split(/^\s*\[/m)[0];
  for (const [key, expected] of Object.entries(declaration.configured.settings)) {
    assert.ok(settings.keys.includes(key));
    const line = top.split(/\r?\n/).find(line => line.trimStart().startsWith(`${key} `) || line.startsWith(`${key}=`));
    const match = line?.match(/=\s*("(?:[^"\\]|\\.)*"|'[^']*')\s*(?:#.*)?$/);
    assert.ok(match, `Configured setting is unavailable: ${key}`);
    const value = match[1].startsWith('"') ? JSON.parse(match[1]) : match[1].slice(1, -1);
    assert.equal(value, expected, `Configured setting changed: ${key}`);
  }
  const argv = agent.headless.runtime.versionArgv;
  assert.equal(execFileSync(argv[0], argv.slice(1), { encoding: 'utf8', timeout: 5000 }).trim(), declaration.configured.cli);
  assert.equal(process.version, declaration.configured.node);
  for (const cohort of declaration.cohorts) assert.equal(loadBench(join(root, cohort.bench.path)).contentSha256, cohort.bench.sha256, 'Frozen bench changed.');
  for (const prior of [declaration.previous, declaration.interruptedRecovery]) assert.equal(sha256File(join(root, prior.artifactIndex)), prior.artifactIndexSha256, 'Previous failure package changed.');
};
checkInputs();
for (const cohort of declaration.cohorts) {
  const gate = await runBenchCheck({ dir: join(root, cohort.bench.path) });
  assert.equal(gate.failures, 0, 'Offline bench gate failed.');
}
const cohort = declaration.cohorts[0];
const options = {
  skillPath: join(root, declaration.treatment.path), baselineSkillPath: join(root, declaration.baseline.path),
  bench: join(root, cohort.bench.path), mode: 'installed', inputMode: 'workspace', agent: declaration.configured.agent,
  judgeExecutor: null, trials: cohort.trials, maxCalls: cohort.calls, yes: true, runsRoot, runGroup: cohort.runGroup,
};
if (values.phase === 'plan') { await runEval({ ...options, dryRun: true }); }
else {
  assert.equal(process.platform, 'darwin', 'This batch declares macOS power assertions; another host requires a new declaration.');
  assert.ok(!existsSync(join(runsRoot, cohort.runGroup)), 'Never reuse or append to a retained batch.');
  const awake = spawn('caffeinate', ['-i', '-s', '-w', String(process.pid)], { stdio: 'ignore' });
  let awakeError;
  awake.on('error', error => { awakeError = error; });
  const power = { startedAt: new Date().toISOString(), args: ['-i', '-s', '-w', '<runner-pid>'], asserted: false, released: false };
  try {
    for (let i = 0; i < 25; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (awakeError) throw awakeError;
      assert.equal(awake.exitCode, null, 'Awake assertion utility exited before evaluation.');
      const output = execFileSync('pmset', ['-g', 'assertions'], { encoding: 'utf8', timeout: 5000 });
      const lines = output.split('\n').filter(line => line.toLowerCase().includes(`pid ${awake.pid}(caffeinate)`));
      if (lines.some(line => line.includes('PreventUserIdleSystemSleep'))) {
        power.asserted = true;
        power.assertionTypes = [...new Set(lines.map(line => line.match(/(?:Created|Summary)?\s*(Prevent\w*Sleep)/)?.[1]).filter(Boolean))];
        break;
      }
    }
    assert.ok(power.asserted, 'No verified idle-sleep assertion; no model calls are allowed.');
    power.powerSource = execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf8', timeout: 5000 }).split('\n')[0];
    await runEval(options); // Genuine default native CLI executor; no injected/mock executor.
    power.aliveAtFinish = awake.exitCode === null && awake.signalCode === null;
    checkInputs();
  } finally {
    awake.kill();
    await new Promise(resolve => {
      if (awake.exitCode !== null || awake.signalCode !== null) return resolve();
      const timer = setTimeout(() => { awake.kill('SIGKILL'); resolve(); }, 2000);
      awake.once('exit', () => { clearTimeout(timer); resolve(); });
    });
    power.released = awake.exitCode !== null || awake.signalCode !== null;
    power.finishedAt = new Date().toISOString();
    if (existsSync(join(runsRoot, cohort.runGroup))) writeFileSync(join(runsRoot, cohort.runGroup, '_power.json'), JSON.stringify(power, null, 2) + '\n', { flag: 'wx' });
  }
}
