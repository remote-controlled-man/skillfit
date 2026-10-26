import { resolve } from 'node:path';
import { grade } from '../../verifiers/shared.mjs';
process.exitCode = await grade('fetch-abort', resolve(process.argv[2])) ? 0 : 1;
