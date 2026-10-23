import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
writeFileSync(join(process.argv[2], '_output.md'), 'skillfit-control-ok\n');
