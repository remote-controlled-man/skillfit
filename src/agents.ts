import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

export interface AgentDetect {
  binaries: string[];
  userDirs: string[];
  userFiles: string[];
}

export interface AgentsMdBridge {
  note: string;
  fileName: string;
  importLine: string;
}

export interface AgentRules {
  projectFiles: string[];
  userFiles: string[];
  userHomeOverride?: { env: string; relativePath: string; overrideRelativePath?: string };
  readsAgentsMd: boolean;
  agentsMdBridge: AgentsMdBridge | null;
  notes: string;
}

export interface AgentSkills {
  projectDirs: string[];
  userDirs: string[];
  sharedDirs: string[];
  /** Extra user skills root. `fallback` applies when `env` is unset. */
  userHomeOverride?: { env: string; relativePath: string; fallback: string };
}

export interface AgentMcp {
  projectFiles: string[];
  userFiles: string[];
  format: 'json-mcpServers' | 'toml-mcp_servers';
}

export interface AgentHooks {
  projectFiles: string[];
  userFiles: string[];
  eventCasing: string;
}

export interface AgentSubagents {
  projectDirs: string[];
  userDirs: string[];
}

export interface AgentHeadlessStreamJson {
  argv: string[];
  triggerToolName?: string;
  wireShape?: 'flat-tool-call' | 'content-blocks' | 'codex-items';
}

export interface AgentHeadless {
  runtime?: {
    versionArgv?: string[];
    settings?: { file: string; format: 'toml' | 'json'; keys: string[]; docs: string; homeOverride?: { env: string; relativePath: string } };
  };
  argv: string[];
  promptVia: 'stdin' | 'file';
  promptFile?: string;
  /** CLI config override used only for disposable workspace configuration experiments. */
  projectTrustConfigArg?: string;
  /**
   * The headless transcript carries no usable token counts, so usage has to be read out of band from
   * the agent's own session log after the run. A capability, not an agent name: the harness must not
   * know which vendor needs it (AGENTS.md — agent-specific behavior comes from the matrix).
   */
  usageFromSessionLog?: boolean;
  /** Recover numeric lower bounds after a failed JSON invocation; never a final receipt. */
  partialUsageFromSessionLog?: boolean;
  streamJson?: AgentHeadlessStreamJson;
  docs: string;
}

export interface AgentSessions {
  dir: string;
  homeOverride?: { env: string; relativePath: string };
  transcriptGlob: string;
  wireShape: 'flat-tool-call' | 'content-blocks' | 'codex-rollout';
  skillToolName?: string;
  skillKey?: string;
  docs: string | null;
}

export interface AgentDef {
  id: string;
  displayName: string;
  vendor: string;
  detect: AgentDetect;
  rules: AgentRules;
  skills: AgentSkills;
  mcp: AgentMcp;
  hooks: AgentHooks;
  subagents: AgentSubagents;
  sessions?: AgentSessions;
  headless: AgentHeadless;
  docs: Record<string, string>;
}

export interface AgentMatrix {
  schemaVersion: number;
  verifiedAt: string;
  agents: AgentDef[];
}

export function loadMatrix(): AgentMatrix {
  return require('./matrix/agents.json') as AgentMatrix;
}

export function getAgent(id: string): AgentDef {
  const agent = loadMatrix().agents.find((a) => a.id === id);
  if (!agent) {
    const known = loadMatrix().agents.map((a) => a.id).join(', ');
    throw new Error(`Unknown agent "${id}". Known agents: ${known}`);
  }
  return agent;
}

export function agentIds(): string[] {
  return loadMatrix().agents.map((a) => a.id);
}

export function skillUserDirSpecs(agent: AgentDef, env: NodeJS.ProcessEnv): string[] {
  const specs = [...agent.skills.userDirs];
  const override = agent.skills.userHomeOverride;
  if (!override) return specs;
  const root = env[override.env];
  specs.push(root ? join(root, override.relativePath) : override.fallback);
  return specs;
}
