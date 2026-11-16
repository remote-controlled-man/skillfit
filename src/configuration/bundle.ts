import { RUNTIME_ROOT } from "../shared/package-root.js";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { getAgent, skillUserDirSpecs } from "../agents/matrix.js";
import { selectAgentMcpProbe } from "../agents/mcp-probe.js";
import { collectReceipts } from "../usage/receipts.js";
import { parseFrontmatter } from "../resources/frontmatter.js";
import { isImplicitInvocationDisabled } from "../resources/invocation.js";
import { BACKUP_SUFFIX, loadProfile, MARKER_END, MARKER_START } from "./install.js";
import { portableMcpSpec } from "./mcp-write.js";
import { readUpstreamLock, type UpstreamSkill } from "./upstream.js";

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export interface BundleExportOptions {
  outputDir: string;
  agent?: string;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
  skillNames?: string[];
  allowedSkillLinkRoots?: string[];
  mcpServerNames?: string[];
  /** Default selection uses skills seen in at least two distinct source-Agent sessions. */
  minSessions?: number;
  dryRun?: boolean;
  yes?: boolean;
  log?: (line: string) => void;
  confirm?: (question: string) => Promise<boolean>;
  loadUsage?: () => Promise<{ name: string; sessionCount: number }[]>;
  /** Reviewed, commit-pinned GitHub sources; unmatched Skills remain local copies. */
  upstreamLockPath?: string;
}

function expandHome(spec: string, homeDir: string): string {
  return spec.startsWith("~/") ? path.join(homeDir, spec.slice(2)) : path.resolve(spec);
}

async function userRulesFile(
  agentId: string,
  homeDir: string,
  env: NodeJS.ProcessEnv,
): Promise<string> {
  const agent = getAgent(agentId);
  const rules = agent.rules;
  const override = rules.userHomeOverride;
  const envHome = override === undefined ? undefined : env[override.env];
  let candidates = rules.userFiles.map((spec) => expandHome(spec, homeDir));
  if (override !== undefined && envHome)
    candidates = [path.resolve(envHome, override.relativePath)];
  if (candidates.length === 0) throw new Error(`${agent.displayName} has no user-level rules path`);
  const existing: string[] = [];
  for (const candidate of candidates)
    if ((await readOptional(candidate)) !== null) existing.push(candidate);
  if (existing.length > 1)
    throw new Error(
      `Multiple user-level rules files exist for ${agent.displayName}; refusing to choose implicitly: ${existing.join(", ")}`,
    );
  return existing[0] ?? candidates[0]!;
}

function userSkillDirs(agentId: string, homeDir: string, env: NodeJS.ProcessEnv): string[] {
  const agent = getAgent(agentId);
  const specs = skillUserDirSpecs(agent, env);
  if (specs.length === 0) throw new Error(`${agent.displayName} has no user-level skills path`);
  return specs.map((spec) => expandHome(spec, homeDir));
}

