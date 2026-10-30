#!/usr/bin/env node
import { executorTimeoutArgument, executorDeadlineLabel } from '../agents/timeout.js';
import { parseArgs } from 'node:util';
import { CLI_OPTIONS, USAGE } from './definition.js';
import { resolve } from 'node:path';
import { runBenchAdd, runBenchCheck, runBenchInit, prepareBenchCalibration, runBenchCalibration, type BenchCheckCalibrateOptions } from "./bench.js";
import { benchCheckError, benchCheckJson } from "./bench-check-report.js";
import { runBenchSelfTest } from '../composition.js';
import { selfTestError, selfTestExitCode } from '../evaluation/application/self-test.js';
import { inspectBench, manageBench } from "./bench-manage.js";
import { exportEvaluation } from '../composition.js';
import { runBundleExport } from '../composition.js';
import { runDoctor } from "./doctor.js";
import { type EvalOptions } from "./eval.js";
import { runEvalCli } from "./eval-cli.js";
import { readComponentJson } from '../shared/read-json.js';
import { parseSpendingBudget } from "../evaluation/execution/budget.js";
import { runEvalReport } from "./eval-report.js";
import { componentError, runEvalComponent } from "./eval-component.js";
import { readEvaluationReport } from "./evaluation-report.js";
import { runInstall } from '../composition.js';
import { runMcpCheck } from "./mcp.js";
import { runReport } from "./report.js";
import { runCodexSetup } from '../composition.js';
import { VERSION } from "../shared/version.js";

function jsonBenchCommand(): string | null {
  const supported = ['check', 'self-test', 'list', 'show', 'edit', 'remove'];
  const args = process.argv.slice(2);
  try {
    const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: false, options: CLI_OPTIONS });
    // Loose parsing retains an invalid inline boolean value (for example
    // --json=true). It still requests the JSON error envelope, not text output.
    return values.json !== false && positionals[0] === 'bench' && supported.includes(positionals[1] ?? '') ? positionals[1]! : null;
  } catch {
    // A missing option value may prevent even loose parsing. Preserve JSON errors
    // for the standard command spelling, including a leading --json flag.
    const jsonFlag = (arg: string) => arg === '--json' || arg.startsWith('--json=');
    const command = args.filter(arg => !jsonFlag(arg));
    return args.some(jsonFlag) && command[0] === 'bench' && supported.includes(command[1] ?? '') ? command[1]! : null;
  }
}

