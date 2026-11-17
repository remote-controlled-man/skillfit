import { lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { prepareCommitBench } from "../../bench/authoring.js";
import { runOfflineBenchCheck } from "../../bench/gates/check.js";
import { collectInstalledSkillTarget } from "../../resources/installed-skill.js";
import { assertSkillRevisionTargets } from "../targets/skill.js";
import { parseEvalRequest } from "./request.js";
import { assertTokenBudgetSupport, type SpendingBudget } from "../execution/budget.js";

export interface RevisionPreparationOptions {
  candidateSkill: string;
  baselineSkill: string;
  workspace: string;
  sourceDir: string;
  fromCommit: string;
  promptFile: string;
  verifierCmd?: string;
  include?: string[];
  agent: string;
  spendingBudget?: SpendingBudget;
  executorTimeoutSeconds?: number | null;
  dryRun?: boolean;
  yes?: boolean;
  confirm?: (question: string) => Promise<boolean>;
  log?: (line: string) => void;
}

/** One fresh development comparison. No executor or user configuration writer is reachable. */
export async function prepareSkillRevision(
  options: RevisionPreparationOptions,
  dependencies: { writeFile?: typeof writeFileSync } = {},
) {
  const requested = resolve(options.workspace);
  // Resolve existing ancestors (including macOS /var and /tmp aliases), then pin that parent.
  let ancestor = dirname(requested);
  while (true) {
    try {
      realpathSync(ancestor);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      ancestor = dirname(ancestor);
    }
  }
  const physicalParent = realpathSync(ancestor);
  const workspace = resolve(physicalParent, relative(ancestor, requested));
  const assertFresh = () => {
    try {
      lstatSync(workspace);
      throw new Error(`Workspace already exists: ${workspace}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    for (let parent = dirname(workspace); parent !== physicalParent; parent = dirname(parent)) {
      try {
        if (lstatSync(parent).isSymbolicLink())
          throw new Error(`Workspace parent is a symlink: ${parent}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  };
  assertFresh();
  const candidate = collectInstalledSkillTarget(options.candidateSkill);
  const baseline = collectInstalledSkillTarget(options.baselineSkill);
  assertSkillRevisionTargets(candidate, baseline);
  for (const target of [baseline, candidate]) {
    const rel = relative(target.sourceDir, workspace);
    if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel)))
      throw new Error("Preparation workspace must not be inside an input Skill.");
  }
  const bench = prepareCommitBench({
    dir: join(workspace, "bench"),
    sourceDir: options.sourceDir,
    fromCommit: options.fromCommit,
    promptFile: options.promptFile,
    verifierCmd: options.verifierCmd,
    include: options.include,
  });
  const requestPath = join(workspace, "request.json");
  const body = {
    schemaVersion: 1,
    baselineSkill: "skills/old",
    candidateSkill: "skills/new",
    bench: "bench",
    agent: options.agent,
    purpose: "development",
    pairOrder: "balanced",
    trials: 1,
    maxCalls: 2,
    runsRoot: "runs",
    runGroup: "revision-001",
    ...(options.spendingBudget ? { spendingBudget: options.spendingBudget } : {}),
    ...(options.executorTimeoutSeconds !== undefined
      ? { executorTimeoutSeconds: options.executorTimeoutSeconds }
      : {}),
  };
  const request = parseEvalRequest(body, workspace);
  assertTokenBudgetSupport([], request.executorTimeoutSeconds, request.spendingBudget);
  const writes = bench.writes.map((write) => ({ target: write.target, content: write.content }));
  for (const [target, folder] of [
    [baseline, "old"],
    [candidate, "new"],
  ] as const)
    for (const file of target.files)
      writes.push({
        target: join(workspace, "skills", folder, file),
        content: readFileSync(join(target.sourceDir, file)),
      });
  writes.push({ target: requestPath, content: JSON.stringify(body, null, 2) + "\n" });
  // POSIX shells and PowerShell both support single-quoted literal paths (including spaces).
  const quote = (value: string) =>
    "'" + value.replaceAll("'", process.platform === "win32" ? "''" : "'\\''") + "'";
  const nextCommands = [
    `skillfit bench check ${quote(join(workspace, "bench"))}`,
    `skillfit eval --request ${quote(requestPath)} --dry-run`,
    `skillfit eval --request ${quote(requestPath)} --plan-sha <sha256-from-preview>`,
  ];
  const view = {
    schemaVersion: 1 as const,
    kind: "skillfit.revision-preparation" as const,
    workspace,
    requestPath,
    modelCalls: 0 as const,
    maxCalls: 2 as const,
    spendingBudget: request.spendingBudget ?? null,
    executorTimeoutSeconds: request.executorTimeoutSeconds,
    files: writes.map((w) => relative(workspace, w.target)),
    nextCommands,
  };
  options.log?.(
    `Prepare one development pair (2 task calls when separately executed); token limits: ${JSON.stringify(view.spendingBudget)}; executor deadline: ${request.executorTimeoutSeconds === null ? "disabled" : request.executorTimeoutSeconds + "s"}.`,
  );
  options.log?.(
    `Verifier command ${JSON.stringify(options.verifierCmd ?? "node --test")} is retained and executed with a shell by bench check and evaluation. Creation runs offline gates; preview does not execute it.`,
  );
  options.log?.(
    "A single development pair cannot authorize adoption. Authentication and ambient agent configuration are checked by the separate evaluation preview.",
  );
  options.log?.(`Workspace plan: ${workspace}`);
  for (const file of view.files) options.log?.(`  + ${file}`);
  if (options.dryRun) return { ...view, status: "preview" as const };
  if (
    !options.yes &&
    !(await options.confirm?.(
      `Create ${writes.length} files in ${workspace} and run local verifier/oracle commands? [y/N] `,
    ))
  )
    return { ...view, status: "cancelled" as const };
  assertFresh();
  bench.assertCurrent();
  for (const target of [baseline, candidate]) {
    const current = collectInstalledSkillTarget(target.sourceDir);
    if (current.sha256 !== target.sha256)
      throw new Error("Skill inputs changed after preparation; review a fresh plan.");
  }
  mkdirSync(dirname(workspace), { recursive: true });
  mkdirSync(workspace); // Exclusive ownership: do not remove anything unless this succeeded.
  try {
    for (const write of writes) {
      mkdirSync(dirname(write.target), { recursive: true });
      (dependencies.writeFile ?? writeFileSync)(write.target, write.content, { flag: "wx" });
    }
    const checks = await runOfflineBenchCheck({ dir: request.bench, log: options.log });
    return {
      ...view,
      status: checks.failures === 0 ? ("ready" as const) : ("blocked" as const),
      checks,
    };
  } catch (error) {
    rmSync(workspace, { recursive: true, force: true });
    throw error;
  }
}
