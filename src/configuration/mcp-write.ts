import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getAgent } from "../agents/matrix.js";
import { resolveAgentPath } from "../agents/environment.js";
import { loadMcpProbeSpec, parseMcpProbeSpec, type McpProbeSpec } from "../agents/mcp-probe.js";
import { LOCKFILE_NAME, readLockfile, type LockEntry, type Lockfile, type Scope } from "./lock.js";
import { executeTransaction, type FileWrite } from "./transaction.js";

export interface McpApplyOptions {
  agent: string;
  server: string;
  from?: string;
  portable?: boolean;
  remove?: boolean;
  project?: boolean;
  homeDir?: string;
  projectDir?: string;
  env?: NodeJS.ProcessEnv;
  dryRun?: boolean;
  yes?: boolean;
  confirm?: (question: string) => Promise<boolean>;
  log?: (line: string) => void;
  now?: () => Date;
}

export interface McpApplyPlan {
  agent: string;
  server: string;
  scope: Scope;
  path: string;
  action: "create" | "update" | "remove" | "skip" | "conflict";
  detail: string;
  lockKey: string;
  entryHash: string;
  nextContent?: string;
  lockOnly: boolean;
}

export interface McpApplyResult {
  status: "planned" | "applied" | "unchanged" | "cancelled";
  plan: McpApplyPlan;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
}

function entryHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stable(value)), "utf8")
    .digest("hex");
}

function nativeEntry(spec: McpProbeSpec): Record<string, unknown> {
  if (spec.transport === "http")
    return {
      type: "http",
      url: spec.url,
      headers: spec.headers ?? {},
    };
  return {
    type: "stdio",
    command: spec.command,
    args: spec.args,
    env: spec.env ?? {},
    cwd: spec.cwd,
  };
}

export function portableMcpSpec(spec: McpProbeSpec, source: Record<string, unknown>): McpProbeSpec {
  if (source["timeoutMs"] !== undefined)
    throw new Error(
      `MCP server "${spec.name}" has an explicit timeout; portable export is unsupported`,
    );
  if (spec.transport === "stdio") {
    if (
      spec.args.length > 0 ||
      Object.keys(spec.env ?? {}).length > 0 ||
      source["cwd"] !== undefined
    )
      throw new Error(
        `MCP server "${spec.name}" has args, env or cwd; portable export requires these to be absent or empty`,
      );
    return {
      schemaVersion: 1,
      name: spec.name,
      transport: "stdio",
      command: spec.command,
      args: [],
      env: {},
    };
  }
  const url = new URL(spec.url);
  if (
    Object.keys(spec.headers ?? {}).length > 0 ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      `MCP server "${spec.name}" has headers or URL credentials/query/fragment; portable export is refused`,
    );
  return {
    schemaVersion: 1,
    name: spec.name,
    transport: "http",
    url: spec.url,
    headers: {},
  };
}

export async function loadPortableMcpSpec(file: string): Promise<McpProbeSpec> {
  const source = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
  return portableMcpSpec(parseMcpProbeSpec(source, path.dirname(file)), source);
}

