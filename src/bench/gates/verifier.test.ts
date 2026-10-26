import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { parseCommand } from "../../shared/command.js";
import { runVerifier } from "../../evaluation/execution/paired.js";
import { loadBench } from "../read.js";

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-verifier-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench with spaces'), run = join(root, 'trial with spaces');
  mkdirSync(bench); mkdirSync(run);
  const script = join(bench, 'check answer.mjs');
  return { root, bench, run, script };
}

test('shell-free commands preserve quoted/empty arguments and Windows paths without expansion', () => {
  const cases: [string, string[]][] = [
    ['node "check answer.mjs" \'two words\' ""', ['node', 'check answer.mjs', 'two words', '']],
    ['node one\\ word.mjs "a\\\"b"', ['node', 'one word.mjs', 'a"b']],
    [String.raw`"C:\Program Files\node.exe" 'C:\bench dir\check.mjs' \\server\share\check.mjs`,
      ['C:\\Program Files\\node.exe', 'C:\\bench dir\\check.mjs', '\\\\server\\share\\check.mjs']],
    ['node prefix"two words"suffix "$VAR" "$(echo bad)" ";" "|"', ['node', 'prefixtwo wordssuffix', '$VAR', '$(echo bad)', ';', '|']],
  ];
  for (const [source, expected] of cases) assert.deepEqual(parseCommand(source), expected);
  for (const invalid of ['', '  ', '"" script', 'node "unfinished', "node 'unfinished", 'node a\0b']) assert.throws(() => parseCommand(invalid), /Command/);
});

test('bench loading and execution agree on quoted script paths and arguments', async t => {
  const f = fixture(t);
  writeFileSync(f.script, "console.log(JSON.stringify({passed:true,args:process.argv.slice(2,-1)}));\n");
  const command = 'node "check answer.mjs" "two words" ""';
  writeFileSync(join(f.bench, 'prompt.md'), 'Inspect the answer.');
  mkdirSync(join(f.bench, 'fixture'));
  writeFileSync(join(f.bench, 'bench.json'), JSON.stringify({ schemaVersion: 1, tasks: [{ id: 't', fixture: 'fixture', prompt: 'prompt.md', verifier: command }] }));
  assert.equal(loadBench(f.bench).tasks[0]!.verifier, command);
  const result = await runVerifier(f.bench, command, f.run);
  assert.equal(result.exitCode, 0, result.output); assert.equal(result.error, null);
  assert.deepEqual(JSON.parse(result.output).args, ['two words', '']);
  for (const quote of ['"', "'"]) {
    const absolute = await runVerifier(f.bench, `${quote}${process.execPath}${quote} ${quote}check answer.mjs${quote}`, f.run);
    assert.equal(absolute.exitCode, 0, absolute.output); assert.equal(absolute.error, null);
  }
});

test('malformed quoting fails without executing the verifier and quoted traversal stays rejected', async t => {
  const f = fixture(t), sentinel = join(f.run, 'called');
  writeFileSync(f.script, `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(sentinel)},'called');`);
  const result = await runVerifier(f.bench, 'node "check answer.mjs', f.run);
  assert.equal(result.exitCode, null); assert.match(result.error!, /VERIFIER_COMMAND_ERROR/);
  assert.throws(() => readFileSync(sentinel));
  writeFileSync(join(f.bench, 'prompt.md'), 'Inspect.'); mkdirSync(join(f.bench, 'fixture'));
  for (const verifier of ['node "../outside dir/check.mjs"', '"../outside dir/node" script', 'node "check answer.mjs']) {
    writeFileSync(join(f.bench, 'bench.json'), JSON.stringify({ schemaVersion: 1, tasks: [{ id: 't', fixture: 'fixture', prompt: 'prompt.md', verifier }] }));
    assert.throws(() => loadBench(f.bench), /relative path inside|unterminated quote/);
  }
});

