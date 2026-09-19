import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const runDir = path.resolve(process.argv[2]);
const graderDir = path.dirname(fileURLToPath(import.meta.url));
const canonicalFixture = path.resolve(graderDir, '../fixtures/chunked-decoder');

function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name.startsWith('_') || entry.isSymbolicLink()) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile()) files.push(fullPath);
    }
  };
  visit(root);
  return files.sort((left, right) => left.localeCompare(right, 'en'));
}

function isTestCandidate(relative) {
  return /(^|\/)(?:test|tests|__tests__)(\/|$)|\.(?:test|spec)\.mjs$/i.test(relative);
}

function runOneTest(root, relative) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ['--test', path.join(root, ...relative.split('/'))], {
    cwd: root,
    encoding: 'utf8',
    timeout: 5_000,
    windowsHide: true,
    env,
  });
}

function completedWith(result, predicate) {
  return !result.error && result.signal == null && typeof result.status === 'number' && predicate(result.status);
}

function copyNonHarnessWorkspace(destination) {
  fs.cpSync(runDir, destination, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(runDir, source).replaceAll('\\', '/');
      return relative === '' || (!relative.split('/').some((segment) => segment === '.git') && !path.basename(source).startsWith('_'));
    },
  });
}

function collectTestAssetEvidence() {
  const candidates = listFiles(runDir)
    .map((file) => path.relative(runDir, file).replaceAll('\\', '/'))
    .filter(isTestCandidate)
    .filter((relative) => !fs.existsSync(path.join(canonicalFixture, ...relative.split('/'))));
  return candidates.map((relative) => {
    const finalPath = path.join(runDir, ...relative.split('/'));
    const finalResult = runOneTest(runDir, relative);
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'chunked-decoder-evidence-'));
    let originalFailed = false;
    try {
      copyNonHarnessWorkspace(temporaryRoot);
      fs.copyFileSync(
        path.join(canonicalFixture, 'src/frame-decoder.mjs'),
        path.join(temporaryRoot, 'src/frame-decoder.mjs'),
      );
      originalFailed = completedWith(runOneTest(temporaryRoot, relative), (status) => status !== 0);
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
    return {
      path: relative,
      initialExists: false,
      nonEmpty: fs.statSync(finalPath).size > 0,
      finalPassed: completedWith(finalResult, (status) => status === 0),
      originalFailed,
    };
  });
}

const evidence = { testAssets: collectTestAssetEvidence() };
let FrameDecoder;
try {
  ({ FrameDecoder } = await import(pathToFileURL(path.join(runDir, 'src/frame-decoder.mjs'))));
} catch (error) {
  console.log(JSON.stringify({ score: 0, maxScore: 10, passed: false, failures: [`import: ${error.message}`], evidence }));
  process.exit(1);
}

const encode = (text) => new TextEncoder().encode(text);

function concat(...arrays) {
  const total = arrays.reduce((sum, array) => sum + array.length, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const array of arrays) {
    joined.set(array, offset);
    offset += array.length;
  }
  return joined;
}

function frame(payload) {
  const body = encode(payload);
  return concat(encode(`${body.length}\n`), body);
}

function pushInPieces(decoder, stream, pieces) {
  let offset = 0;
  for (const size of pieces) {
    decoder.push(stream.subarray(offset, offset + size));
    offset += size;
  }
  if (offset < stream.length) decoder.push(stream.subarray(offset));
}

function assertTypeErrorWithMessage(operation) {
  let caught = null;
  try {
    operation();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof TypeError, `expected a TypeError, got ${caught}`);
  assert.match(caught.message, /length/i);
}

const checks = [
  ['chunk-aligned frames decode', () => {
    const decoder = new FrameDecoder();
    decoder.push(concat(frame('hello'), frame('world')));
    assert.deepEqual(decoder.drain(), ['hello', 'world']);
  }],
  ['drain empties the output backlog', () => {
    const decoder = new FrameDecoder();
    decoder.push(frame('abc'));
    assert.deepEqual(decoder.drain(), ['abc']);
    assert.deepEqual(decoder.drain(), []);
  }],
  ['header split across chunks still parses', () => {
    const decoder = new FrameDecoder();
    const stream = frame('hello');
    pushInPieces(decoder, stream, [1, 2]);
    assert.deepEqual(decoder.drain(), ['hello']);
  }],
  ['stream fed one byte at a time decodes every frame', () => {
    const decoder = new FrameDecoder();
    const stream = concat(frame('first'), frame('second'), frame('third'));
    for (let index = 0; index < stream.length; index += 1) {
      decoder.push(stream.subarray(index, index + 1));
    }
    assert.deepEqual(decoder.drain(), ['first', 'second', 'third']);
  }],
  ['multibyte character split across chunks decodes cleanly', () => {
    const decoder = new FrameDecoder();
    const stream = frame('héllo');
    pushInPieces(decoder, stream, [4, 1]);
    assert.deepEqual(decoder.drain(), ['héllo']);
  }],
  ['payload split mid-character mid-payload decodes cleanly', () => {
    const decoder = new FrameDecoder();
    const stream = concat(frame('日本語'), frame('ok'));
    pushInPieces(decoder, stream, [5, stream.length - 7]);
    assert.deepEqual(decoder.drain(), ['日本語', 'ok']);
  }],
  ['empty payload frame decodes', () => {
    const decoder = new FrameDecoder();
    decoder.push(frame(''));
    assert.deepEqual(decoder.drain(), ['']);
  }],
  ['negative length prefix throws TypeError', () => {
    const decoder = new FrameDecoder();
    assertTypeErrorWithMessage(() => decoder.push(encode('-3\nabc')));
  }],
  ['absurd length prefix throws TypeError', () => {
    const decoder = new FrameDecoder();
    assertTypeErrorWithMessage(() => decoder.push(encode('99999999999999999999\nx')));
  }],
  ['flush returns frames not yet drained', () => {
    const decoder = new FrameDecoder();
    decoder.push(frame('tail'));
    assert.deepEqual(decoder.flush(), ['tail']);
    assert.deepEqual(decoder.drain(), []);
  }],
];

const failures = [];
for (const [name, check] of checks) {
  try {
    check();
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}
const passed = failures.length === 0;
console.log(JSON.stringify({ score: checks.length - failures.length, maxScore: checks.length, passed, failures, evidence }));
process.exit(passed ? 0 : 1);