async function readOptional(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function stripManagedBlock(content: string): string {
  const start = content.indexOf(MARKER_START);
  const end = content.indexOf(MARKER_END);
  if (start === -1 && end === -1) return content.trimEnd();
  if (
    start === -1 ||
    end < start ||
    content.indexOf(MARKER_START, start + 1) !== -1 ||
    content.indexOf(MARKER_END, end + 1) !== -1
  ) {
    throw new Error("Source global AGENTS.md has malformed skillfit markers");
  }
  return `${content.slice(0, start)}${content.slice(end + MARKER_END.length)}`.trimEnd();
}

function renderRules(source: string | null, selected: string[], explicitOnly: string[]): string {
  const base = stripManagedBlock(source ?? "# Global Codex guidance");
  const implicit = selected.filter((name) => !explicitOnly.includes(name));
  const lines = [
    base,
    "",
    "## Skill routing",
    "",
    "- Match the task to installed Skills using their descriptions. Read the full SKILL.md only for relevant Skills.",
    "- If the user names a Skill, use it. For implicit use, choose the smallest relevant set and avoid overlapping workflows. Respect each Skill's invocation metadata.",
    `- Available for implicit routing in this portable profile: ${implicit.length > 0 ? implicit.map((name) => `\`${name}\``).join(", ") : "none"}.`,
  ];
  if (explicitOnly.length > 0)
    lines.push(`- User-invoked only: ${explicitOnly.map((name) => `\`${name}\``).join(", ")}.`);
  if (selected.includes("vibe-coding")) {
    lines.push(
      "- For ordinary coding changes, use `vibe-coding` as the workflow router and load only the specialist Skill the task needs.",
    );
  }
  if (selected.includes("autonomous-iteration")) {
    lines.push(
      "- Use `autonomous-iteration` for substantial work spanning multiple implementation steps; it uses `vibe-coding` for each coding slice when available.",
    );
  }
  if (selected.includes("api-and-interface-design") && selected.includes("codebase-design")) {
    lines.push(
      "- Use `api-and-interface-design` for public contracts and `codebase-design` for internal module boundaries.",
    );
  }
  if (selected.includes("diagnosing-bugs") && selected.includes("tdd")) {
    lines.push(
      "- Use `diagnosing-bugs` for uncertain failure causes and `tdd` for explicit test-first work or difficult test seams.",
    );
  }
  return `${lines.join("\n")}\n`;
}

function isInstallerArtifact(file: string): boolean {
  return [BACKUP_SUFFIX, ".skillfit-staged", ".skillfit-restore"].some((suffix) =>
    file.endsWith(suffix),
  );
}

async function walkFiles(dir: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink())
      throw new Error(`Symlink in skill cannot be exported safely: ${path.join(dir, entry.name)}`);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await walkFiles(path.join(dir, entry.name), rel)));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

async function sha256(file: string): Promise<string> {
  return createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");
}

function pathInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

async function approvedSkillLinkRoots(inputs: string[], homeDir: string): Promise<string[]> {
  const roots = new Set<string>();
  if (inputs.length === 0) return [];
  const canonicalHome = await fs.realpath(path.resolve(homeDir));
  for (const input of inputs) {
    const root = await fs.realpath(path.resolve(input));
    if (!(await fs.stat(root)).isDirectory())
      throw new Error(`--allow-symlink-root is not a directory: ${root}`);
    if (root === path.parse(root).root || root === canonicalHome)
      throw new Error(
        "--allow-symlink-root must name a specific Skill source directory, not a home or filesystem root",
      );
    roots.add(root);
  }
  return [...roots];
}

function assertApprovedLinkTarget(target: string, roots: string[]): void {
  if (!roots.some((root) => pathInside(root, target)))
    throw new Error(`Skill symlink target is outside --allow-symlink-root: ${target}`);
}

async function locateSkill(
  dirs: string[],
  name: string,
  allowedRoots: string[],
): Promise<string | null> {
  for (const dir of dirs) {
    const src = path.join(dir, name);
    let stat;
    try {
      stat = await fs.lstat(src);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (stat.isSymbolicLink() && allowedRoots.length === 0)
      throw new Error(`Symlinked skill cannot be exported safely: ${src}`);
    const target = await fs.realpath(src);
    if (stat.isSymbolicLink()) assertApprovedLinkTarget(target, allowedRoots);
    if (!(await fs.stat(target)).isDirectory())
      throw new Error(`Skill source is not a directory: ${target}`);
    return target;
  }
  return null;
}

async function walkSkillFiles(root: string, allowedRoots: string[]): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const visit = async (dir: string, prefix: string, ancestors: ReadonlySet<string>) => {
    const realDir = await fs.realpath(dir);
    if (!pathInside(root, realDir)) throw new Error(`Skill directory escapes its root: ${realDir}`);
    if (ancestors.has(realDir)) throw new Error(`Skill symlink cycle detected at ${realDir}`);
    const nextAncestors = new Set(ancestors).add(realDir);
    for (const entry of await fs.readdir(realDir, { withFileTypes: true })) {
      const absolute = path.join(realDir, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) {
        if (allowedRoots.length === 0)
          throw new Error(`Symlink in skill cannot be exported safely: ${absolute}`);
        const target = await fs.realpath(absolute);
        if (!pathInside(root, target))
          throw new Error(`Skill symlink escapes the selected Skill: ${target}`);
        assertApprovedLinkTarget(target, allowedRoots);
        const stat = await fs.stat(target);
        if (stat.isDirectory()) await visit(target, relative, nextAncestors);
        else if (stat.isFile()) files.set(relative, target);
        else throw new Error(`Unsupported file in Skill: ${target}`);
      } else if (entry.isDirectory()) {
        await visit(absolute, relative, nextAncestors);
      } else if (entry.isFile()) {
        const target = await fs.realpath(absolute);
        if (!pathInside(root, target)) throw new Error(`Skill file escapes its root: ${target}`);
        files.set(relative, target);
      } else {
        throw new Error(`Unsupported file in Skill: ${absolute}`);
      }
    }
  };
  await visit(root, "", new Set());
  return new Map([...files].sort(([a], [b]) => a.localeCompare(b)));
}

async function verifyUpstreamExport(
  dir: string,
  manifest: object,
  lock: object,
  rules: string,
  sourceFiles: Map<string, Map<string, string>>,
): Promise<void> {
  const actualManifest = JSON.parse(
    await fs.readFile(path.join(dir, "profile.json"), "utf8"),
  ) as object;
  const actualLock = await readUpstreamLock(path.join(dir, "upstream.lock.json"));
  if (
    JSON.stringify(actualManifest) !== JSON.stringify(manifest) ||
    JSON.stringify(actualLock) !== JSON.stringify(lock)
  ) {
    throw new Error("Portable export verification failed: manifest or source lock differs");
  }
  if ((await fs.readFile(path.join(dir, "rules", "global.md"), "utf8")) !== rules) {
    throw new Error("Portable export verification failed: global rules differ");
  }
  if (
    !(await fs.readFile(path.join(dir, "setup.mjs"), "utf8")).includes("prepareUpstreamProfile")
  ) {
    throw new Error("Portable export verification failed: setup script is missing");
  }
  for (const [name, files] of sourceFiles) {
    for (const [rel, source] of files) {
      if ((await sha256(path.join(dir, "skills", name, rel))) !== (await sha256(source))) {
        throw new Error(`Portable export verification failed for ${name}/${rel}`);
      }
    }
  }
}

async function defaultUsage(
  agent: string,
  homeDir: string,
  env: NodeJS.ProcessEnv,
): Promise<{ name: string; sessionCount: number }[]> {
  const receipt = (await collectReceipts({ agent, homeDir, env }))[0];
  const installed = new Set(receipt?.installed ?? []);
  return (
    receipt?.skills
      .filter(({ name }) => installed.has(name))
      .map(({ name, sessionCount }) => ({ name, sessionCount })) ?? []
  );
}

/** Create a self-contained profile from user-level Skills and active global guidance. */
export async function runBundleExport(opts: BundleExportOptions): Promise<void> {
  const log = opts.log ?? (() => {});
  const sourceAgent = getAgent(opts.agent ?? "codex");
  const homeDir = opts.homeDir ?? os.homedir();
  const env = opts.env ?? (opts.homeDir === undefined ? process.env : {});
  const outputDir = path.resolve(opts.outputDir);
  const profileName = path.basename(outputDir);
  if (!NAME_PATTERN.test(profileName)) {
    throw new Error("Bundle directory name must use lowercase letters, digits and dashes");
  }
  const skillDirs = userSkillDirs(sourceAgent.id, homeDir, env);
  const linkRoots = await approvedSkillLinkRoots(opts.allowedSkillLinkRoots ?? [], homeDir);
  const upstreamLock = opts.upstreamLockPath
    ? await readUpstreamLock(path.resolve(opts.upstreamLockPath))
    : null;
  const usage =
    opts.skillNames === undefined && !upstreamLock
      ? await (opts.loadUsage ?? (() => defaultUsage(sourceAgent.id, homeDir, env)))()
      : [];
  const minSessions = opts.minSessions ?? 2;
  if (!Number.isInteger(minSessions) || minSessions < 1)
    throw new Error("--min-sessions must be a positive integer");
  const candidates = [
    ...new Set(
      upstreamLock
        ? [
            ...upstreamLock.skills.map((skill) => skill.name),
            ...(upstreamLock.localSkills ?? []),
            ...(opts.skillNames ?? []),
          ]
        : (opts.skillNames ??
            usage.filter((item) => item.sessionCount >= minSessions).map((item) => item.name)),
    ),
  ].sort();
  const names: string[] = [];
  const explicitOnly: string[] = [];
  const skipped: string[] = [];
  const sourceFiles = new Map<string, Map<string, string>>();
  const upstreamByName = new Map((upstreamLock?.skills ?? []).map((skill) => [skill.name, skill]));
  const selectedUpstream: UpstreamSkill[] = [];
  for (const name of candidates) {
    if (!NAME_PATTERN.test(name)) throw new Error(`Invalid skill name: ${name}`);
    const remote = upstreamByName.get(name);
    if (remote) {
      names.push(name);
      selectedUpstream.push(remote);
      if (remote.explicitOnly) explicitOnly.push(name);
      continue;
    }
    const src = await locateSkill(skillDirs, name, linkRoots);
    if (src === null) {
      if (opts.skillNames === undefined && !upstreamLock) {
        skipped.push(name);
        continue;
      }
      throw new Error(`Skill "${name}" is not installed in ${skillDirs.join(", ")}`);
    }
    const files = new Map(
      [...(await walkSkillFiles(src, linkRoots))].filter(([file]) => !isInstallerArtifact(file)),
    );
    const manifest = await readOptional(path.join(src, "SKILL.md"));
    const frontmatter = manifest === null ? null : parseFrontmatter(manifest);
    if (frontmatter?.name !== name || !frontmatter.description) {
      throw new Error(`Skill "${name}" has an invalid SKILL.md`);
    }
    names.push(name);
    const codexMetadata = await readOptional(path.join(src, "agents", "openai.yaml"));
    if (isImplicitInvocationDisabled(codexMetadata)) explicitOnly.push(name);
    sourceFiles.set(name, files);
  }

  const mcpSpecs = [];
  for (const name of [...new Set(opts.mcpServerNames ?? [])].sort()) {
    if (!NAME_PATTERN.test(name)) throw new Error(`Invalid portable MCP server name: ${name}`);
    const selected = selectAgentMcpProbe({
      agent: sourceAgent.id,
      server: name,
      homeDir,
      cwd: homeDir,
      env,
    });
    mcpSpecs.push({ name, spec: portableMcpSpec(selected.spec, selected.entry) });
  }

  const rulesFile = await userRulesFile(sourceAgent.id, homeDir, env);
  const overrideName = sourceAgent.rules.userHomeOverride?.overrideRelativePath;
  const activeOverride = overrideName ? path.join(path.dirname(rulesFile), overrideName) : null;
  const overrideRules = activeOverride ? await readOptional(activeOverride) : null;
  const useOverride = overrideRules !== null && overrideRules.trim().length > 0;
  const sourceRules = useOverride ? overrideRules : await readOptional(rulesFile);
  const rules = renderRules(
    sourceRules ?? `# Global ${sourceAgent.displayName} guidance`,
    names,
    explicitOnly,
  );
  log(`Portable ${sourceAgent.displayName} profile: ${outputDir}`);
  log(
    `Global rules source: ${sourceRules === null ? "generated defaults" : useOverride ? activeOverride : rulesFile}`,
  );
  log(`Skills (${names.length}): ${names.join(", ") || "(none)"}`);
  if (linkRoots.length > 0) log(`Allowed Skill symlink roots: ${linkRoots.join(", ")}`);
  if (mcpSpecs.length > 0)
    log(`MCP declarations (${mcpSpecs.length}): ${mcpSpecs.map((entry) => entry.name).join(", ")}`);
  if (explicitOnly.length > 0)
    log(`User-invoked-only skills (${explicitOnly.length}): ${explicitOnly.join(", ")}`);
  if (skipped.length > 0)
    log(`Skipped skills unavailable in the user skills directory: ${skipped.join(", ")}`);
  if (upstreamLock)
    log(
      `GitHub Skills pinned to reviewed commits (${selectedUpstream.length}); other Skills copied locally (${sourceFiles.size}).`,
    );
  log("The profile contains personal global guidance; review it before sharing.");

  let destinationExists = false;
  try {
    await fs.stat(outputDir);
    destinationExists = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (destinationExists) {
    log(`CONFLICT: ${outputDir} already exists`);
    if (opts.dryRun) return;
    throw new Error(`Bundle destination already exists: ${outputDir}`);
  }
  if (opts.dryRun) {
    log("Dry run: nothing was written.");
    return;
  }
  if (!opts.yes) {
    const confirm = opts.confirm ?? (async () => false);
    if (!(await confirm(`Export ${names.length} skill(s) to ${outputDir}? [y/N] `))) {
      log("Aborted; nothing was written.");
      return;
    }
  }

  const manifest = {
    name: profileName,
    version: "1.0.0",
    description: `Portable ${sourceAgent.displayName} setup exported from a user environment.`,
    agents: [sourceAgent.id],
    scope: "user",
    rules: { template: "rules/global.md" },
    skills: names.map((name) => ({ name, source: `skills/${name}` })),
    ...(mcpSpecs.length > 0
      ? { mcp: mcpSpecs.map(({ name }) => ({ name, source: `mcp/${name}.json` })) }
      : {}),
  };
  const exportedLock = {
    version: 1,
    skills: selectedUpstream,
    localSkills: [...sourceFiles.keys()],
  };
  await fs.mkdir(path.dirname(outputDir), { recursive: true });
  const stageRoot = await fs.mkdtemp(
    path.join(path.dirname(outputDir), `.${profileName}-skillfit-`),
  );
  const stage = path.join(stageRoot, profileName);
  try {
    await fs.mkdir(stage);
    await fs.mkdir(path.join(stage, "rules"), { recursive: true });
    await fs.writeFile(path.join(stage, "rules", "global.md"), rules, "utf8");
    await fs.writeFile(path.join(stage, "profile.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await fs.writeFile(path.join(stage, "package.json"), '{"private":true,"type":"module"}\n');
    for (const { name, spec } of mcpSpecs) {
      const target = path.join(stage, "mcp", `${name}.json`);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, `${JSON.stringify(spec, null, 2)}\n`);
    }
    if (upstreamLock) {
      await fs.writeFile(
        path.join(stage, "upstream.lock.json"),
        `${JSON.stringify(exportedLock, null, 2)}\n`,
      );
      await fs.writeFile(
        path.join(stage, "setup.mjs"),
        [
          "import { parseArgs } from 'node:util';",
          "import { fileURLToPath } from 'node:url';",
          "import { prepareUpstreamProfile } from './runtime/configuration/upstream.js';",
          "import { runInstall } from './runtime/composition.js';",
          "const profileDir = fileURLToPath(new URL('.', import.meta.url));",
          "const { values } = parseArgs({ args: process.argv.slice(2), options: { 'dry-run': { type: 'boolean' }, yes: { type: 'boolean' }, strict: { type: 'boolean' } } });",
          "const prepared = await prepareUpstreamProfile(profileDir, { log: console.log });",
          "try {",
          `  await runInstall({ profile: 'portable', profilePath: prepared.profileDir, agent: ${JSON.stringify(sourceAgent.id)}, dryRun: values['dry-run'] ?? false, yes: values.yes ?? false, strict: values.strict ?? false });`,
          "} finally { await prepared.cleanup(); }",
          "",
        ].join("\n"),
      );
    } else {
      await fs.writeFile(
        path.join(stage, "setup.mjs"),
        [
          "import { fileURLToPath } from 'node:url';",
          "const profileDir = fileURLToPath(new URL('.', import.meta.url));",
          "const cli = fileURLToPath(new URL('./runtime/cli.js', import.meta.url));",
          `process.argv = [process.argv[0], cli, 'install', '--profile-path', profileDir, '--agent', ${JSON.stringify(sourceAgent.id)}, ...process.argv.slice(2)];`,
          "await import('./runtime/cli.js');",
          "",
        ].join("\n"),
      );
    }
    const runtimeDir = RUNTIME_ROOT;
    for (const rel of (await walkFiles(runtimeDir)).filter((file) => !file.endsWith(".test.js"))) {
      const src = path.join(runtimeDir, rel);
      const dst = path.join(stage, "runtime", rel);
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.copyFile(src, dst);
      if ((await sha256(src)) !== (await sha256(dst)))
        throw new Error(`Runtime export verification failed for ${rel}`);
    }
    for (const [name, files] of sourceFiles) {
      for (const [rel, src] of files) {
        const dst = path.join(stage, "skills", name, rel);
        await fs.mkdir(path.dirname(dst), { recursive: true });
        await fs.copyFile(src, dst);
        if ((await sha256(src)) !== (await sha256(dst)))
          throw new Error(`Export verification failed for ${name}/${rel}`);
      }
    }
    if (upstreamLock) await verifyUpstreamExport(stage, manifest, exportedLock, rules, sourceFiles);
    else await loadProfile(stageRoot, profileName);
    await fs.rename(stage, outputDir);
  } catch (error) {
    await fs.rm(stageRoot, { recursive: true, force: true });
    throw error;
  }
  await fs.rmdir(stageRoot);
  if (upstreamLock)
    await verifyUpstreamExport(outputDir, manifest, exportedLock, rules, sourceFiles);
  else await loadProfile(path.dirname(outputDir), profileName);
  log(
    upstreamLock
      ? `Export written: ${outputDir} (GitHub files are verified when setup runs)`
      : `Export verified: ${outputDir}`,
  );
}
