import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { agentIds, getAgent } from '../../agents.js';
import { CliExecutor, quoteShellArg } from './cli.js';

const ECHO_SCRIPT =
  'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write("len:"+d.length))';

test('CliExecutor pipes the prompt over stdin and returns stdout', async () => {
  const executor = new CliExecutor({
    argv: [process.execPath, '-e', ECHO_SCRIPT],
    shell: false,
  });
  const result = await executor.run('abcdef', process.cwd());
  assert.equal(result.output, 'len:6');
});

test('CliExecutor rejects on a non-zero exit code', async () => {
  const executor = new CliExecutor({
    argv: [process.execPath, '-e', 'process.stderr.write("boom");process.exit(3)'],
    shell: false,
  });
  await assert.rejects(() => executor.run('x', process.cwd()), /exited with code 3.*boom/s);
});

test('CliExecutor rejects when the command cannot be started', async () => {
  const executor = new CliExecutor({
    argv: ['skillfit-definitely-not-a-real-binary-xyz'],
    shell: false,
  });
  await assert.rejects(() => executor.run('x', process.cwd()), /Failed to start/);
});

test('CliExecutor.forAgent uses the headless template from the agent matrix', () => {
  for (const agentId of agentIds()) {
    const headless = getAgent(agentId).headless;
    assert.ok(headless.argv.length > 0, `${agentId} has no headless argv`);
    const executor = CliExecutor.forAgent(agentId);
    assert.equal(executor.describe().detail, `${agentId}: ${headless.argv.join(' ')}`);
  }
});

test('CliExecutor.forAgent kimi-code passes the prompt as a -p file reference', () => {
  const headless = getAgent('kimi-code').headless;
  assert.equal(headless.promptVia, 'file');
  assert.ok(headless.promptFile);
  assert.equal(headless.argv[1], '-p');
  assert.ok(headless.argv.some((arg) => arg.includes('{promptFile}')));
});

test('CliExecutor.forAgent rejects unknown agents', () => {
  assert.throws(() => CliExecutor.forAgent('not-an-agent'), /Unknown agent/);
});

test('CliExecutor requires a non-empty argv', () => {
  assert.throws(() => new CliExecutor({ argv: [] }), /non-empty argv/);
});

test('CliExecutor file mode writes the prompt file and substitutes {promptFile}', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-cli-'));
  try {
    const executor = new CliExecutor({
      argv: [
        process.execPath,
        '-e',
        'process.stdout.write(require("node:fs").readFileSync(process.argv[1],"utf8"))',
        '{promptFile}',
      ],
      shell: false,
      promptVia: 'file',
      promptFile: 'task-prompt.txt',
    });
    const prompt = `file-mode prompt ${'x'.repeat(9000)}`;
    const result = await executor.run(prompt, dir);
    assert.equal(result.output, prompt);
    assert.equal(readFileSync(join(dir, 'task-prompt.txt'), 'utf8'), prompt);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CliExecutor file mode requires a workdir', async () => {
  const executor = new CliExecutor({
    argv: [process.execPath, '-e', 'process.stdout.write("ok")'],
    shell: false,
    promptVia: 'file',
  });
  await assert.rejects(() => executor.run('x', ''), /requires a workdir/);
});

test('CliExecutor file mode rejects an empty promptFile', () => {
  assert.throws(
    () => new CliExecutor({ argv: ['x'], promptVia: 'file', promptFile: '' }),
    /non-empty promptFile/,
  );
});

test('quoteShellArg quotes only whitespace-bearing args', () => {
  assert.equal(quoteShellArg('kimi'), 'kimi');
  assert.equal(quoteShellArg('-p'), '-p');
  assert.equal(quoteShellArg('Read the file'), '"Read the file"');
  assert.equal(quoteShellArg(''), '""');
  assert.equal(quoteShellArg('"already quoted"'), '"already quoted"');
});

test('CliExecutor with shell keeps a multi-word arg as one argument', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-cli-'));
  try {
    const executor = new CliExecutor({
      argv: [
        process.execPath,
        '-e',
        'process.stdout.write( JSON.stringify(process.argv.slice(1)) )',
        'two words',
      ],
      shell: true,
    });
    const result = await executor.run('', dir);
    assert.deepEqual(JSON.parse(result.output), ['two words']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
