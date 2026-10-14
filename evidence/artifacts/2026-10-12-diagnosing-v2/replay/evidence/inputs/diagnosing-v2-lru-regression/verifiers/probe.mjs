import { resolve } from 'node:path';
import { loadCache } from '../runtime.mjs';
import { checksFor } from './cases.mjs';
const [id, root] = process.argv.slice(2);
let loaded; const checks = [];
try {
  loaded = await loadCache(resolve(root), id === 'fetch-lifecycle');
  for (const [name, body] of checksFor(id, loaded.Cache)) {
    try { await body(); checks.push({ name, pass: true }); }
    catch (error) { checks.push({ name, pass: false, detail: String(error.message).slice(0, 400) }); }
  }
  console.log(JSON.stringify({ checks }));
} catch (error) { console.log(JSON.stringify({ error: String(error.message).slice(0, 400) })); }
finally { loaded?.cleanup(); }
