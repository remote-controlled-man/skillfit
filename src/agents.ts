import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface AgentDetect {
  binaries: string[];
  userDirs: string[];
  userFiles: string[];
}

export interface AgentRules {
  projectFiles: string[];
  userFiles: string[];
  readsAgentsMd: boolean;
  agentsMdBridge: string | null;
  notes: string;
}

export interface AgentSkills {
  projectDirs: string[];
  userDirs: string[];
  sharedDirs: string[];
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
  triggerToolName: string;
}

export interface AgentHeadless {
  argv: string[];
  promptVia: 'stdin' | 'file';
  promptFile?: string;
  streamJson?: AgentHeadlessStreamJson;
  docs: string;
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
