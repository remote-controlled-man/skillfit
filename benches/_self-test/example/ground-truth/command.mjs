import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
writeFileSync(join(process.argv[2], 'state.txt'), 'fixed\n');
