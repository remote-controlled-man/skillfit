import { resolve } from 'node:path';
import { applyOracle } from '../../../verifiers/oracle.mjs';
applyOracle('fetch-abort', resolve(process.argv[2]), `
let release; const c = new Cache({ max: 2, fetchMethod: () => new Promise(res => release = res) });
let error; let settled = false; c.fetch('x').then(() => settled = true, e => { settled = true; error = e; });
c.delete('x'); await new Promise(res => setImmediate(res)); const before = settled;
release('late'); await new Promise(res => setImmediate(res));
assert.equal(before, true); assert.equal(error?.message, 'deleted'); assert.equal(c.has('x'), false); cleanup();`);
