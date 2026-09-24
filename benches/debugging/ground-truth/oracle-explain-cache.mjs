import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: node oracle-explain-cache.mjs <run-dir>');
  process.exit(2);
}

fs.writeFileSync(
  path.join(runDir, '_output.md'),
  [
    'An entry is readable from the moment you set it until its deadline, which is exactly set() time plus',
    'ttlMs. At that instant it is already gone: the comparison is inclusive of the deadline, so a value set',
    'at t=10 with ttlMs=5 is not returned at t=15.',
    '',
    'The deadline is fixed when you write. get() never moves it, so an entry read constantly expires on the',
    'same schedule as one never read at all.',
    '',
    'Expiry is lazy. Nothing runs in the background; the get() that first observes an expired entry deletes',
    'it from the internal map and returns undefined, so the map does not accumulate dead keys.',
    '',
    'ttlMs must be a finite non-negative number. -1, NaN and Infinity all throw TypeError at set() time.',
    'Falsy values such as false, 0 and "" are ordinary cached values and come back unchanged.',
    '',
  ].join('\n'),
  'utf8',
);
