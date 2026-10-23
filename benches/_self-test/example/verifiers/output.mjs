import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const file = join(process.argv[2], '_output.md');
const text = existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
const checks = [{ name: 'exact-answer', pass: text === 'skillfit-control-ok' }, { name: 'nonempty', pass: text.length > 0 }];
const passed = checks.every(c => c.pass);
console.log(JSON.stringify({ passed, checks }));
process.exitCode = passed ? 0 : 1;