function failureExitCode(fallback: number): number {
  const current = Number(process.exitCode);
  return current === 130 || current === 143 ? current : fallback;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: CLI_OPTIONS,
  });

  if (values.version) {
    console.log(VERSION);
    return;
  }

  const command = positionals[0];
  if (values.help || !command) {
    console.log(USAGE);
    return;
  }
  if (command === 'bench' && positionals[1] === 'self-test') {
    const allowed = new Set(['controls', 'suite', 'runs-root', 'run-group', 'dry-run', 'yes', 'json', 'plan-sha']);
    for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== false && !allowed.has(key)) {
      throw new Error(`--${key} is unsupported by bench self-test; modes, tasks and trials come only from controls; no live executor is available.`);
    }
    if (positionals.length !== 3 || !positionals[2]) throw new Error('Usage: skillfit bench self-test <path-or-name> [--controls <file>] [--suite <id> ...] [--json] [--dry-run]');
    if (values['plan-sha'] !== undefined && values['dry-run']) throw new Error('--plan-sha requires a non-dry-run self-test.');
    if (values['runs-root'] !== undefined && (!values['runs-root'].trim() || values['runs-root'].includes('\0'))) throw new Error('--runs-root must be a non-empty path.');
    const result = await runBenchSelfTest({ dir: positionals[2], controls: values.controls, suites: values.suite,
      runsRoot: values['runs-root'], runGroup: values['run-group'], dryRun: values['dry-run'], yes: values.yes,
      json: values.json, expectedPlanSha256: values['plan-sha'], log: line => values.json ? console.error(line) : console.log(line) });
    if (values.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`Bench self-test: ${result.status}; synthetic=true; ${result.simulatedExecutorInvocations} simulated invocations; 0 harness model calls.`);
      if (result.plan) { console.log(`Plan SHA: ${result.plan.sha256}`); console.log(`Output: ${result.plan.outputDir}`); }
      for (const suite of result.suites) console.log(`${suite.id}: ${suite.status}${suite.reasons.length ? ` — ${suite.reasons.join(' ')}` : ''}`);
      console.log('Synthetic controls cannot authorize adoption. Local verifiers/oracles must be trusted and offline.');
    }
    process.exitCode = failureExitCode(selfTestExitCode(result));
    return;
  }
  if (values.controls !== undefined || values.suite !== undefined) throw new Error('--controls and --suite apply only to bench self-test.');
  const calibrationCommand = command === 'bench' && positionals[1] === 'check' && values.calibrate;
  if (values['baseline-skill'] !== undefined && command !== 'eval') {
    throw new Error('--baseline-skill applies only to eval --mode installed.');
  }
  if (values['schema-version'] !== undefined && !(command === 'bench' && positionals[1] === 'init')) throw new Error('--schema-version applies only to bench init.');
  if (values.claim !== undefined && !(command === 'bench' && positionals[1] === 'add')) throw new Error('--claim applies only to bench add.');
  if (values.kind !== undefined && !(command === 'bench' && positionals[1] === 'init')) {
    throw new Error('--kind applies only to bench init.');
  }
  if (values.task !== undefined && command !== 'eval' && !calibrationCommand && !(command === 'bench' && positionals[1] === 'add')) {
    throw new Error('--task applies only to eval, calibration or bench add.');
  }
  if ((values.set || values.unset) && !(command === 'bench' && positionals[1] === 'edit')) throw new Error('--set and --unset apply only to bench edit.');
  if (values.export !== undefined && !(command === 'report' && positionals[1] === 'eval')) throw new Error('--export applies only to report eval.');
  if (values['input-root'] && values.export === undefined) throw new Error('--input-root requires report eval --export.');
  if (values.export !== undefined && (values.replay || values.records || values.policy)) throw new Error('--export cannot be combined with --replay, --records or --policy.');
  if (command === 'bench' && positionals[1] === 'add' && values.task && values.task.length !== 1) throw new Error('bench add requires exactly one --task.');
  if (values.request !== undefined && command !== 'eval') throw new Error('--request applies only to eval.');
  if (values['plan-sha'] !== undefined && ((command !== 'eval' && !calibrationCommand) || values['dry-run'])) throw new Error('--plan-sha requires a non-dry-run eval or calibration.');
  const evalSettings = ['spending-budget', 'executor-timeout-seconds', 'pair-order', 'runs-root', 'run-group'] as const;
  const draftingCommand = command === 'bench' && positionals[1] === 'add' && values.decompose;
  if (command !== 'eval' && !calibrationCommand && !draftingCommand && evalSettings.some(key => values[key] !== undefined)) throw new Error('Budget, timeout and output settings apply only to eval, calibration or bench add --decompose.');
  if ((calibrationCommand || draftingCommand) && values['pair-order'] !== undefined) throw new Error('--pair-order requires a paired eval.');
  if (values['verifier-timeout-seconds'] !== undefined && !(command === 'bench' && positionals[1] === 'add')) throw new Error('--verifier-timeout-seconds applies only to bench add; edit an existing case with --set verifierTimeoutSeconds=<n>.');
  if (calibrationCommand && (values.mode !== undefined || values['judge-agent'] !== undefined || values['baseline-skill'] !== undefined || values['compete-installed'] || values.bench !== undefined)) {
    throw new Error('Calibration is single-arm: --mode, --judge-agent, --baseline-skill, --compete-installed and --bench do not apply; supply the bench directory after check.');
  }
  if (values['runs-root'] !== undefined && (!values['runs-root'].trim() || values['runs-root'].includes('\0'))) throw new Error('--runs-root must be a non-empty path.');
  if ((values.policy !== undefined || values.records !== undefined || values.replay) && !(command === 'report' && positionals[1] === 'eval')) {
    throw new Error('--policy, --records and --replay require report eval.');
  }

  const common = {
    agent: values.agent,
    dryRun: values['dry-run'] ?? false,
    yes: values.yes ?? false,
  };
  const inputMode = values.input;
  if (inputMode !== undefined && inputMode !== 'snapshot' && inputMode !== 'workspace') {
    throw new Error(`Unknown --input: ${inputMode} (expected "snapshot" or "workspace")`);
  }
  if (inputMode !== undefined && command !== 'eval' &&
      !(command === 'bench' && positionals[1] === 'check' && values.calibrate)) {
    throw new Error('--input applies only to paired eval or bench check --calibrate.');
  }
  const trials = values.trials === undefined ? undefined : Number(values.trials);
  const maxCalls = values['max-calls'] === undefined ? undefined : Number(values['max-calls']);
  if (maxCalls !== undefined && (!Number.isSafeInteger(maxCalls) || maxCalls < 1)) throw new Error('--max-calls must be a positive safe integer.');
  if (maxCalls !== undefined && command !== 'eval' && !draftingCommand && !(command === 'bench' && positionals[1] === 'check' && values.calibrate)) {
    throw new Error('--max-calls applies only to eval, bench check --calibrate or bench add --decompose.');
  }
  if (trials !== undefined && (!Number.isInteger(trials) || trials < 1 || trials > 20)) {
    throw new Error(`--trials must be an integer between 1 and 20, got ${JSON.stringify(values.trials)}`);
  }

  switch (command) {
    case 'doctor':
      await runDoctor(common);
      return;
    case 'report':
      if (positionals[1] === 'eval') {
        if (!positionals[2]) {
          if (values.json) throw new Error('report eval --json requires a saved summary or native run directory.');
          console.error('Usage: skillfit report eval <summary-or-run-dir>');
          process.exitCode = 2;
          return;
        }
        if (values.export !== undefined) {
          const result = await exportEvaluation(positionals[2], values.export, { yes: values.yes, dryRun: values['dry-run'], benchDir: values.bench, inputRoots: values['input-root'],
            log: values.json ? () => {} : undefined });
          if (values.json) console.log(JSON.stringify(result, null, 2));
          return;
        }
        if (values.json) console.log(JSON.stringify(await readEvaluationReport(positionals[2], {
          policyPath: values.policy, recordsPath: values.records, replay: values.replay, benchDir: values.bench,
        }), null, 2));
        else await runEvalReport(positionals[2], undefined, {
          policyPath: values.policy, recordsPath: values.records, replay: values.replay, benchDir: values.bench,
        });
        return;
      }
      await runReport({ agent: values.agent, json: values.json ?? false });
      return;
    case 'eval': {
      if (values.request !== undefined) {
        if (positionals.length !== 1 || ['agent', 'mode', 'baseline-skill', 'bench', 'task', 'trials', 'max-calls', 'input', 'judge-agent', ...evalSettings].some(key => values[key as keyof typeof values] !== undefined) || values['compete-installed']) {
          throw new Error('--request cannot be combined with a target or positional eval settings; put settings in the request.');
        }
        const result = await runEvalComponent(values.request, { dryRun: values['dry-run'], expectedPlanSha256: values['plan-sha'], log: line => console.error(line) });
        console.log(JSON.stringify(result, null, 2));
        if (result.status === 'stopped') process.exitCode = failureExitCode(2);
        return;
      }
      if (values['plan-sha'] !== undefined && !values['run-group']) throw new Error('Positional eval --plan-sha requires --run-group from the dry-run plan.');
      if (values.json && !values['dry-run'] && values['plan-sha'] === undefined) throw new Error('JSON eval execution requires --plan-sha from a dry-run and --run-group; no calls started.');
      const skillPath = positionals[1];
      if (!skillPath) {
        if (values.json) throw new Error('Usage: skillfit eval <target-path> [options]');
        console.error('Usage: skillfit eval <target-path> [--bench <path>] [--trials <n>] [--agent <id>] [--mode <mode>]');
        process.exitCode = 2;
        return;
      }
      const mode = values.mode ?? 'inject';
      if (mode !== 'inject' && mode !== 'installed' && mode !== 'trigger') {
        if (values.json) throw new Error(`Unknown --mode: ${mode} (expected "inject", "installed" or "trigger")`);
        console.error(`Unknown --mode: ${mode} (expected "inject", "installed" or "trigger")`);
        process.exitCode = 2;
        return;
      }
      if (values['runs-root'] !== undefined && (!values['runs-root'].trim() || values['runs-root'].includes('\0'))) throw new Error('--runs-root must be a non-empty path.');
      const spendingBudget = values['spending-budget'] === undefined ? undefined : parseSpendingBudget(readComponentJson(resolve(values['spending-budget'])).value);
      const options: EvalOptions = {
        ...common,
        skillPath,
        baselineSkillPath: values['baseline-skill'],
        bench: values.bench,
        taskIds: values.task,
        mode: mode as 'inject' | 'installed' | 'trigger',
        inputMode,
        judgeAgent: values['judge-agent'],
        competeInstalled: values['compete-installed'],
        maxCalls,
        trials,
        spendingBudget,
        executorTimeoutSeconds: executorTimeoutArgument(values['executor-timeout-seconds']),
        pairOrder: values['pair-order'] as 'baseline-first' | 'balanced' | undefined,
        runsRoot: values['runs-root'] === undefined ? undefined : resolve(values['runs-root']),
        runGroup: values['run-group'],
        log: values.json ? (line: string) => console.error(line) : (line: string) => console.log(line),
      };
      {
        const result = await runEvalCli(options, values['plan-sha']);
        if (values.json) console.log(JSON.stringify(result, null, 2));
        else if ('executionError' in result) console.error(result.executionError);
        if (result.status === 'stopped') process.exitCode = failureExitCode(2);
      }
      return;
    }
    case 'mcp': {
      if (positionals[1] !== 'check' || !positionals[2]) {
        console.error('Usage: skillfit mcp check <spec.json> [--dry-run]');
        process.exitCode = 2;
        return;
      }
      await runMcpCheck({ specPath: positionals[2], dryRun: values['dry-run'] ?? false });
      return;
    }
    case 'install':
      await runInstall({
        ...common,
        profile: values.profile ?? 'recommended',
        profilePath: values['profile-path'],
        project: values.project ?? false,
        strict: values.strict ?? false,
      });
      return;
    case 'setup':
      if (positionals[1] !== 'codex') {
        console.error('Usage: skillfit setup codex [--list | --starter | --all | --skill <name> ...] [--no-rules] [--dry-run] [--yes]');
        process.exitCode = 2;
        return;
      }
      await runCodexSetup({
        all: values.all, starter: values.starter, skills: values.skill, list: values.list,
        noRules: values['no-rules'], dryRun: values['dry-run'],
        strict: values.strict, yes: values.yes,
      });
      return;
    case 'bundle': {
      if (positionals[1] !== 'export' || !positionals[2]) {
        console.error('Usage: skillfit bundle export <dir> [--skill <name> ...] [--upstream-lock <path>] [--min-sessions <n>] [--dry-run] [--yes]');
        process.exitCode = 2;
        return;
      }
      await runBundleExport({
        outputDir: positionals[2],
        skillNames: values.skill,
        minSessions: values['min-sessions'] === undefined ? undefined : Number(values['min-sessions']),
        upstreamLockPath: values['upstream-lock'],
        dryRun: values['dry-run'] ?? false,
        yes: values.yes ?? false,
      });
      return;
    }
    case 'bench': {
      const subcommand = positionals[1];
      if (subcommand === 'list' || subcommand === 'show') {
        if (subcommand === 'show' && !positionals[3]) throw new Error('Usage: skillfit bench show <dir> <task-id> [--json]');
        const result = inspectBench(positionals[2] ?? '.', subcommand === 'show' ? positionals[3] : undefined);
        if (values.json) console.log(JSON.stringify(result, null, 2));
        else if (subcommand === 'show') console.log(JSON.stringify(result.tasks[0], null, 2));
        else {
          console.log(`Bench: ${result.name} (${result.tasks.length} tasks, sha256 ${result.sha256})`);
          for (const task of result.tasks) console.log(`${task.id}\t${task.verifierKind}\t${task.oracle ? 'oracle' : 'no oracle'}\t${task.fixture}\t${task.claims?.join(',') ?? 'legacy-unrecorded'}`);
        }
        return;
      }
      if (subcommand === 'edit' || subcommand === 'remove') {
        if (!positionals[2] || !positionals[3]) throw new Error(`Usage: skillfit bench ${subcommand} <dir> <task-id> [--json] [--dry-run] [--yes]`);
        const result = manageBench({ dir: positionals[2], taskId: positionals[3], action: subcommand,
          set: values.set, unset: values.unset, dryRun: values['dry-run'], yes: values.yes,
          log: values.json ? () => {} : undefined });
        if (values.json) console.log(JSON.stringify(result, null, 2));
        return;
      }
      if (subcommand === 'init') {
        const kind = values.kind;
        if (kind !== undefined && kind !== 'output' && kind !== 'command') {
          throw new Error(`Unknown --kind: ${kind} (expected "output" or "command")`);
        }
        if (values['schema-version'] !== undefined && !['1', '2'].includes(values['schema-version'])) throw new Error('--schema-version must be 1 or 2.');
        await runBenchInit({ ...common, dir: positionals[2], kind, schemaVersion: values['schema-version'] === '2' ? 2 : 1 });
        return;
      }
      if (subcommand === 'check') {
        if (values.calibrate) {
          if (values['plan-sha'] !== undefined && !values['run-group']) throw new Error('Calibration --plan-sha requires --run-group from the preview.');
          if (values.json && !values['dry-run'] && !values['plan-sha']) throw new Error('JSON calibration execution requires --plan-sha and --run-group; no calls started.');
          const calibrate: BenchCheckCalibrateOptions = { agent: values.agent, inputMode: inputMode as 'snapshot' | 'workspace' | undefined, maxCalls, trials,
            dryRun: values['dry-run'] ?? false,
            runsRoot: values['runs-root'] === undefined ? undefined : resolve(values['runs-root']),
            runGroup: values['run-group'],
            executorTimeoutSeconds: executorTimeoutArgument(values['executor-timeout-seconds']),
            spendingBudget: values['spending-budget'] === undefined ? undefined : parseSpendingBudget(readComponentJson(resolve(values['spending-budget'])).value),
            reviewedPlanSha256: values['plan-sha'] };
          const plan = prepareBenchCalibration({ dir: positionals[2], taskIds: values.task, calibrate });
          if (values['dry-run']) {
            if (values.json) console.log(JSON.stringify({ schemaVersion: 1, kind: 'skillfit.calibration-result', status: 'planned', plan,
              acceptance: { decision: 'inconclusive', eligibleForUpgrade: false, automaticUpgrade: false } }, null, 2));
            else {
              console.log(`calibration executor: ${plan.executor?.detail ?? plan.executor?.model ?? 'unresolved'}`);
              console.log(`calibration plan: ${plan.bench.taskIds.length} task(s) × ${plan.trials} baseline run(s), input ${plan.inputMode}; ${plan.plannedCalls} calls, ceiling ${plan.maxCalls}`);
              console.log(`Agent environment: ${plan.agentPreflight.status}; login remains offline unknown`);
              console.log(`Executor deadline: ${executorDeadlineLabel(plan.executorTimeoutSeconds)}; output ${plan.outputDir}`);
              if (plan.spendingBudget) console.log(`Spending stop lines: ${JSON.stringify(plan.spendingBudget)}`);
              console.log(`Plan SHA: ${plan.planSha256}`);
              console.log('Dry run: no verifier, oracle or agent started; nothing written.');
            }
            return;
          }
          try {
            const report = await runBenchCalibration({ dir: positionals[2], taskIds: values.task,
              log: values.json ? line => console.error(line) : undefined,
              calibrate: { ...calibrate, runsRoot: plan.runsRoot, runGroup: plan.runGroup, reviewedPlanSha256: plan.planSha256 } });
            if (values.json) console.log(JSON.stringify(await readEvaluationReport(plan.outputDir), null, 2));
            if (report.failures > 0) process.exitCode = failureExitCode(1);
          } catch (error) {
            const { existsSync } = await import('node:fs');
            if (!existsSync(resolve(plan.outputDir, '_plan.json'))) throw error;
            const report = await readEvaluationReport(plan.outputDir);
            if (values.json) console.log(JSON.stringify({ ...report, executionError: error instanceof Error ? error.message : String(error) }, null, 2));
            else console.error(error instanceof Error ? error.message : String(error));
            process.exitCode = failureExitCode(2);
          }
          return;
        }
        const report = await runBenchCheck({
          dir: positionals[2],
          log: values.json ? () => {} : undefined,
        });
        if (values.json) console.log(JSON.stringify(benchCheckJson(report), null, 2));
        if (report.failures > 0) process.exitCode = 1;
        return;
      }
      if (subcommand === 'add') {
        const shouldTrigger = values['should-trigger'];
        if (shouldTrigger !== undefined && shouldTrigger !== 'yes' && shouldTrigger !== 'no') {
          console.error(`Unknown --should-trigger value: ${shouldTrigger} (expected "yes" or "no")`);
          process.exitCode = 2;
          return;
        }
        const verifierKind = values['verifier-kind'];
        if (verifierKind !== undefined && verifierKind !== 'output' && verifierKind !== 'command') {
          console.error(`Unknown --verifier-kind value: ${verifierKind} (expected "output" or "command")`);
          process.exitCode = 2;
          return;
        }
        await runBenchAdd({
          ...common,
          benchDir: positionals[2],
          claims: values.claim,
          task: values.task?.[0],
          prompt: values.prompt,
          promptFile: values['prompt-file'],
          freeze: values.freeze ?? false,
          fromCommit: values['from-commit'],
          include: values.include,
          sourceDir: values['source-dir'],
          verifierCmd: values['verifier-cmd'],
          expect: values.expect,
          oracle: values.oracle,
          decompose: values.decompose ?? false,
          verifierKind,
          verifierTimeoutSeconds: values['verifier-timeout-seconds'] === undefined ? undefined : Number(values['verifier-timeout-seconds']),
          maxCalls,
          runsRoot: values['runs-root'],
          runGroup: values['run-group'],
          spendingBudget: values['spending-budget'] === undefined ? undefined : parseSpendingBudget(readComponentJson(resolve(values['spending-budget'])).value),
          executorTimeoutSeconds: executorTimeoutArgument(values['executor-timeout-seconds']),
          shouldTrigger: shouldTrigger === undefined ? undefined : shouldTrigger === 'yes',
        });
        return;
      }
      console.error('Usage: skillfit bench init [dir] | check [dir] | add <dir> ... | list <dir> | show/edit/remove <dir> <task-id>');
      process.exitCode = 2;
      return;
    }
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(USAGE);
      process.exitCode = 2;
  }
}

