import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runProcess } from "./process.js";

test('shared process preserves argv, cwd, stdin EOF and verifier environment without a shell', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-process-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'echo.mjs'), `let input=''; for await (const chunk of process.stdin) input+=chunk;
    console.log(JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),input,testContext:process.env.NODE_TEST_CONTEXT??null}));`);
  const result = await runProcess(process.execPath, ['echo.mjs', 'one two', '$(never-run)', ';literal'], dir, 5000);
  assert.equal(result.error, null); assert.equal(result.exitCode, 0);
  const payload = JSON.parse(result.output);
  assert.deepEqual(payload.args, ['one two', '$(never-run)', ';literal']);
  assert.equal(payload.cwd, realpathSync(dir)); assert.equal(payload.input, ''); assert.equal(payload.testContext, null);
});

test('shared process bounds output and preserves pre-overflow bytes', async () => {
  const result = await runProcess(process.execPath, ['-e', "process.stdout.write('before overflow\\n');setTimeout(()=>process.stdout.write(Buffer.alloc(9*1024*1024,120)),20);setInterval(()=>{},1000);"], tmpdir(), 5000);
  assert.equal(result.exitCode, null); assert.equal(result.error, 'output exceeded 8388608 bytes');
  assert.match(result.output, /^before overflow\n/);
  assert.ok(Buffer.byteLength(result.output) <= 8 * 1024 * 1024);
});

test('shared process deadline terminates descendants and drains their inherited pipes', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-process-tree-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const heartbeat = join(dir, 'heartbeat');
  writeFileSync(join(dir, 'tree.mjs'), `import{spawn}from'node:child_process';
    spawn(process.execPath,['-e',${JSON.stringify("const fs=require('node:fs');fs.writeFileSync(process.argv[1],'ready');setInterval(()=>fs.appendFileSync(process.argv[1],'x'),20);")},${JSON.stringify(heartbeat)}],{stdio:'inherit'});
    setInterval(()=>{},1000);`);
  const result = await runProcess(process.execPath, ['tree.mjs'], dir, 2000);
  assert.equal(result.exitCode, null); assert.equal(result.error, 'timed out after 2000ms');
  assert.match(result.output, /\[timed out after 2000ms\]/);
  assert.ok(existsSync(heartbeat), 'descendant must have started before the deadline');
  const stopped = readFileSync(heartbeat, 'utf8');
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(readFileSync(heartbeat, 'utf8'), stopped, 'descendant must stop writing after timeout');
});
