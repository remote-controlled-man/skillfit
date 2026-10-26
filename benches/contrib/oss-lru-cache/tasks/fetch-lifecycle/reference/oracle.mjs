import { resolve } from 'node:path';
import { applyOracle } from '../../../verifiers/oracle.mjs';
applyOracle('fetch-lifecycle', resolve(process.argv[2]), `
const inserted = []; let release; const c = new Cache({ max: 2, onInsert: (...args) => inserted.push(args),
  fetchMethod: () => new Promise(res => release = res) });
const p = c.fetch('x'); const before = inserted.slice(); release('X'); await p;
assert.deepEqual(before, []); assert.deepEqual(inserted, [['X','x','add']]); cleanup();`);
