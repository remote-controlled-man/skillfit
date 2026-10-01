import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const runDir = path.resolve(process.argv[2] ?? '.');
const benchDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(benchDir, 'fixtures/view-utf8');
const sourcePath = path.join(runDir, 'src/resolve-view-resource.ts');
const checks = [];
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, pass: true });
  } catch (error) {
    checks.push({ name, pass: false });
    failures.push(`${name}: ${error.message}`);
  }
}

function testFiles(root) {
  const dir = path.join(root, 'test');
  return fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => name.endsWith('.test.mjs')).map((name) => path.join(dir, name))
    : [];
}

function runTests(root) {
  const tests = testFiles(root);
  assert.ok(tests.length > 0, 'no test files');
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...tests], {
    cwd: root, encoding: 'utf8', timeout: 10_000, env,
  });
  if (result.error) throw result.error;
  assert.equal(result.signal, null, `test process ended with signal ${result.signal}`);
  return result;
}

let resolveViewResource;
let importError;
try {
  ({ resolveViewResource } = await import(pathToFileURL(sourcePath)));
} catch (error) {
  importError = error;
}
const mimeType = 'text/html;profile=mcp-app';
function resolve(content, options = {}) {
  if (importError) throw importError;
  assert.equal(typeof resolveViewResource, 'function');
  return resolveViewResource({
    resourceResult: { contents: [content] }, cspMode: 'strict', ...options,
  });
}

await check('Unicode blob round-trip', () => {
  const html = '<p>你好，世界 🌍 café</p>';
  assert.equal(resolve({ mimeType, blob: Buffer.from(html).toString('base64') }).html, html);
});
await check('ASCII blob unchanged', () => {
  const html = '<p>Hello</p>';
  assert.equal(resolve({ mimeType, blob: Buffer.from(html).toString('base64') }).html, html);
});
await check('text content takes precedence', () => {
  assert.equal(resolve({ mimeType, text: '<p>文字</p>', blob: 'invalid' }).html, '<p>文字</p>');
});
await check('content-level metadata merges over listing', () => {
  const csp = { connectDomains: ['https://example.com'] };
  const permissions = { camera: {} };
  const result = resolve(
    { mimeType, text: '<p>ok</p>', _meta: { ui: { csp, permissions, prefersBorder: false } } },
    { listingResource: { _meta: { ui: { prefersBorder: true } } } },
  );
  assert.deepEqual(result.csp, csp);
  assert.deepEqual(result.declaredCsp, csp);
  assert.equal(result.prefersBorder, false);
  assert.deepEqual(result.permissions, permissions);
});
await check('permissive CSP stays unenforced', () => {
  const csp = { connectDomains: ['https://example.com'] };
  const result = resolve({ mimeType, text: '<p>ok</p>', _meta: { ui: { csp } } }, { cspMode: 'permissive' });
  assert.deepEqual(result.declaredCsp, csp);
  assert.equal(result.csp, undefined);
});
await check('MIME validation and missing-content behavior', () => {
  assert.equal(resolve({ mimeType, text: 'ok' }).mimeTypeValid, true);
  const invalid = resolve({ mimeType: 'text/plain', text: 'ok' });
  assert.equal(invalid.mimeTypeValid, false);
  assert.match(invalid.mimeTypeWarning, /Invalid MIME type/);
  assert.throws(() => resolve({ mimeType }), /No HTML content in resource/);
});
await check('final test suite passes', () => {
  const result = runTests(runDir);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
await check('regression test is red on original source', () => {
  const initial = new Map(testFiles(fixtureDir).map((file) => [path.basename(file), fs.readFileSync(file, 'utf8')]));
  const changed = testFiles(runDir).filter((file) => initial.get(path.basename(file)) !== fs.readFileSync(file, 'utf8'));
  assert.ok(changed.length > 0, 'test suite was not changed');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'skillfit-oss-view-red-'));
  try {
    fs.cpSync(runDir, temp, { recursive: true });
    fs.copyFileSync(path.join(fixtureDir, 'src/resolve-view-resource.ts'), path.join(temp, 'src/resolve-view-resource.ts'));
    const result = runTests(temp);
    assert.notEqual(result.status, 0, 'regression suite remains green on the original bug');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

const score = checks.filter((item) => item.pass).length;
const maxScore = checks.length;
const passed = score === maxScore;
console.log(JSON.stringify({ score, maxScore, passed, failures, checks }));
process.exit(passed ? 0 : 1);
