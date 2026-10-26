import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const inputs = Object.fromEntries(['README.md', 'docs/guide.md'].map((file) => [file, hash(file)]));
const links = [...readFileSync('README.md', 'utf8').matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
const passed = links.length > 0 && links.every((link) => !link.includes('://') && existsSync(resolve(link)));
const receipt = { schemaVersion: 1, tool: 'scripts/check-links.mjs', toolSha256: hash('scripts/check-links.mjs'), inputs, passed };
const logFile = '_link-check-calls.json';
const calls = existsSync(logFile) ? JSON.parse(readFileSync(logFile, 'utf8')) : [];
calls.push(receipt);
writeFileSync(logFile, JSON.stringify(calls, null, 2) + '\n');
writeFileSync('validation-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
process.exit(passed ? 0 : 1);
