import { randomUUID } from 'node:crypto';
import { constants, existsSync, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { BACKUP_SUFFIX } from "./constants.js";

export interface FileWrite {
  path: string;
  content: string | Buffer;
  backup: 'none' | 'first' | 'previous';
}

export interface WrittenFile {
  target: string;
  backedUp: string | null;
}

interface StagedWrite {
  target: string;
  tmp: string;
  restore: string | null;
  backedUp: string | null;
}

/** Stage every write before replacing any target; rollback is best effort, not crash atomicity. */
export async function executeTransaction(files: readonly FileWrite[], validate: () => Promise<void>): Promise<WrittenFile[]> {
  const staged: StagedWrite[] = [];
  try {
    for (const file of files) {
      await fs.mkdir(path.dirname(file.path), { recursive: true });
      const suffix = `${process.pid}.${randomUUID()}`;
      const tmp = `${file.path}.${suffix}.skillfit-staged`;
      const restore = existsSync(file.path) ? `${file.path}.${suffix}.skillfit-restore` : null;
      const entry: StagedWrite = { target: file.path, tmp, restore, backedUp: null };
      staged.push(entry);
      if (restore) await fs.copyFile(file.path, restore);
      if (file.backup !== 'none') {
        // Metadata may track the previous version; user content keeps the first original.
        if (file.backup === 'previous') {
          await fs.copyFile(file.path, file.path + BACKUP_SUFFIX);
          entry.backedUp = file.path + BACKUP_SUFFIX;
        } else {
          entry.backedUp = await backupOnce(file.path);
        }
      }
      await fs.writeFile(tmp, file.content);
    }
  } catch (error) {
    const cleanupFailures = await cleanupStaged(staged);
    throw transactionFailure(error, [], cleanupFailures);
  }

  const applied: StagedWrite[] = [];
  try {
    for (const entry of staged) {
      await fs.rename(entry.tmp, entry.target);
      applied.push(entry);
    }
    await validate();
  } catch (error) {
    const rollbackFailures: string[] = [];
    const preserveRestores = new Set<string>();
    for (const entry of applied.reverse()) {
      try {
        if (entry.restore) await fs.copyFile(entry.restore, entry.target);
        else await fs.rm(entry.target, { force: true });
      } catch (rollbackError) {
        const recovery = entry.restore ? `recovery copy retained at ${entry.restore}` : 'new target remains; no previous file to restore';
        rollbackFailures.push(`${entry.target}: ${(rollbackError as Error).message} (${recovery})`);
        preserveRestores.add(entry.target);
      }
    }
    const cleanupFailures = await cleanupStaged(staged, preserveRestores);
    throw transactionFailure(error, rollbackFailures, cleanupFailures);
  }

  const cleanupFailures = await cleanupStaged(staged);
  if (cleanupFailures.length > 0) {
    throw new Error(`Install files were validated, but cleanup failed for ${cleanupFailures.join('; ')}`);
  }
  return staged.map(({ target, backedUp }) => ({ target, backedUp }));
}

function transactionFailure(error: unknown, rollbackFailures: string[], cleanupFailures: string[]): unknown {
  if (rollbackFailures.length === 0 && cleanupFailures.length === 0) return error;
  const details = [`Install failed (${error instanceof Error ? error.message : String(error)})`];
  if (rollbackFailures.length > 0) {
    details.push(`rollback failed for ${rollbackFailures.join('; ')}`);
  }
  if (cleanupFailures.length > 0) details.push(`cleanup failed for ${cleanupFailures.join('; ')}`);
  return new Error(details.join('; '), { cause: error });
}

async function cleanupStaged(staged: StagedWrite[], preserveRestores: Set<string> = new Set()): Promise<string[]> {
  const failures: string[] = [];
  for (const entry of staged) {
    const files = [entry.tmp];
    if (entry.restore && !preserveRestores.has(entry.target)) files.push(entry.restore);
    for (const file of files) {
      try {
        await fs.rm(file, { force: true });
      } catch (error) {
        failures.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return failures;
}

/**
 * Back up a file at most once. `.skillfit-bak` is a single slot, and the copy worth keeping is the
 * user's pre-skillfit original: overwriting it on a later update would destroy the only copy of the
 * content the suffix exists to protect. Returns the backup path when one was created, else null.
 */
async function backupOnce(target: string): Promise<string | null> {
  const backup = target + BACKUP_SUFFIX;
  try {
    await fs.copyFile(target, backup, constants.COPYFILE_EXCL);
    return backup;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return null;
    throw error;
  }
}

