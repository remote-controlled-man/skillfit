import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { skillUserDirSpecs, type AgentDef } from './matrix.js';
import { resolveHome } from '../shared/local-files.js';
export function installedUserSkills(
  agent: AgentDef,
  homeDir: string,
  env: NodeJS.ProcessEnv = {},
): Array<{ name: string; dir: string }> {
  const skills = new Map<string, string>();
  for (const dirPattern of skillUserDirSpecs(agent, env)) {
    const dir = resolveHome(dirPattern, homeDir);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(dir, entry.name, 'SKILL.md'))) {
        if (!skills.has(entry.name)) skills.set(entry.name, join(dir, entry.name));
      }
    }
  }
  return [...skills.entries()].map(([name, dir]) => ({ name, dir })).sort((a, b) => a.name.localeCompare(b.name));
}
