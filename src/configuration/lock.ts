import { promises as fs } from "node:fs";

export const LOCKFILE_NAME = "skillfit.lock.json";
export type Scope = "user" | "project";
export type ItemKind = "rules" | "bridge" | "skill" | "mcp";

export interface LockEntry {
  agent: string;
  kind: ItemKind;
  path: string;
  sha256: string;
  profile: string;
  profileVersion: string;
  installedAt: string;
}

export interface Lockfile {
  version: 1;
  entries: Record<string, LockEntry>;
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await fs.readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function readLockfile(lockPath: string): Promise<Lockfile> {
  const raw = await readIfExists(lockPath);
  if (raw === null) return { version: 1, entries: {} };
  let parsed: Lockfile;
  try {
    parsed = JSON.parse(raw) as Lockfile;
  } catch {
    throw new Error(`Lockfile at ${lockPath} is not valid JSON; fix or delete it.`);
  }
  if (typeof parsed !== "object" || parsed === null || typeof parsed.entries !== "object") {
    throw new Error(`Lockfile at ${lockPath} has an unexpected shape; fix or delete it.`);
  }
  return { version: 1, entries: parsed.entries ?? {} };
}
