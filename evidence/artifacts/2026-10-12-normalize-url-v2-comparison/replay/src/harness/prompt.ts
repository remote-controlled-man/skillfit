import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOCK_MARKER_FILE } from './constants.js';
import { listFilesRecursive } from './hash.js';
import type { Executor, InputMode } from './types.js';

export const ISOLATION_RULES = `Experiment isolation rules:
- Do not use tools, browse the web, or read anything outside this prompt.
- Treat the repository snapshot below as the complete task input.
- Hidden grading runs only after you exit; produce the deliverable the task asks for instead of explaining a possible solution.`;

export const WORKSPACE_RULES = `Workspace rules:
- The repository in the snapshot below is also your current working directory: inspect, edit, and run things there directly.
- Hidden grading runs only after you exit; produce the deliverable the task asks for instead of explaining a possible solution.`;

export const OUTPUT_CONTRACT = `Output contract:
- Your final message is the deliverable; it is captured to _output.md and graded.
- Follow the deliverable format requested by the task exactly.`;

const WORKSPACE_INPUT_RULES = `Workspace rules:
- The task files are in your current working directory. Inspect, edit, and run them there.
- Work locally; do not access the network or another checkout for a solution.
- Hidden grading runs only after you exit. Deliver the requested changes or answer.
- Your final message is captured to _output.md; summarize changes and checks when the task asks for code changes.`;

export function assertInputModeSupported(inputMode: InputMode, executor: Executor | null): void {
  if (inputMode !== 'snapshot' && inputMode !== 'workspace') {
    throw new Error(`Unknown input mode: ${inputMode} (expected "snapshot" or "workspace")`);
  }
  if (inputMode === 'workspace' && executor && !['cli', 'mock'].includes(executor.describe().kind)) {
    throw new Error('workspace input requires a CLI executor with filesystem access; use --agent <id>.');
  }
}

function isVisibleToAgent(rel: string): boolean {
  const parts = rel.split('/');
  if (parts.includes('.git')) return false;
  const base = parts[parts.length - 1];
  if (!base || base.startsWith('_')) return false;
  if (base === MOCK_MARKER_FILE) return false;
  return true;
}

export function snapshotRepoFiles(runDir: string): string {
  const files = listFilesRecursive(runDir).filter(isVisibleToAgent);
  return files
    .map((rel) => `--- repository file: ${rel} ---\n${readFileSync(join(runDir, rel), 'utf8')}`)
    .join('\n');
}

export function buildTaskPrompt(
  taskPromptText: string,
  snapshot: string,
  skillPayload: string | null,
  opts?: { workspace?: boolean; inputMode?: InputMode },
): string {
  if (opts?.inputMode === 'workspace') {
    const sections = [taskPromptText.trimEnd(), WORKSPACE_INPUT_RULES];
    if (skillPayload) sections.push(skillPayload);
    return `${sections.join('\n\n')}\n`;
  }
  const sections = [taskPromptText.trimEnd(), opts?.workspace ? WORKSPACE_RULES : ISOLATION_RULES, `Repository snapshot:\n\n${snapshot}`];
  if (skillPayload) sections.push(skillPayload);
  sections.push(OUTPUT_CONTRACT);
  return `${sections.join('\n\n')}\n`;
}
