import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { skillUserDirSpecs, type AgentDef } from "./matrix.js";
import { resolveHome } from "../shared/local-files.js";
export function installedUserSkills(
  agent: AgentDef,
  homeDir: string,
  env: NodeJS.ProcessEnv = {},
): Array<{ name: string; dir: string }> {
  const skills = new Map<string, string>();
  for (const dirPattern of skillUserDirSpecs(agent, env)) {
    const dir = resolveHome(dirPattern, homeDir);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      // existsSync follows symlinks, so linked skill directories count and broken links do not.
      if (existsSync(join(dir, name, "SKILL.md")) && !skills.has(name)) {
        skills.set(name, join(dir, name));
      }
    }
  }
  return [...skills.entries()]
    .map(([name, dir]) => ({ name, dir }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Skills that live in the project a session recorded, not in the user catalog. */
export function installedProjectSkills(
  agent: AgentDef,
  cwd: string,
): Array<{ name: string; dir: string }> {
  const skills = new Map<string, string>();
  for (const spec of agent.skills.projectDirs) {
    const dir = join(cwd, spec);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (existsSync(join(dir, name, "SKILL.md")) && !skills.has(name)) {
        skills.set(name, join(dir, name));
      }
    }
  }
  return [...skills.entries()]
    .map(([name, dir]) => ({ name, dir }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
