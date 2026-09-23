import { spawnSync } from 'node:child_process';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node feat-slug.mjs <run-dir>');
  process.exit(2);
}
function scrubbedEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

const result = spawnSync('node --test', { cwd: runDir, shell: true, encoding: 'utf8', env: scrubbedEnv() });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error(String(result.error));
  process.exit(1);
}
const passed = result.status === 0;
console.log(JSON.stringify({ passed, checks: [{ name: 'tests-pass', pass: passed }] }));
process.exit(result.status ?? 1);
