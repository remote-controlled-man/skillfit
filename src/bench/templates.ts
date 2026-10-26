import { MOCK_MARKER_FILE } from './constants.js';

/** New authoring groups task inputs; readers still accept any valid manifest paths. */
export function taskFilePaths(taskId: string) {
  const root = `tasks/${taskId}`;
  return {
    fixture: `${root}/fixture`, prompt: `${root}/prompt.md`, promptTrigger: `${root}/prompt.trigger.md`,
    verifier: `${root}/verify.mjs`, oracle: `${root}/reference/oracle.mjs`, rubric: `${root}/reference/answer.md`,
  };
}

export function benchTemplateFiles(benchName: string, kind: 'output' | 'command'): Record<string, string> {
  return kind === 'command' ? commandTemplateFiles(benchName) : outputTemplateFiles(benchName);
}

function outputTemplateFiles(benchName: string): Record<string, string> {
  const files = taskFilePaths('example-task');
  return {
    'bench.json': `${JSON.stringify(
      {
        schemaVersion: 1,
        name: benchName,
        description: 'Describe what real-work tasks this bench measures.',
        tasks: [
          {
            id: 'example-task',
            fixture: files.fixture,
            prompt: files.prompt,
            promptTrigger: files.promptTrigger,
            verifier: `node ${files.verifier}`,
            oracle: `node ${files.oracle}`,
            rubric: files.rubric,
          },
        ],
      },
      null,
      2,
    )}\n`,
    [files.prompt]: `# Example task

The repository snapshot below contains \`answer.txt\`. Reply with its exact contents and nothing else.
`,
    [files.promptTrigger]: `# Example task

The repository in your current working directory contains \`answer.txt\`. Reply with its exact contents and nothing else.
`,
    [`${files.fixture}/answer.txt`]: 'skillfit-ok\n',
    [`${files.fixture}/${MOCK_MARKER_FILE}`]: `${JSON.stringify(
      { baseline: { output: 'skillfit-ok' }, treatment: { output: 'skillfit-ok' } },
      null,
      2,
    )}\n`,
    [files.verifier]: `import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node example-task.mjs <run-dir>');
  process.exit(2);
}

let output;
try {
  output = fs.readFileSync(path.join(runDir, '_output.md'), 'utf8').trim();
} catch {
  console.log(JSON.stringify({ passed: false, checks: [{ name: 'exact-answer', pass: false }], error: 'missing _output.md' }));
  process.exit(1);
}
const passed = output === 'skillfit-ok';
console.log(JSON.stringify({ passed, checks: [{ name: 'exact-answer', pass: passed }] }));
process.exitCode = passed ? 0 : 1;
`,
    [files.oracle]: `import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-example-task.mjs <run-dir>');
  process.exit(2);
}

// The oracle applies the reference solution: the exact contents of answer.txt.
const answer = fs.readFileSync(path.join(runDir, 'answer.txt'), 'utf8').trim();
fs.writeFileSync(path.join(runDir, '_output.md'), answer + '\\n', 'utf8');
`,
    [files.rubric]: `# Ground truth — example-task

The expected answer is \`skillfit-ok\` (the exact contents of \`answer.txt\`).

This task is a placeholder so the scaffold passes \`skillfit bench check\` out of the box. Replace it with
a real task from your own work:

1. Drop the real (pre-change) repository state into \`tasks/<task-id>/fixture/\` — the best tasks come from
   failures you have actually seen: a bug that escaped review, a migration that went wrong.
2. Write the prompt a teammate would get (\`tasks/<task-id>/prompt.md\`, plus a \`prompt.trigger.md\` variant that
   references the on-disk repo instead of the inline snapshot).
3. Encode what you would check by hand into \`tasks/<task-id>/verify.mjs\` — exit code 0 = pass, nothing else
   matters. Keep it deterministic: no network, no clocks, no randomness.
4. Record the expected answer here in \`tasks/<task-id>/reference/\` so future edits stay honest.
5. Run \`skillfit bench check\`. Calibration is a separate, explicitly authorized
   live experiment; offline checks do not establish model efficacy or adoption.
   See docs/guides/bench-authoring.md in the skillfit repository.
`,
  };
}


/** A dependency-free teaching case; users replace it with their own real task. */
export function commandTemplateFiles(benchName: string): Record<string, string> {
  const files = taskFilePaths('example-task');
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
        fixture: files.fixture,
        prompt: files.prompt,
        promptTrigger: files.promptTrigger,
        verifierKind: 'command',
        verifier: `node ${files.verifier}`,
        oracle: `node ${files.oracle}`,
        rubric: files.rubric,
      }],
    }, null, 2) + '\n',
    [files.prompt]: prompt,
    [files.promptTrigger]: prompt,
    [`${files.fixture}/package.json`]: JSON.stringify({
      private: true, type: 'module', scripts: { test: 'node --test test.mjs' },
    }, null, 2) + '\n',
    [`${files.fixture}/index.js`]: 'export function add(a, b) { return a - b; }\n',
    [`${files.fixture}/test.mjs`]: `import assert from 'node:assert/strict';
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
    [files.verifier]: String.raw`import { spawnSync } from 'node:child_process';
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
      readFileSync(new URL('./fixture/' + file, import.meta.url))));
} catch { /* Missing protected files fail the same gate. */ }

if (checks[0].pass) {
  // Grade behavior outside the editable fixture tests, in a separate process.
  // A crash, early exit, syntax error or deadline cannot become a passing grade.
  const probe = fileURLToPath(new URL('./probe.mjs', import.meta.url));
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
    ['tasks/example-task/probe.mjs']: `import { pathToFileURL } from 'node:url';
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
    [files.oracle]: String.raw`import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-example-task.mjs <run-dir>');
  process.exit(2);
}
writeFileSync(join(runDir, 'index.js'), 'export function add(a, b) { return a + b; }\n');
`,
    [files.rubric]: `# Ground truth — example-task

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
where appropriate. See docs/guides/bench-authoring.md in the skillfit repository.
`,
  };
}
