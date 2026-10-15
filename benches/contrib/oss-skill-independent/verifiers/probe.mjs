import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { caseNames, runCase } from './cases.mjs';
const [task, directory, suppliedIndex] = process.argv.slice(2), index = Number(suppliedIndex);
assert.ok(Number.isInteger(index) && index >= 0 && index < 4);
const name = caseNames(task)[index], unhandled = [];
process.on('unhandledRejection', error => unhandled.push(String(error?.message ?? error)));
let passed = false, detail;
try {
  const api = await import(pathToFileURL(resolve(directory, 'index.js')));
  await runCase(api, task, index);
  await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(unhandled, [], 'public calls must not produce unhandled rejections'); passed = true;
} catch (error) { detail = String(error.message).slice(0, 700); }
console.log(JSON.stringify({ name, pass: passed, ...(detail ? { detail } : {}) }));
