import { createRequire } from 'node:module';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
export function loadMatrix() {
    return require('./matrix/agents.json');
}
export function getAgent(id) {
    const agent = loadMatrix().agents.find((a) => a.id === id);
    if (!agent) {
        const known = loadMatrix().agents.map((a) => a.id).join(', ');
        throw new Error(`Unknown agent "${id}". Known agents: ${known}`);
    }
    return agent;
}
export function agentIds() {
    return loadMatrix().agents.map((a) => a.id);
}
export function skillUserDirSpecs(agent, env) {
    const specs = [...agent.skills.userDirs];
    const override = agent.skills.userHomeOverride;
    if (!override)
        return specs;
    const root = env[override.env];
    specs.push(root ? join(root, override.relativePath) : override.fallback);
    return specs;
}
