import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const runDir = path.resolve(process.argv[2]);
const graderDir = path.dirname(fileURLToPath(import.meta.url));
const canonicalFixture = path.resolve(graderDir, '../fixtures/ttl-cache');

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
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ttl-cache-evidence-'));
    let originalFailed = false;
    try {
      copyNonHarnessWorkspace(temporaryRoot);
      fs.copyFileSync(
        path.join(canonicalFixture, 'src/ttl-cache.mjs'),
        path.join(temporaryRoot, 'src/ttl-cache.mjs'),
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
let TtlCache;
try {
  ({ TtlCache } = await import(pathToFileURL(path.join(runDir, 'src/ttl-cache.mjs'))));
} catch (error) {
  console.log(JSON.stringify({ score: 0, maxScore: 8, passed: false, failures: [`import: ${error.message}`], evidence }));
  process.exit(1);
}

const checks = [
  ['false retained', () => { let n=0; const c=new TtlCache(()=>n); c.set('x', false, 5); assert.equal(c.get('x'), false); }],
  ['zero retained', () => { let n=0; const c=new TtlCache(()=>n); c.set('x', 0, 5); assert.equal(c.get('x'), 0); }],
  ['empty string retained', () => { let n=0; const c=new TtlCache(()=>n); c.set('x', '', 5); assert.equal(c.get('x'), ''); }],
  ['expiry boundary excluded', () => { let n=10; const c=new TtlCache(()=>n); c.set('x', 1, 5); n=15; assert.equal(c.get('x'), undefined); }],
  ['fixed ttl', () => { let n=0; const c=new TtlCache(()=>n); c.set('x', 1, 5); n=4; assert.equal(c.get('x'), 1); n=5; assert.equal(c.get('x'), undefined); }],
  ['expired entry deleted', () => { let n=0; const c=new TtlCache(()=>n); c.set('x', 1, 1); n=2; c.get('x'); assert.equal(c.entries.has('x'), false); }],
  ['negative ttl rejected', () => { const c=new TtlCache(()=>0); assert.throws(()=>c.set('x',1,-1), TypeError); }],
  ['non-finite ttl rejected', () => { const c=new TtlCache(()=>0); assert.throws(()=>c.set('x',1,Infinity), TypeError); }],
];
const failures=[];
for(const [name,check] of checks){try{check();}catch(error){failures.push(`${name}: ${error.message}`);}}
const passed = failures.length===0;
console.log(JSON.stringify({score:checks.length-failures.length,maxScore:checks.length,passed,failures,evidence}));
process.exit(passed ? 0 : 1);
