import { spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";

export interface KillTreeOutcome {
  ok: boolean;
  detail?: string;
}

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
 *
 * The outcome is returned rather than thrown: this runs from timers and abort handlers, and a
 * silently failed kill is the one failure mode that keeps spending tokens after the harness believes
 * it stopped the work. Callers that can surface it should.
 */
export function killTree(child: ChildProcess): KillTreeOutcome {
  const pid = child.pid;
  if (pid === undefined) {
    child.kill();
    return { ok: true, detail: "no pid; signalled the child handle" };
  }
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status === null) {
      const detail = (result.error?.message ?? "").trim();
      return { ok: false, detail: `taskkill did not run${detail ? `: ${detail}` : ""}` };
    }
    if (result.status === 0) return { ok: true };
    // taskkill documents 128 as "process not found": the tree is already gone, which is the goal.
    if (result.status === 128) return { ok: true, detail: "already gone" };
    try {
      child.kill("SIGKILL");
    } catch {
      // already exited
    }
    const detail = (result.error?.message ?? result.stderr ?? "").trim();
    return {
      ok: false,
      detail: `taskkill exited ${result.status}${detail ? `: ${detail}` : " with no output"}`,
    };
  }
  try {
    process.kill(-pid, "SIGKILL");
    return { ok: true };
  } catch {
    // Not a group leader, or already gone. Fall back to the direct signal.
    try {
      child.kill("SIGKILL");
      return { ok: true, detail: "direct signal; the process group was unavailable" };
    } catch (error) {
      return { ok: false, detail: (error as Error).message };
    }
  }
}

/**
 * Spawn options that let `killTree` reach grandchildren. On POSIX the child must lead its own process
 * group; on Windows `detached` would allocate a new console for no benefit, since `taskkill /T`
 * traverses by parent pid.
 */
export function treeSpawnOptions(): { detached: boolean } {
  return process.platform === "win32" ? { detached: false } : { detached: true };
}