for (const [name, source] of [
  ['missing entry', null], ['missing grader dependency', "import './absent.mjs';"],
  ['syntax', 'const broken = ;'], ['reference', 'missingGraderFunction();'],
  ['type', 'null.check();'], ['uncaught error', "throw new Error('broken grader');"],
  ['error after summary', "console.log(JSON.stringify({passed:true}));throw new Error('after summary');"],
] as const) test(`a direct Node verifier ${name} is an infrastructure error with its real exit code retained`, async t => {
  const f = fixture(t); if (source !== null) writeFileSync(f.script, source);
  const result = await runVerifier(f.bench, 'node "check answer.mjs"', f.run);
  assert.notEqual(result.exitCode, 0); assert.notEqual(result.exitCode, null);
  assert.match(result.error!, /VERIFIER_RUNTIME_ERROR/); assert.match(result.output, /Error/);
});

for (const [name, source] of [
  ['plain exit one', 'process.exit(1);'], ['legacy exit seven', 'process.exit(7);'],
  ['normal JSON failure', "console.log(JSON.stringify({passed:false,error:'missing _output.md'}));process.exit(1);"],
  ['assertion failure', "import assert from 'node:assert/strict';assert.equal(1,2);"],
  ['TAP assertion failure', null],
] as const) test(`${name} remains a graded failure`, async t => {
  const f = fixture(t);
  if (source === null) writeFileSync(join(f.bench, 'test.mjs'), "import{test}from'node:test';import assert from'node:assert/strict';test('incorrect answer',()=>assert.equal(1,2));");
  writeFileSync(f.script, source ?? "import{spawnSync}from'node:child_process';const result=spawnSync(process.execPath,['--test','test.mjs'],{encoding:'utf8'});process.stdout.write(result.stdout);process.stderr.write(result.stderr);process.exit(result.status);");
  const result = await runVerifier(f.bench, 'node "check answer.mjs"', f.run);
  assert.notEqual(result.exitCode, 0); assert.equal(result.error, null, result.output);
});

for (const [name, source] of [['syntax', 'const broken = ;'], ['type', 'null.check();'], ['import', "import './missing.mjs';"]] as const) {
  test(`a ${name} error in the candidate workspace remains a graded failure`, async t => {
    const f = fixture(t);
    writeFileSync(join(f.run, 'candidate.mjs'), source);
    writeFileSync(f.script, "import{join}from'node:path';import{pathToFileURL}from'node:url';await import(pathToFileURL(join(process.argv[2],'candidate.mjs')).href);");
    const result = await runVerifier(f.bench, 'node "check answer.mjs"', f.run);
    assert.equal(result.exitCode, 1); assert.equal(result.error, null, result.output);
  });
}

test('a wrapper can grade a child exception without that exception overriding its final verdict', async t => {
  const f = fixture(t);
  writeFileSync(join(f.bench, 'child.mjs'), "throw new Error('a deliberately graded child crash');");
  writeFileSync(f.script, "import{spawnSync}from'node:child_process';const child=spawnSync(process.execPath,['child.mjs'],{encoding:'utf8'});process.stdout.write(child.stderr);console.log(JSON.stringify({passed:false}));process.exit(1);");
  const result = await runVerifier(f.bench, 'node "check answer.mjs"', f.run);
  assert.equal(result.exitCode, 1); assert.equal(result.error, null, result.output);
});

test('mentioning the candidate directory in a grader exception does not change its stack ownership', async t => {
  const f = fixture(t);
  writeFileSync(f.script, "throw new Error('Unable to grade '+process.argv[2]);");
  const result = await runVerifier(f.bench, 'node "check answer.mjs"', f.run);
  assert.match(result.error!, /VERIFIER_RUNTIME_ERROR/);
});

test('explicit verifier errors override any exit/summary while malformed error messages cannot become grades', async t => {
  const f = fixture(t);
  for (const code of [0, 1, 7]) {
    writeFileSync(f.script, `console.log(JSON.stringify({passed:true}));console.log(JSON.stringify({schemaVersion:1,kind:'skillfit.verifier-error',message:'toolchain unavailable'}));process.exit(${code});`);
    const result = await runVerifier(f.bench, 'node "check answer.mjs"', f.run);
    assert.equal(result.exitCode, code); assert.match(result.error!, /VERIFIER_REPORTED_ERROR: toolchain unavailable/);
  }
  writeFileSync(f.script, "console.log(JSON.stringify({kind:'skillfit.verifier-error'}));");
  assert.match((await runVerifier(f.bench, 'node "check answer.mjs"', f.run)).error!, /VERIFIER_PROTOCOL_ERROR/);
});