async function textIfExists(pathValue: string): Promise<string | null> {
  try {
    return await fs.readFile(pathValue, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function printPlan(plan: McpApplyPlan, log: (line: string) => void): void {
  log(`${plan.action}: mcp "${plan.server}" ${plan.path} (${plan.scope}) — ${plan.detail}`);
}

export async function planMcpApply(options: McpApplyOptions): Promise<McpApplyPlan> {
  if (!options.agent || !options.server.trim())
    throw new Error("MCP apply requires a non-empty --agent and --server.");
  if (options.remove && options.from !== undefined)
    throw new Error("MCP apply --remove cannot be combined with --from.");
  if (!options.remove && options.from === undefined)
    throw new Error("MCP apply needs --from <probe.json> or --remove.");
  const agent = getAgent(options.agent);
  const scope: Scope = options.project ? "project" : "user";
  const homeDir = options.homeDir ?? os.homedir();
  const projectDir = options.projectDir ?? process.cwd();
  const env = options.env ?? process.env;
  if (agent.mcp.format !== "json-mcpServers")
    throw new Error(
      `Native ${agent.displayName} MCP format "${agent.mcp.format}" is not supported by mcp apply; no configuration was written and no server was contacted.`,
    );
  const context = { homeDir, cwd: projectDir, env };
  const candidates = [
    ...new Set(
      (options.project ? agent.mcp.projectFiles : agent.mcp.userFiles).map((file) =>
        resolveAgentPath(file, context),
      ),
    ),
  ];
  const existingPaths = [];
  for (const candidate of candidates)
    if ((await textIfExists(candidate)) !== null) existingPaths.push(candidate);
  if (existingPaths.length > 1)
    throw new Error(
      `Multiple ${scope} MCP configuration files exist for ${agent.displayName}; refusing to choose implicitly: ${existingPaths.join(", ")}`,
    );
  const target =
    existingPaths[0] ?? (candidates[0] ? resolveAgentPath(candidates[0], context) : null);
  if (!target) throw new Error(`${agent.displayName} has no ${scope} MCP configuration path.`);
  try {
    if ((await fs.lstat(target)).isSymbolicLink())
      throw new Error(`Refusing to write through a symlinked MCP configuration: ${target}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const spec =
    options.from === undefined
      ? null
      : options.portable
        ? await loadPortableMcpSpec(options.from)
        : loadMcpProbeSpec(options.from);
  if (spec && spec.name !== options.server)
    throw new Error(`Probe name "${spec.name}" does not match --server "${options.server}".`);

  let document: Record<string, unknown> = {};
  const currentText = await textIfExists(target);
  if (currentText !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(currentText);
    } catch {
      throw new Error(
        `Invalid JSON MCP configuration at ${target}; no configuration was written and no server was contacted.`,
      );
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      throw new Error(`MCP configuration at ${target} must contain a JSON object.`);
    document = parsed as Record<string, unknown>;
  }
  const currentServers = document["mcpServers"] ?? {};
  if (
    typeof currentServers !== "object" ||
    currentServers === null ||
    Array.isArray(currentServers)
  )
    throw new Error(`MCP configuration at ${target} requires an mcpServers object.`);
  const servers = currentServers as Record<string, unknown>;
  const existing = Object.hasOwn(servers, options.server) ? servers[options.server] : undefined;
  const lockKey = `${agent.id}:mcp:${options.server}`;
  const desired = options.remove ? null : nativeEntry(spec!);
  const desiredHash = entryHash(desired);
  const currentHash = existing === undefined ? null : entryHash(existing);
  const nextDocument = { ...document, mcpServers: { ...servers } };
  if (options.remove) delete nextDocument.mcpServers[options.server];
  else nextDocument.mcpServers[options.server] = desired;
  const nextContent = `${JSON.stringify(nextDocument, null, 2)}\n`;
  const lock = await readLockfile(
    path.join(scope === "user" ? homeDir : projectDir, LOCKFILE_NAME),
  );
  const lockEntry = lock.entries[lockKey];
  if (
    lockEntry !== undefined &&
    (lockEntry.agent !== agent.id ||
      lockEntry.kind !== "mcp" ||
      path.resolve(lockEntry.path) !== path.resolve(target))
  )
    return {
      agent: agent.id,
      server: options.server,
      scope,
      path: target,
      action: "conflict",
      detail:
        "The lock record has a different agent, kind or target; no configuration or lock change is allowed",
      lockKey,
      entryHash: desiredHash,
      lockOnly: false,
    };
  if (options.remove && existing === undefined)
    return {
      agent: agent.id,
      server: options.server,
      scope,
      path: target,
      action: "skip",
      detail: lockEntry
        ? "Entry is already absent; remove only its lock record"
        : "Entry is already absent; no change is needed",
      lockKey,
      entryHash: desiredHash,
      lockOnly: lockEntry !== undefined,
    };
  if (existing === undefined)
    return {
      agent: agent.id,
      server: options.server,
      scope,
      path: target,
      action: options.remove ? "skip" : "create",
      detail: options.remove
        ? "Entry is already absent"
        : "Create only the selected JSON MCP entry",
      lockKey,
      entryHash: desiredHash,
      nextContent,
      lockOnly: false,
    };
  if (currentHash === desiredHash && !options.remove)
    return {
      agent: agent.id,
      server: options.server,
      scope,
      path: target,
      action: "skip",
      detail: "The selected MCP entry already matches; no configuration change",
      lockKey,
      entryHash: desiredHash,
      lockOnly: false,
    };
  if (
    lockEntry === undefined ||
    lockEntry.kind !== "mcp" ||
    path.resolve(lockEntry.path) !== path.resolve(target) ||
    currentHash !== lockEntry.sha256
  )
    return {
      agent: agent.id,
      server: options.server,
      scope,
      path: target,
      action: "conflict",
      detail:
        "The existing MCP entry is unmanaged, locally changed or has a different target; no overwrite or removal is allowed",
      lockKey,
      entryHash: desiredHash,
      lockOnly: false,
    };
  return {
    agent: agent.id,
    server: options.server,
    scope,
    path: target,
    action: options.remove ? "remove" : "update",
    detail: options.remove
      ? "Remove only the matching managed MCP entry"
      : "Update the matching managed MCP entry",
    lockKey,
    entryHash: desiredHash,
    nextContent,
    lockOnly: false,
  };
}

export async function runMcpApply(options: McpApplyOptions): Promise<McpApplyResult> {
  const plan = await planMcpApply(options);
  const log = options.log ?? (() => {});
  printPlan(plan, log);
  if (plan.action === "conflict") {
    if (options.dryRun) return { status: "planned", plan };
    throw new Error(
      "MCP apply has a conflict; no configuration was changed and no server was contacted.",
    );
  }
  if (options.dryRun) return { status: "planned", plan };
  if (plan.action === "skip" && !plan.lockOnly) return { status: "unchanged", plan };
  if (!options.yes) {
    const ok = await (options.confirm ?? (async () => false))(
      `Apply MCP ${plan.action} for "${plan.server}" (${plan.scope})? [y/N] `,
    );
    if (!ok) return { status: "cancelled", plan };
  }
  const homeDir = options.homeDir ?? os.homedir();
  const projectDir = options.projectDir ?? process.cwd();
  const scopeDir = plan.scope === "user" ? homeDir : projectDir;
  const lockPath = path.join(scopeDir, LOCKFILE_NAME);
  const lock = await readLockfile(lockPath);
  const nextLock: Lockfile = { ...lock, entries: { ...lock.entries } };
  if (plan.action === "remove" || plan.lockOnly) {
    delete nextLock.entries[plan.lockKey];
  } else {
    const previous = nextLock.entries[plan.lockKey];
    nextLock.entries[plan.lockKey] = {
      agent: plan.agent,
      kind: "mcp",
      path: plan.path,
      sha256: plan.entryHash,
      profile: "mcp-apply",
      profileVersion: "1",
      installedAt: (options.now?.() ?? new Date()).toISOString(),
    } satisfies LockEntry;
    if (previous && previous.kind !== "mcp")
      throw new Error(`Existing lock entry ${plan.lockKey} is not an MCP entry.`);
  }
  const lockContent = `${JSON.stringify(nextLock, null, 2)}\n`;
  const files: FileWrite[] = [];
  if (!plan.lockOnly)
    files.push({
      path: plan.path,
      content: plan.nextContent!,
      backup: (await textIfExists(plan.path)) === null ? "none" : "first",
    });
  files.push({
    path: lockPath,
    content: lockContent,
    backup: (await textIfExists(lockPath)) === null ? "none" : "previous",
  });
  await executeTransaction(files, async () => {
    if (!plan.lockOnly && (await textIfExists(plan.path)) !== plan.nextContent)
      throw new Error(`MCP target content differs after apply: ${plan.path}`);
    if ((await textIfExists(lockPath)) !== lockContent)
      throw new Error(`Lockfile content differs after MCP apply: ${lockPath}`);
  });
  log(
    `MCP ${plan.action} applied for "${plan.server}"; configuration and lockfile verified. No server was started or contacted.`,
  );
  return { status: "applied", plan };
}
