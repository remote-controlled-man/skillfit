import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export type Fields = Record<string, unknown>;

export function object(value: unknown): Fields | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Fields;
}

export function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

// The archive gate hashes compact UTF-8 JSON with keys in code-point order.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const fields = object(value);
  if (fields)
    return `{${Object.keys(fields)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(fields[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function readJson(contents: string): Fields | undefined {
  try {
    return object(JSON.parse(contents));
  } catch {
    return undefined;
  }
}

export function safeRelative(path: string): boolean {
  return (
    !isAbsolute(path) &&
    !path.includes("\\") &&
    path.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  );
}

export class Archive {
  constructor(readonly root: string) {}

  // Reject symlinks on the entire relative path. Recorded absolute paths are
  // identity data only, never arguments to filesystem reads.
  path(relative: string): string {
    if (!safeRelative(relative)) throw new Error(`Unsafe archive path ${relative}`);
    let current = this.root;
    for (const part of relative.split("/")) {
      current = join(current, part);
      if (lstatSync(current).isSymbolicLink()) throw new Error(`Symlink at ${relative}`);
    }
    return current;
  }

  bytes(relative: string): Buffer {
    const file = this.path(relative);
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.size > 32 * 1024 * 1024)
      throw new Error(`Unreadable archive file ${relative}`);
    return readFileSync(file);
  }

  text(relative: string): string | undefined {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(this.bytes(relative));
    } catch {
      return undefined;
    }
  }

  json(relative: string): Fields | undefined {
    const contents = this.text(relative);
    return contents === undefined ? undefined : readJson(contents);
  }
}

export const GATE = "project/.scratch/ocr-gate";
export const EVENTS = `${GATE}/delegate-events`;

export interface FileEvidence {
  path: string;
  status: "added" | "modified" | "deleted";
  sha256: string | null;
}

export interface Worktree {
  base: string;
  files: FileEvidence[];
  required: boolean | null;
}

const processFiles = new Set([
  "_prompt.txt",
  "_output.md",
  "_result.json",
  "_transcript.jsonl",
  "_verifier.txt",
  "_executor-error.txt",
]);

function inspectable(path: string): boolean {
  return !path.startsWith(".scratch/ocr-gate/") && !processFiles.has(path);
}

export function snapshot(archive: Archive): Worktree {
  const project = archive.path("project");
  const gitDir = archive.path("project/.git");
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      [
        "--no-optional-locks",
        "--no-pager",
        `--git-dir=${gitDir}`,
        `--work-tree=${project}`,
        "-c",
        "core.fsmonitor=false",
        "-c",
        "protocol.allow=never",
        ...args,
      ],
      {
        cwd: project,
        env: {
          ...env,
          GIT_CONFIG_NOSYSTEM: "1",
          // Git for Windows handles /dev/null itself and can reject Node's device path.
          GIT_CONFIG_GLOBAL: "/dev/null",
          GIT_NO_REPLACE_OBJECTS: "1",
          GIT_NO_LAZY_FETCH: "1",
          GIT_TERMINAL_PROMPT: "0",
        },
        timeout: 5000,
        maxBuffer: 16 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      },
    );
  const base = git("rev-parse", "--verify", "HEAD").trim();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(base)) throw new Error("Invalid Git base");
  const entries = (output: string) =>
    output
      .split("\0")
      .filter(Boolean)
      .map((record) => {
        const tab = record.indexOf("\t");
        const [mode, typeOrId, idOrStage] = record.slice(0, tab).split(" ");
        const path = record.slice(tab + 1);
        if (
          tab < 0 ||
          !safeRelative(path) ||
          !/^100(644|755)$/.test(mode ?? "") ||
          (typeOrId !== "blob" && idOrStage !== "0")
        )
          throw new Error(`Unsupported Git entry ${path}`);
        return [path, { mode, id: typeOrId === "blob" ? idOrStage : typeOrId }] as const;
      });
  const head = new Map(entries(git("ls-tree", "-rz", base)));
  const index = new Map(entries(git("ls-files", "--stage", "-z")));
  const untracked = git("ls-files", "--others", "--exclude-standard", "-z")
    .split("\0")
    .filter(Boolean);
  const paths = [...new Set([...head.keys(), ...index.keys(), ...untracked])]
    .filter(inspectable)
    .sort();
  const files: FileEvidence[] = [];
  let required: boolean | null = false;
  for (const path of paths) {
    const original = head.get(path);
    let bytes: Buffer | undefined;
    let executable = false;
    try {
      bytes = archive.bytes(`project/${path}`);
      executable = (lstatSync(archive.path(`project/${path}`)).mode & 0o100) !== 0;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (!bytes && !original) continue;
    if (bytes && original && index.has(path) && executable === (original.mode === "100755")) {
      // Hash the literal file bytes without letting archived Git filters run.
      const blob = createHash(base.length === 64 ? "sha256" : "sha1")
        .update(`blob ${bytes.length}\0`)
        .update(bytes)
        .digest("hex");
      if (blob === original.id) continue;
    }
    const status = !bytes ? "deleted" : original ? "modified" : "added";
    files.push({ path, status, sha256: bytes ? sha256(bytes) : null });
    if (!/\.(md|rst|txt)$/i.test(path) && required !== true) {
      // The original gate uses AST/ordered JSON comparison for modified
      // Python and JSON. Without decisive changes, leave that case unknown.
      required = status === "modified" && /\.(py|json)$/i.test(path) ? null : true;
    }
  }
  return { base, files, required };
}
