import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getAgent } from "../agents/matrix.js";
import { BACKUP_SUFFIX } from "./constants.js";
import {
  LOCKFILE_NAME,
  MARKER_END,
  MARKER_START,
  hashFiles,
  readLockfile,
  removeManagedBlock,
  rulesTarget,
  skillsTargetDir,
  type LockEntry,
  type Lockfile,
  type Scope,
} from "./install.js";
import { executeTransaction, type FileWrite } from "./transaction.js";

export interface UninstallOptions {
  agent: string;
  skills?: readonly string[];
  rules?: boolean;
  project?: boolean;
  homeDir?: string;
  projectDir?: string;
  env?: NodeJS.ProcessEnv;
  dryRun?: boolean;
  yes?: boolean;
  confirm?: (question: string) => Promise<boolean>;
  log?: (line: string) => void;
}

interface UninstallItem {
  key: string;
  kind: LockEntry["kind"];
  path: string;
  action: "remove" | "update" | "skip" | "conflict";
  detail: string;
  nextContent?: string;
}

interface RecoveryMove {
  target: string;
  recovery: string;
}

export interface UninstallResult {
  status: "planned" | "completed" | "cancelled";
  items: UninstallItem[];
  recovery: RecoveryMove[];
}

function conflict(key: string, entry: LockEntry, pathValue: string, detail: string): UninstallItem {
  return { key, kind: entry.kind, path: pathValue, action: "conflict", detail };
}

