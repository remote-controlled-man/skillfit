import { executorTimeoutMs } from './timeout.js';
import { getAgent } from "./matrix.js";
import { ApiExecutor } from "./adapters/api.js";
import { CliExecutor } from "./adapters/cli.js";
import { validateSkillInstallDir } from "../resources/installed-skill.js";
import type { EvaluationTarget } from "../resources/contracts.js";
import type { Executor } from "./contracts.js";
export function resolveExecutor(agent: string | undefined, target: EvaluationTarget, installed = false, executorTimeoutSeconds?: number | null, installDir?: string, env: NodeJS.ProcessEnv = process.env): Executor {
  if (agent) {
    const definition = getAgent(agent);
    return CliExecutor.forAgent(agent, {
      ...(executorTimeoutSeconds !== undefined ? { timeoutMs: executorTimeoutMs(executorTimeoutSeconds) } : {}),
      trustProjectConfig: target.kind === 'mcp' && definition.headless.projectTrustConfigArg !== undefined,
      ...(installed && definition.headless.streamJson ? { triggerSkillName: target.name } : {}),
      ...(installed && installDir ? { triggerSkillPaths: [`${validateSkillInstallDir(installDir)}/${target.name}/SKILL.md`] } : {}),
    });
  }
  if (executorTimeoutSeconds === null) throw new Error('An API executor cannot disable its deadline; use a supported CLI with Token-only spending limits.');
  return ApiExecutor.fromEnv(env, executorTimeoutSeconds === undefined ? {} : { timeoutMs: executorTimeoutSeconds * 1000 });
}
export function resolveJudge(judgeAgent?: string, timeoutSeconds?: number | null, env: NodeJS.ProcessEnv = process.env): Executor | null {
  const flag = env['SKILLFIT_JUDGE'];
  if (!judgeAgent && (!flag || flag === '0' || flag === 'false')) return null;
  if (judgeAgent) {
    return CliExecutor.forAgent(judgeAgent, timeoutSeconds === undefined ? {} : { timeoutMs: executorTimeoutMs(timeoutSeconds) });
  }
  if (timeoutSeconds === null) throw new Error('An API judge cannot disable its deadline; use a supported CLI with Token-only spending limits.');
  return new ApiExecutor({
      apiKey: env['SKILLFIT_JUDGE_API_KEY'] ?? env['SKILLFIT_API_KEY'] ?? env['OPENAI_API_KEY'],
      model: env['SKILLFIT_JUDGE_MODEL'] ?? env['SKILLFIT_API_MODEL'],
      baseUrl: env['SKILLFIT_JUDGE_BASE_URL'] ?? env['SKILLFIT_API_BASE_URL'],
      ...(timeoutSeconds === undefined ? {} : { timeoutMs: timeoutSeconds * 1000 }),
    });
}
export function installedObservation(agent: string): 'skill-read' | 'skill-tool' { return getAgent(agent).headless.streamJson?.wireShape === 'codex-items' ? 'skill-read' : 'skill-tool'; }

/** Public execution seam; vendor wire options stay inside the adapter. */
export function createAgentExecutor(agent: string, options: {
  timeoutMs?: number | null; observedSkill?: { name: string; identities?: string[]; paths?: string[]; required?: boolean };
} = {}): Executor {
  return CliExecutor.forAgent(agent, { timeoutMs: options.timeoutMs,
    ...(options.observedSkill && (options.observedSkill.required || getAgent(agent).headless.streamJson) ? {
      triggerSkillName: options.observedSkill.name,
      triggerSkillIdentities: options.observedSkill.identities,
      triggerSkillPaths: options.observedSkill.paths,
    } : {}) });
}

export { DEFAULT_API_TIMEOUT_MS } from './adapters/api.js';
