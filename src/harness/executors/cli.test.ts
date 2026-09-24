import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { agentIds, getAgent } from '../../agents.js';
import { CliExecutor, quoteShellArg } from './cli.js';

const ECHO_SCRIPT =
  'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write("len:"+d.length))';

const PASSTHROUGH_SCRIPT =
  'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(d))';

function toNdjson(events: unknown[]): string {
  return events.map((event) => JSON.stringify(event)).join('\n');
}

const KIMI_SKILL_CALL_EVENTS = [
  {
    role: 'assistant',
    tool_calls: [
      {
        type: 'function',
        id: 'tool_x',
        function: { name: 'Skill', arguments: JSON.stringify({ skill: 'banana-standards' }) },
      },
    ],
  },
  {
    role: 'tool',
    tool_call_id: 'tool_x',
    content: 'Skill "banana-standards" loaded inline. Follow its instructions.',
  },
];

const KIMI_ASSISTANT_TEXT_EVENTS = [
  { role: 'assistant', content: 'A ripe banana is stage 5.' },
  { role: 'assistant', content: 'Stage 6 has brown spots.' },
];

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

test('CliExecutor trigger detection detects a Skill tool_call in kimi stream-json', async () => {
  const executor = new CliExecutor({
    argv: [process.execPath, '-e', PASSTHROUGH_SCRIPT],
    shell: false,
    triggerSkillName: 'banana-standards',
    triggerToolName: 'Skill',
  });
  const transcript = toNdjson([
    { role: 'meta', type: 'system.version', version: '2.0.0' },
    ...KIMI_SKILL_CALL_EVENTS,
    ...KIMI_ASSISTANT_TEXT_EVENTS,
  ]);
  const result = await executor.run(transcript, process.cwd());
  assert.equal(result.skillTriggered, true);
  assert.equal(result.output, 'A ripe banana is stage 5.\nStage 6 has brown spots.');
});

test('CliExecutor trigger detection reports false when no Skill tool_call fires', async () => {
  const executor = new CliExecutor({
    argv: [process.execPath, '-e', PASSTHROUGH_SCRIPT],
    shell: false,
    triggerSkillName: 'banana-standards',
    triggerToolName: 'Skill',
  });
  const transcript = toNdjson([
    { role: 'meta', type: 'system.version', version: '2.0.0' },
    ...KIMI_ASSISTANT_TEXT_EVENTS,
  ]);
  const result = await executor.run(transcript, process.cwd());
  assert.equal(result.skillTriggered, false);
  assert.equal(result.output, 'A ripe banana is stage 5.\nStage 6 has brown spots.');
});

test('CliExecutor trigger detection passes raw output through when stdout is not NDJSON', async () => {
  const executor = new CliExecutor({
    argv: [process.execPath, '-e', PASSTHROUGH_SCRIPT],
    shell: false,
    triggerSkillName: 'banana-standards',
    triggerToolName: 'Skill',
  });
  const plain = 'plain text output, no json here\nanother prose line (not json)';
  const result = await executor.run(plain, process.cwd());
  assert.equal(result.skillTriggered, undefined);
  assert.equal(result.output, plain);
});

test('CliExecutor trigger detection understands the claude stream-json assistant shape', async () => {
  const executor = new CliExecutor({
    argv: [process.execPath, '-e', PASSTHROUGH_SCRIPT],
    shell: false,
    triggerSkillName: 'banana-standards',
    triggerToolName: 'Skill',
  });
  const transcript = toNdjson([
    { type: 'system', subtype: 'init' },
    {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Let me check the skill.' },
          { type: 'tool_use', name: 'Skill', input: { skill: 'banana-standards' } },
        ],
      },
    },
    {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'A ripe banana is stage 5.' }] },
    },
    { type: 'result' },
  ]);
  const result = await executor.run(transcript, process.cwd());
  assert.equal(result.skillTriggered, true);
  assert.equal(result.output, 'Let me check the skill.\nA ripe banana is stage 5.');
});

test('CliExecutor.forAgent with triggerSkillName uses the streamJson template', () => {
  const streamJson = getAgent('kimi-code').headless.streamJson;
  assert.ok(streamJson);
  const executor = CliExecutor.forAgent('kimi-code', { triggerSkillName: 'banana-standards' });
  assert.equal(executor.describe().detail, `kimi-code: ${streamJson.argv.join(' ')}`);
});