async function textIfExists(pathValue: string): Promise<string | null> {
  try {
    return await fs.readFile(pathValue, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function pathExists(pathValue: string): Promise<boolean> {
  try {
    await fs.lstat(pathValue);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function managedSkillHash(root: string): Promise<string> {
  const files = new Map<string, Buffer>();
  const walk = async (dir: string, prefix: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name.endsWith(BACKUP_SUFFIX)) continue;
      const absolute = path.join(dir, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Managed Skill contains a symlink: ${absolute}`);
      if (entry.isDirectory()) await walk(absolute, relative);
      else if (entry.isFile()) files.set(relative, await fs.readFile(absolute));
      else throw new Error(`Managed Skill contains a non-regular entry: ${absolute}`);
    }
  };
  await walk(root, "");
  return hashFiles(files);
}

async function planSkill(
  key: string,
  entry: LockEntry | undefined,
  name: string,
  agent: ReturnType<typeof getAgent>,
  scope: Scope,
  homeDir: string,
  projectDir: string,
): Promise<UninstallItem> {
  const target = path.join(skillsTargetDir(agent, scope, homeDir, projectDir), name);
  if (!entry || entry.kind !== "skill" || entry.agent !== agent.id)
    return {
      key,
      kind: "skill",
      path: target,
      action: "conflict",
      detail: "No managed installation record exists for this Skill",
    };
  if (path.resolve(entry.path) !== path.resolve(target))
    return conflict(key, entry, target, "The lock target differs from the current matrix path");
  if (!(await pathExists(target)))
    return {
      key,
      kind: "skill",
      path: target,
      action: "skip",
      detail: "Target is already absent; remove only its lock entry",
    };
  const stat = await fs.lstat(target);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    return conflict(key, entry, target, "The managed Skill target is not a regular directory");
  const currentHash = await managedSkillHash(target);
  if (currentHash !== entry.sha256)
    return conflict(
      key,
      entry,
      target,
      "Local content or unexpected files differ from the managed installation",
    );
  return {
    key,
    kind: "skill",
    path: target,
    action: "remove",
    detail: "Move the unchanged managed Skill to a fresh hidden recovery directory",
  };
}

async function planRules(
  entries: [string, LockEntry][],
  agent: ReturnType<typeof getAgent>,
  scope: Scope,
  homeDir: string,
  projectDir: string,
  env: NodeJS.ProcessEnv,
): Promise<UninstallItem[]> {
  const targets = rulesTarget(agent, scope, homeDir, projectDir, env);
  const selected = entries.filter(
    ([, entry]) => entry.agent === agent.id && (entry.kind === "rules" || entry.kind === "bridge"),
  );
  if (selected.length === 0)
    return [
      {
        key: `${agent.id}:rules`,
        kind: "rules",
        path: targets.rulesFile,
        action: "conflict",
        detail: "No managed rules record exists for this Agent and scope",
      },
    ];
  const items: UninstallItem[] = [];
  for (const [key, entry] of selected) {
    const expected = entry.kind === "rules" ? targets.rulesFile : targets.bridgeFile;
    if (expected === null || path.resolve(entry.path) !== path.resolve(expected)) {
      items.push(
        conflict(key, entry, entry.path, "The lock target differs from the current matrix path"),
      );
      continue;
    }
    const current = await textIfExists(entry.path);
    if (current === null) {
      items.push({
        key,
        kind: entry.kind,
        path: entry.path,
        action: "skip",
        detail: "Target is already absent; remove only its lock entry",
      });
      continue;
    }
    let next: string;
    try {
      next = removeManagedBlock(current);
    } catch (error) {
      items.push(conflict(key, entry, entry.path, (error as Error).message));
      continue;
    }
    const start = current.indexOf(MARKER_START);
    const block = current.slice(start, current.indexOf(MARKER_END) + MARKER_END.length);
    const hash = createHash("sha256").update(block, "utf8").digest("hex");
    if (hash !== entry.sha256) {
      items.push(
        conflict(key, entry, entry.path, "The managed block differs from its lock fingerprint"),
      );
      continue;
    }
    items.push({
      key,
      kind: entry.kind,
      path: entry.path,
      action: next.trim().length === 0 ? "remove" : "update",
      detail:
        next.trim().length === 0
          ? "Move the managed-only rules file to a fresh hidden recovery file"
          : "Remove only the matching managed block and preserve all other content",
      ...(next.trim().length === 0 ? {} : { nextContent: next }),
    });
  }
  return items;
}

function printPlan(items: readonly UninstallItem[], log: (line: string) => void): void {
  for (const item of items) log(`${item.action}: ${item.kind} ${item.path} — ${item.detail}`);
}

export async function runUninstall(options: UninstallOptions): Promise<UninstallResult> {
  const agent = getAgent(options.agent);
  const names = [...new Set(options.skills ?? [])];
  if (names.length === 0 && !options.rules)
    throw new Error("Select at least one --skill or --rules for managed uninstall.");
  if (names.some((name) => name.trim().length === 0))
    throw new Error("Managed Skill names must be non-empty.");
  const homeDir = options.homeDir ?? os.homedir();
  const projectDir = options.projectDir ?? process.cwd();
  const env = options.env ?? process.env;
  const scope: Scope = options.project ? "project" : "user";
  const scopeDir = options.project ? projectDir : homeDir;
  const lockPath = path.join(scopeDir, LOCKFILE_NAME);
  const lock = await readLockfile(lockPath);
  const items: UninstallItem[] = [];
  for (const name of names) {
    const key = `${agent.id}:skill:${name}`;
    items.push(await planSkill(key, lock.entries[key], name, agent, scope, homeDir, projectDir));
  }
  if (options.rules)
    items.push(
      ...(await planRules(Object.entries(lock.entries), agent, scope, homeDir, projectDir, env)),
    );
  printPlan(items, options.log ?? (() => {}));
  if (items.some((item) => item.action === "conflict")) {
    if (options.dryRun) return { status: "planned", items, recovery: [] };
    throw new Error("Managed uninstall has conflicts; nothing was changed.");
  }
  if (options.dryRun) return { status: "planned", items, recovery: [] };
  if (!options.yes) {
    const ok = await (options.confirm ?? (async () => false))(
      `Apply managed removal of ${items.length} item(s), including the lockfile? [y/N] `,
    );
    if (!ok) return { status: "cancelled", items, recovery: [] };
  }

  const nextLock: Lockfile = { ...lock, entries: { ...lock.entries } };
  for (const item of items) delete nextLock.entries[item.key];
  const lockContent = `${JSON.stringify(nextLock, null, 2)}\n`;
  const files: FileWrite[] = items
    .filter((item) => item.action === "update")
    .map((item) => ({
      path: item.path,
      content: item.nextContent!,
      backup: "first",
    }));
  files.push({ path: lockPath, content: lockContent, backup: "previous" });
  const moved: RecoveryMove[] = [];
  try {
    for (const item of items.filter((item) => item.action === "remove")) {
      const recovery = path.join(
        path.dirname(item.path),
        `.${path.basename(item.path)}.${process.pid}.${randomUUID()}.skillfit-removed`,
      );
      if (await pathExists(recovery)) throw new Error(`Recovery path already exists: ${recovery}`);
      await fs.rename(item.path, recovery);
      moved.push({ target: item.path, recovery });
    }
    await executeTransaction(files, async () => {
      for (const item of items) {
        if (item.action === "remove" && (await pathExists(item.path)))
          throw new Error(`Managed target still exists after recovery move: ${item.path}`);
        if (item.action === "update" && (await textIfExists(item.path)) !== item.nextContent)
          throw new Error(`Managed rules content differs after removal: ${item.path}`);
      }
      if ((await textIfExists(lockPath)) !== lockContent)
        throw new Error(`Lockfile content differs after managed uninstall: ${lockPath}`);
    });
  } catch (error) {
    const lockCommitted = (await textIfExists(lockPath)) === lockContent;
    if (lockCommitted)
      throw new Error(
        `Managed uninstall was applied, but the writer reported an error: ${(error as Error).message}; recovery copies were retained at ${moved.map((item) => item.recovery).join(", ") || "none"}.`,
        { cause: error },
      );
    const failures: string[] = [];
    for (const move of [...moved].reverse()) {
      try {
        if (await pathExists(move.target))
          throw new Error("target already exists; refusing to overwrite it");
        await fs.rename(move.recovery, move.target);
      } catch (restoreError) {
        failures.push(
          `${move.target}: ${(restoreError as Error).message}; recovery retained at ${move.recovery}`,
        );
      }
    }
    if (failures.length > 0)
      throw new Error(
        `Managed uninstall failed (${(error as Error).message}); recovery restoration failed for ${failures.join("; ")}`,
        { cause: error },
      );
    throw error;
  }
  const log = options.log ?? (() => {});
  for (const move of moved) log(`recovery: ${move.target} -> ${move.recovery}`);
  log(
    "Managed uninstall complete; recovery copies were retained. No unrelated resources were changed.",
  );
  return { status: "completed", items, recovery: moved };
}
