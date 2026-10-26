import type { AgentSessions } from "./matrix.js";
export function extractSkillNames(event: Record<string, unknown>, cfg: AgentSessions): string[] {
  const names: string[] = [];
  const skillKey = cfg.skillKey ?? 'skill';
  if (cfg.wireShape === 'flat-tool-call') {
    let target = event;
    if (event['type'] === 'context.append_loop_event') {
      const nested = event['event'];
      if (typeof nested === 'object' && nested !== null) {
        target = nested as Record<string, unknown>;
      }
    }
    if (target['type'] === 'tool.call' && target['name'] === cfg.skillToolName) {
      const args = target['args'];
      if (typeof args === 'object' && args !== null) {
        const skill = (args as Record<string, unknown>)[skillKey];
        if (typeof skill === 'string' && skill !== '') names.push(skill);
      }
    }
    return names;
  }
  if (cfg.wireShape === 'codex-rollout') {
    if (event['type'] !== 'response_item') return names;
    const payload = event['payload'];
    if (typeof payload !== 'object' || payload === null) return names;
    const record = payload as Record<string, unknown>;
    if (record['type'] !== 'custom_tool_call') return names;
    const input = record['input'];
    if (typeof input !== 'string') return names;
    const normalized = input.replace(/\\+/g, '/');
    for (const match of normalized.matchAll(/skills\/([\w.-]+)\/SKILL\.md/gi)) {
      const name = match[1];
      if (name) names.push(name);
    }
    return names;
  }
  if (event['type'] !== 'assistant') return names;
  const message = event['message'];
  const content =
    typeof message === 'object' && message !== null
      ? (message as Record<string, unknown>)['content']
      : undefined;
  if (!Array.isArray(content)) return names;
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue;
    const record = block as Record<string, unknown>;
    if (record['type'] === 'tool_use' && record['name'] === cfg.skillToolName) {
      const input = record['input'];
      if (typeof input === 'object' && input !== null) {
        const skill = (input as Record<string, unknown>)[skillKey];
        if (typeof skill === 'string' && skill !== '') names.push(skill);
      }
    }
  }
  return names;
}

export function sessionKey(relPath: string, cfg: AgentSessions): string {
  const parts = relPath.split('/');
  if (cfg.wireShape === 'flat-tool-call') {
    return parts[1] ?? relPath;
  }
  const last = parts[parts.length - 1] ?? relPath;
  return last.replace(/\.jsonl$/, '');
}
