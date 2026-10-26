import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { skillUserDirSpecs, type AgentDef } from './matrix.js';

export interface AgentPathContext { homeDir: string; cwd: string; env: NodeJS.ProcessEnv }
export interface AgentProjectTrust { table: string; field: string; value: string }

/** Matrix path semantics shared by diagnostics and recorded environment observations. */
export function resolveAgentPath(spec: string, context: AgentPathContext): string {
  if (spec === '~') return context.homeDir;
  if (spec.startsWith('~/') || spec.startsWith('~\\')) return join(context.homeDir, spec.slice(2));
  return isAbsolute(spec) ? spec : join(context.cwd, spec);
}

export function resolveAgentRulePath(agent: AgentDef, spec: string, context: AgentPathContext): string {
  const override = agent.rules.userHomeOverride;
  const envHome = override === undefined ? undefined : context.env[override.env];
  if (spec === agent.rules.userFiles[0] && override !== undefined && envHome) return resolve(envHome, override.relativePath);
  return resolveAgentPath(spec, context);
}

export function globalSkillRoots(agent: AgentDef, home: string, env: NodeJS.ProcessEnv): string[] {
  return [...new Set([...skillUserDirSpecs(agent, env), ...agent.skills.sharedDirs.filter(path => path.startsWith('~/'))]
    .map(path => path.startsWith('~/') ? join(home, path.slice(2)) : resolve(path)))];
}

/** Only pure trust registrations for the declared workspaces are excluded from the byte contract. */
export function normalizeProjectTrust(text: string, trust: AgentProjectTrust, workspaces: readonly string[]): string {
  const allowed = new Set(workspaces.map(path => resolve(path)));
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const header = new RegExp(`^\\[${escape(trust.table)}\\.("(?:[^"\\\\\\n]|\\\\.)*"|'[^'\\n]*')\\]\\r?\\n([^[]*)`, 'gm');
  const stripped = text.replace(header, (block: string, quoted: string, body: string) => {
    let path: string;
    try { path = quoted.startsWith('"') ? JSON.parse(quoted) as string : quoted.slice(1, -1); }
    catch { return block; }
    const value = body.trim();
    return allowed.has(resolve(path)) &&
      (value === `${trust.field} = "${trust.value}"` || value === `${trust.field} = '${trust.value}'`) ? '' : block;
  });
  // Codex appends blank separator lines when registering projects. Preserve all other bytes.
  return stripped.replace(/\n+$/, '\n');
}

function selectedSettings(agent: AgentDef, context: AgentPathContext): { path: string | null; fields: Record<string, string> } {
  const { env } = context;
  const settings = agent.headless.runtime?.settings;
  if (!settings) return { path: null, fields: {} };
  const path = settings.homeOverride && env[settings.homeOverride.env]
    ? join(env[settings.homeOverride.env]!, settings.homeOverride.relativePath) : resolveAgentPath(settings.file, context);
  const fields: Record<string, string> = {};
  if (!existsSync(path)) return { path, fields };
  const text = readFileSync(path, 'utf8');
  if (settings.format === 'json') {
    const data = JSON.parse(text) as Record<string, unknown>;
    for (const key of settings.keys) if (typeof data[key] === 'string') fields[key] = data[key] as string;
  } else {
    const top = text.split(/^\s*\[/m)[0] ?? '';
    for (const key of settings.keys) {
      const line = top.split(/\r?\n/).find(line => line.trimStart().startsWith(`${key} `) || line.startsWith(`${key}=`));
      const match = line?.match(/=\s*("(?:[^"\\]|\\.)*"|'[^']*')\s*(?:#.*)?$/);
      if (match) fields[key] = match[1]!.startsWith('"') ? JSON.parse(match[1]!) as string : match[1]!.slice(1, -1);
    }
  }
  return { path, fields };
}

/** Read only matrix-declared environment facts; callers retain their own check/sealing policy. */
export function readAgentEnvironment(agent: AgentDef, context: AgentPathContext) {
  const { homeDir: home, env } = context;
  const settings = selectedSettings(agent, context);
  const override = agent.rules.userHomeOverride;
  const paths = new Set([...agent.rules.userFiles, ...agent.mcp.userFiles, ...agent.hooks.userFiles, ...agent.detect.userFiles].map(spec => {
    if (spec === agent.headless.runtime?.settings?.file && settings.path) return settings.path;
    if (override && env[override.env] && spec === agent.rules.userFiles[0]) return join(env[override.env]!, override.relativePath);
    return resolveAgentPath(spec, context);
  }));
  if (override?.overrideRelativePath && agent.rules.userFiles[0]) {
    const root = env[override.env] ?? dirname(resolveAgentPath(agent.rules.userFiles[0], context));
    paths.add(join(root, override.overrideRelativePath));
  }
  if (settings.path) paths.add(settings.path);
  const match = agent.headless.projectTrustConfigArg?.match(/^([^.]+)\.'\{workdir\}'\.([^=]+)='([^']+)'$/);
  const trust = match ? { table: match[1]!, field: match[2]!, value: match[3]! } : undefined;
  return { settings, configFiles: [...paths].map(path => ({ path, ...(path === settings.path && trust ? { trust } : {}) })),
    skillRoots: globalSkillRoots(agent, home, env), versionArgv: agent.headless.runtime?.versionArgv };
}
