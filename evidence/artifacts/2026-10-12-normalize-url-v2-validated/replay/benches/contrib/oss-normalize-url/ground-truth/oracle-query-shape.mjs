import { copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const run=resolve(process.argv[2]);
copyFileSync(join(root,'query-shape/index.js'),join(run,'index.js'));
copyFileSync(join(root,'query-shape.regression.test.mjs'),join(run,'query-shape.regression.test.mjs'));