main().catch((err: unknown) => {
  const benchCommand = jsonBenchCommand();
  if (benchCommand === 'self-test') {
    console.log(JSON.stringify(selfTestError(err), null, 2)); process.exitCode = failureExitCode(2); return;
  }
  if (benchCommand === 'check' && process.argv.includes('--calibrate')) {
    console.log(JSON.stringify(componentError(err), null, 2));
    process.exitCode = failureExitCode(2); return;
  }
  if (benchCommand === 'check') {
    console.log(JSON.stringify(benchCheckError(err), null, 2));
    process.exitCode = failureExitCode(2);
    return;
  }
  if (benchCommand) {
    console.log(JSON.stringify({ schemaVersion: 1, kind: 'skillfit.bench-error', status: 'error',
      error: { code: 'INVALID_BENCH_OPERATION', message: err instanceof Error ? err.message : String(err) } }, null, 2));
    process.exitCode = failureExitCode(2); return;
  }
  if (process.argv.some(arg => arg === '--request' || arg.startsWith('--request=')) ||
      (process.argv.some(arg => arg === '--json' || arg.startsWith('--json=')) && process.argv.includes('eval'))) {
    console.log(JSON.stringify(componentError(err), null, 2));
    process.exitCode = failureExitCode(2);
    return;
  }
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = failureExitCode(1);
});
