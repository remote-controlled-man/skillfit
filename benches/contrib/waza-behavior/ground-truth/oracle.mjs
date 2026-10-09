import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [id, suppliedDir] = process.argv.slice(2);
if (!['explicit-hold', 'receipt-current', 'receipt-stale'].includes(id) || !suppliedDir) process.exit(2);
const runDir = resolve(suppliedDir);
if (id === 'explicit-hold') {
  // bench check copies fixtures without Git; the actual runner initializes them before model calls.
  if (!existsSync(join(runDir, '.git'))) {
    for (const args of [['init', '-q'], ['config', 'user.name', 'Offline oracle'], ['config', 'user.email', 'oracle@example.invalid'],
      ['add', '.'], ['-c', 'commit.gpgsign=false', 'commit', '-qm', 'Initial fixture']]) {
      execFileSync('git', args, { cwd: runDir });
    }
  }
  writeFileSync(join(runDir, 'README.md'), 'Project instructions are documented here.\n');
} else {
  if (id === 'receipt-stale') execFileSync(process.execPath, ['scripts/check-links.mjs'], { cwd: runDir });
  writeFileSync(join(runDir, '_review.json'), JSON.stringify({ decision: id === 'receipt-current' ? 'reuse' : 'recheck', passed: true }) + '\n');
}
