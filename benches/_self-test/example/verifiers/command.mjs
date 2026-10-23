import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const text = readFileSync(join(process.argv[2], 'state.txt'), 'utf8');
const checks = [{ name: 'fixed-state', pass: text.trim() === 'fixed' }, { name: 'exact-bytes', pass: text === 'fixed\n' }];
const passed = checks.every(c => c.pass);
console.log(JSON.stringify({ passed, checks }));
process.exitCode = passed ? 0 : 1;
