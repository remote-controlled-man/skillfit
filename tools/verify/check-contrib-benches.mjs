import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = 'benches/contrib';
const benches = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(root, entry.name))
  .sort();

if (benches.length === 0) {
  console.log('No contributed benches to check.');
}

for (const bench of benches) {
  console.log(`Checking contributed bench: ${bench}`);
  const result = spawnSync(process.execPath, ['dist/cli.js', 'bench', 'check', bench], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = 1;
}
