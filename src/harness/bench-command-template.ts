/** A dependency-free teaching case; users replace it with their own real task. */
export function commandTemplateFiles(benchName: string): Record<string, string> {
  const prompt = `# Repair the addition function

The repository in your current working directory exports \`add(a, b)\` from
\`index.js\`. It should return the sum of two numbers, including zero, negatives
and fractions, but currently subtracts them. Fix the implementation and run
\`node --test test.mjs\`. Keep \`package.json\` and \`test.mjs\` unchanged.
`;
  return {
    'bench.json': JSON.stringify({
      schemaVersion: 1,
      name: benchName,
      description: 'Teaching case for file edits; replace with a real task from your work.',
      tasks: [{
        id: 'example-task',
        fixture: 'fixtures/example-task',
        prompt: 'prompts/example-task.md',
        promptTrigger: 'prompts/example-task.trigger.md',
        verifierKind: 'command',
        verifier: 'node verifiers/example-task.mjs',
        oracle: 'node ground-truth/oracle-example-task.mjs',
        rubric: 'ground-truth/example-task.md',
      }],
    }, null, 2) + '\n',
    'prompts/example-task.md': prompt,
    'prompts/example-task.trigger.md': prompt,
    'fixtures/example-task/package.json': JSON.stringify({
      private: true, type: 'module', scripts: { test: 'node --test test.mjs' },
    }, null, 2) + '\n',
    'fixtures/example-task/index.js': 'export function add(a, b) { return a - b; }\n',
    'fixtures/example-task/test.mjs': `import assert from 'node:assert/strict';
import { test } from 'node:test';
import { add } from './index.js';

test('positive numbers and zero', () => {
  assert.equal(add(2, 3), 5);
  assert.equal(add(0, 4), 4);
});
test('negative numbers', () => {
  assert.equal(add(-2, -3), -5);
  assert.equal(add(-2, 5), 3);
});
test('fractions', () => {
  assert.equal(add(0.25, 0.5), 0.75);
  assert.equal(add(-0.5, 0.25), -0.25);
});
`,
    'verifiers/example-task.mjs': String.raw`import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node example-task.mjs <run-dir>');
  process.exit(2);
}
const names = ['positive-and-zero', 'negative-numbers', 'fractions'];
const checks = [{ name: 'protected-assets', pass: false },
  ...names.map(name => ({ name, pass: false }))];
try {
  checks[0].pass = ['package.json', 'test.mjs'].every(file =>
    readFileSync(join(runDir, file)).equals(
      readFileSync(new URL('../fixtures/example-task/' + file, import.meta.url))));
} catch { /* Missing protected files fail the same gate. */ }

if (checks[0].pass) {
  // Grade behavior outside the editable fixture tests, in a separate process.
  // A crash, early exit, syntax error or deadline cannot become a passing grade.
  const probe = fileURLToPath(new URL('./probe-example-task.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [probe, runDir],
    { cwd: runDir, encoding: 'utf8', timeout: 5_000, maxBuffer: 64 * 1024 });
  try {
    const values = JSON.parse(result.stdout.trim().split('\n').at(-1));
    if (!result.error && result.status === 0 && Array.isArray(values) &&
        values.length === names.length && values.every(value => typeof value === 'boolean')) {
      values.forEach((pass, i) => { checks[i + 1].pass = pass; });
    }
  } catch { /* No valid result means the behavior checks stay false. */ }
}
const passed = checks.every(check => check.pass);
console.log(JSON.stringify({ passed, checks }));
process.exitCode = passed ? 0 : 1;
`,
    'verifiers/probe-example-task.mjs': `import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const { add } = await import(pathToFileURL(join(process.argv[2], 'index.js')).href);
const groups = [
  [[2, 3, 5], [0, 4, 4], [8, 0, 8]],
  [[-2, -3, -5], [-2, 5, 3], [3, -7, -4]],
  [[0.25, 0.5, 0.75], [-0.5, 0.25, -0.25]],
];
const results = groups.map(cases => cases.every(([a, b, expected]) => {
  try { return add(a, b) === expected; } catch { return false; }
}));
console.log(JSON.stringify(results));
`,
    'ground-truth/oracle-example-task.mjs': String.raw`import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-example-task.mjs <run-dir>');
  process.exit(2);
}
writeFileSync(join(runDir, 'index.js'), 'export function add(a, b) { return a + b; }\n');
`,
    'ground-truth/example-task.md': `# Ground truth — example-task

This is a synthetic teaching case, not evidence that a Skill improves real tasks.
The original subtracts; the reference repair returns the sum. Equivalent repairs
are accepted by behavior rather than matching reference source bytes.

The verifier checks protected fixture assets, positive numbers / zero, negatives,
and fractions. It runs its own behavior probes outside the agent's editable
fixture. Changing or removing \`package.json\` or \`test.mjs\` fails validation.

Replace the fixture, prompt, verifier and oracle together with your real task.
Keep reference answers outside the fixture; freeze independent acceptance checks
before comparing Skills. Run \`skillfit bench check\` before spending on an agent.
Use \`--input workspace\` with a local CLI executor to evaluate file edits.
The starter has one task and no trigger labels; it cannot support an adoption
claim or measure trigger recall. Add representative tasks and negative controls
where appropriate. See docs/bench-authoring.md in the skillfit repository.
`,
  };
}
