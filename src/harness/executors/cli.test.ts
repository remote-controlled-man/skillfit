import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CliExecutor, DEFAULT_CLI_COMMANDS } from './cli.js';

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

test('CliExecutor.forAgent uses the headless template per agent', () => {
  for (const [agentId, argv] of Object.entries(DEFAULT_CLI_COMMANDS)) {
    const executor = CliExecutor.forAgent(agentId);
    assert.equal(executor.describe().detail, `${agentId}: ${argv.join(' ')}`);
  }
});

test('CliExecutor.forAgent rejects unknown agents', () => {
  assert.throws(() => CliExecutor.forAgent('not-an-agent'), /Unknown agent/);
});

test('CliExecutor requires a non-empty argv', () => {
  assert.throws(() => new CliExecutor({ argv: [] }), /non-empty argv/);
});
