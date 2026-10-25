import { spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

/**
 * Kill a child and everything it started.
 *
 * `child.kill()` signals only the process that was spawned. With `shell: true` that process is the
 * shell, so the real work — an agent CLI burning tokens, a test runner — survives the timeout the
 * harness imposed on it. Verified on Windows: the shell died and the grandchild kept running.
 *
 * POSIX kills the process group, which requires the child to have been spawned with the options from
 * `treeSpawnOptions()`. Windows has no equivalent signal, so it uses `taskkill /T`, which walks the
 * tree by parent pid and needs no special spawn options.
 */
export function killTree(child: ChildProcess): void {
  const pid = child.pid;
  if (pid === undefined) {
    child.kill();
    return;
  }
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Not a group leader, or already gone. Fall back to the direct signal.
    try {
      child.kill('SIGKILL');
    } catch {
      // already exited
    }
  }
}

/**
 * Spawn options that let `killTree` reach grandchildren. On POSIX the child must lead its own process
 * group; on Windows `detached` would allocate a new console for no benefit, since `taskkill /T`
 * traverses by parent pid.
 */
export function treeSpawnOptions(): { detached: boolean } {
  return process.platform === 'win32' ? { detached: false } : { detached: true };
}