test('CliExecutor.forAgent with triggerSkillName rejects agents without streamJson', () => {
  assert.throws(
    () => CliExecutor.forAgent('claude-code', { triggerSkillName: 'banana-standards' }),
    /streamJson/,
  );
  const codex = CliExecutor.forAgent('codex', { triggerSkillName: 'banana-standards' });
  assert.match(codex.describe().detail ?? '', /--json/);
});


test('CliExecutor parses codex items: text, skill file-read trigger, and token usage', async () => {
  const events = [
    { type: 'thread.started', thread_id: 't1' },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: {
        id: 'item_1',
        type: 'command_execution',
        command: 'powershell -Command "Get-Content -Raw \'C:\\\\repo\\\\.agents\\\\skills\\\\banana-standards\\\\SKILL.md\'"',
        status: 'completed',
      },
    },
    { type: 'item.completed', item: { id: 'item_2', type: 'agent_message', text: 'Stage 5, yellow with brown flecks.' } },
    {
      type: 'turn.completed',
      usage: { input_tokens: 42170, cached_input_tokens: 32896, output_tokens: 272 },
    },
  ];
  const stdinScript =
    'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(d))';
  const executor = new CliExecutor({
    argv: [process.execPath, '-e', stdinScript],
    shell: false,
    triggerSkillName: 'banana-standards',
  });
  const ndjson = events.map((event) => JSON.stringify(event)).join('\n') + '\n';
  const result = await executor.run(ndjson, process.cwd());
  assert.equal(result.output, 'Stage 5, yellow with brown flecks.');
  assert.equal(result.skillTriggered, true);
  assert.deepEqual(result.tokens, { input: 42170, output: 272 });
});

test('CliExecutor codex shape: no skill-path command means no trigger', async () => {
  const events = [
    { type: 'item.completed', item: { id: 'i1', type: 'command_execution', command: 'Get-Content README.md' } },
    { type: 'item.completed', item: { id: 'i2', type: 'agent_message', text: 'Paris' } },
    { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 3 } },
  ];
  const stdinScript =
    'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(d))';
  const executor = new CliExecutor({
    argv: [process.execPath, '-e', stdinScript],
    shell: false,
    triggerSkillName: 'banana-standards',
  });
  const result = await executor.run(events.map((event) => JSON.stringify(event)).join('\n'), process.cwd());
  assert.equal(result.output, 'Paris');
  assert.equal(result.skillTriggered, false);
});

test('CliExecutor kills the whole process tree when a trial times out', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-cli-tree-'));
  const marker = join(dir, 'grandchild.pid');
  const sleeper = join(dir, 'sleeper.cjs');
  writeFileSync(
    sleeper,
    `require('fs').writeFileSync(${JSON.stringify(marker)}, String(process.pid));\nsetTimeout(() => {}, 30000);\n`,
    'utf8',
  );
  t.after(() => {
    // Do not leave a 30s orphan behind if the assertion below fails.
    try {
      const pid = Number(readFileSync(marker, 'utf8'));
      if (Number.isFinite(pid) && pid > 0) process.kill(pid);
    } catch {
      // already gone
    }
    rmSync(dir, { recursive: true, force: true });
  });

  // shell defaults to true, which is the case that matters: child.kill() reaches the shell and the
  // agent it started carries on running.
  const executor = new CliExecutor({ argv: [process.execPath, sleeper], timeoutMs: 3_000 });
  await assert.rejects(executor.run('ignored', dir), /timed out/);

  const pid = Number(readFileSync(marker, 'utf8'));
  assert.ok(Number.isFinite(pid) && pid > 0, 'the grandchild recorded its pid before the timeout');
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  let alive = true;
  try {
    process.kill(pid, 0);
  } catch {
    alive = false;
  }
  assert.equal(alive, false, 'the agent process must not outlive the timeout and keep spending tokens');
});

test('CliExecutor rejects when the child exits before draining stdin', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-cli-epipe-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const instantExit = join(dir, 'instant-exit.cjs');
  writeFileSync(instantExit, 'process.exit(0);\n', 'utf8');

  const executor = new CliExecutor({
    argv: [process.execPath, instantExit],
    shell: false,
    promptVia: 'stdin',
    timeoutMs: 15_000,
  });
  // Larger than the OS pipe buffer, so the write cannot complete before the child is gone. An
  // unhandled stdin 'error' event would be thrown as an uncaught exception and take the whole test
  // process down; a rejection is what the caller's error path expects.
  await assert.rejects(
    executor.run('x'.repeat(8 * 1024 * 1024), dir),
    /Failed to write the prompt .* on stdin/,
  );
});
