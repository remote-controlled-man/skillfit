import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checksFor } from './cases.mjs';
const {default: normalize} = await import(pathToFileURL(join(resolve(process.argv[2]), 'index.js')));
const checks = [];
for (const [name, run] of checksFor(normalize)) {
  try { run(); checks.push({name, pass: true}); }
  catch (error) { checks.push({name, pass: false, detail: String(error.message).slice(0, 400)}); }
}
console.log(JSON.stringify({checks}));
