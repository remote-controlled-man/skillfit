import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const raw = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
export const VERSION = raw.version;
