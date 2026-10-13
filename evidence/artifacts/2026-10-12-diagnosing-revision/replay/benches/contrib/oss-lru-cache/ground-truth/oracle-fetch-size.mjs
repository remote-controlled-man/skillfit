import { resolve } from 'node:path';
import { applyOracle } from './oracle.mjs';
applyOracle('fetch-size', resolve(process.argv[2]), `
const jobs = new Map(); const c = new Cache({ maxSize: 10, sizeCalculation: (v, k) => k,
  fetchMethod: key => new Promise(res => jobs.set(key, res)) });
const ps = [3,4,5].map(k => c.fetch(k)); jobs.get(4)(4); await ps[1]; jobs.get(5)(5); await ps[2]; jobs.get(3)(3); await ps[0];
assert.equal(c.size, 2); assert.equal(c.calculatedSize, 8); assert.equal(c.has(3), true); assert.equal(c.has(5), true); cleanup();`);
