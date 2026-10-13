import { resolve } from 'node:path';
import { grade } from './shared.mjs';
process.exitCode = await grade('fetch-lifecycle', resolve(process.argv[2])) ? 0 : 1;
