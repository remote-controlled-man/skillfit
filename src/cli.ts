#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { runBenchAdd, runBenchCheck, runBenchInit } from './commands/bench.js';
import { benchCheckError, benchCheckJson } from './commands/bench-check-report.js';
import { inspectBench, manageBench } from './commands/bench-manage.js';
import { exportEvaluation } from './commands/eval-export.js';
import { runBundleExport } from './commands/bundle.js';
import { runDoctor } from './commands/doctor.js';
import { DEFAULT_EVAL_TRIALS, runEval } from './commands/eval.js';
import { runEvalReport } from './commands/eval-report.js';
import { componentError, reportEvalComponent, runEvalComponent } from './commands/eval-component.js';
import { runInstall } from './commands/install.js';
import { runMcpCheck } from './commands/mcp.js';
import { runReport } from './commands/report.js';
import { runCodexSetup } from './commands/setup.js';
import { VERSION } from './version.js';

const USAGE = `skillfit ${VERSION} — evidence-driven configuration for AI coding agents

Usage:
  skillfit doctor [--agent <id>]            Inspect current agent configuration health
  skillfit report [--agent <id>] [--json]   Skill usage receipts from local session history (read-only)
  skillfit report eval <manifest.json>     Render an existing evaluation as Markdown (read-only)
  skillfit report eval <manifest-or-run-dir> --json [--replay]  Assess saved evidence for an Agent
  skillfit report eval <run-dir> --export <new-dir>  Plan a portable offline replay package
  skillfit eval --request <request.json> --dry-run  Return a pinned JSON plan without calls
  skillfit eval --request <request.json> --plan-sha <sha256>  Run that plan and return JSON evidence
  skillfit eval <target-path> [options]     A/B-test a Skill, rules, or MCP setup against a bench
  skillfit mcp check <spec.json>            Handshake with a stdio or Streamable HTTP MCP server and audit its tool catalog
  skillfit bench init [dir] [--kind output|command]  Scaffold a text-output or code-editing case
  skillfit bench check [dir] [--json]       Validate a bench offline (verifier self-tests, hygiene)
  skillfit bench check [dir] --calibrate    Plus real baseline-difficulty runs (needs --agent)
  skillfit bench add <dir> --freeze ...     Freeze a real failure into a bench task (see below)
  skillfit bench add <dir> --from-commit <sha>  Mine a fix commit (parent = fixture, fix's tests = verifier)
  skillfit bench list <dir> [--json]        List registered cases without running verifiers
  skillfit bench show <dir> <task-id> [--json]  Inspect one registered case
  skillfit bench edit <dir> <task-id> --set <field=value>  Plan a manifest edit (apply with --yes)
  skillfit bench remove <dir> <task-id>     Plan to unregister a case, preserving its files
  skillfit install [options]                Inspect or apply a managed configuration profile
  skillfit setup codex [options]            Select verified upstream Skills and global Codex guidance
  skillfit bundle export <dir> [options]    Export used Codex skills and global guidance as a portable profile

Options:
  --agent <id>        Target agent: claude-code | codex | kimi-code (default: all detected)
  --judge-agent <id>  Drive the blind judge with a local agent CLI (inject mode; prefer a different family than --agent)
  --mode <mode>       Eval mode: inject (default) | installed (paired complete Skill) | trigger (single arm)
  --baseline-skill <path>  With --mode installed, compare a previous Skill version against the target
  --request <path>    Version 1 Skill revision request (JSON output; excludes positional eval options)
  --plan-sha <hash>   Confirm the current --request dry-run plan before real calls
  --json             Machine output for bench check/list/show/edit/remove, report, and request-based eval
  --policy <path>    With report eval --json, assess against a policy (post-hoc changes cannot authorize adoption)
  --records <dir>    With report eval --json, use native evidence from this run directory
  --replay           With report eval --json, regrade cloned deliveries using the frozen bench
  --export <dir>     With report eval, plan a portable package; --yes writes a fresh destination
  --input-root <label=path>  With --export, recover pinned inputs from a matching copy (repeatable)
  --compete-installed With --mode trigger, copy other user-level Skills into each trial so recall is not an upper bound
  --input <mode>      Paired eval or baseline calibration: snapshot (default) | workspace (CLI only)
  --bench <path>      Bench directory for eval (default: bundled benches)
  --task <id>        With eval, select cases (repeatable, manifest order); requests use taskIds
  --trials <n>        Repetitions per condition for eval (integer 1–20; default: ${DEFAULT_EVAL_TRIALS})
  --max-calls <n>     Call ceiling for eval / bench check --calibrate (includes enabled judges)
                     Also controls baseline calibration repetitions
  --profile <name>    Profile for install (default: "recommended")
  --profile-path <dir>  Install a portable profile from a local directory
  --skill <name>     With bundle export, include a named installed skill (repeatable)
                     With setup codex, select a Skill (repeatable)
  --all              With setup codex, select all catalog Skills (not an efficacy recommendation)
  --starter          With setup codex, select the legacy 13-Skill set (not evaluated as a set)
  --list             With setup codex, list choices without downloading
  --no-rules         With setup codex, skip the global AGENTS.md block
  --min-sessions <n>  With bundle export, default selection needs this many sessions (default: 2)
  --upstream-lock <path>  With bundle export, fetch listed GitHub Skills at pinned commits during setup
  --project           Install into the current project instead of user-level config
  --dry-run           Print the plan without writing anything
  --strict            With install --dry-run, exit non-zero on conflicts (for CI gates)
  --yes               Non-interactive mode (CI-friendly)
  --help, -h          Show help
  --version, -v       Show version

bench init options:
  --kind <kind>         output (default, grades a reply) | command (grades file edits)

bench edit options:
  --set <field=value>   Change fixture, prompt, promptTrigger, verifier, verifierKind,
                       oracle, rubric or shouldTrigger (repeatable)
  --unset <field>       Remove promptTrigger, oracle, rubric or shouldTrigger (repeatable)
                       Edits/removals default to a plan; --yes backs up bench.json and applies

bench add --freeze options:
  --task <id>            Task id (required)
  --prompt <text>        Task prompt, or --prompt-file <path> (required)
  --verifier-cmd <cmd>   Command run in the task run dir; exit 0 = pass
  --expect <string>      Alternative: pass when the agent's final output contains <string>
  --decompose            Draft verifier.mjs + oracle.mjs with an agent (--agent <id>), gated by NOP + oracle checks
  --verifier-kind <k>    With --decompose: output (default, grades _output.md) | command (grades file state)
  --oracle <cmd>         Register an oracle (reference-solution) command for the new task
  --source-dir <dir>     Directory to snapshot as the fixture (default: cwd; git-tracked files only when inside a git repo)
  --should-trigger <yes|no>  Label for trigger-mode evaluation

bench add --from-commit options:
  --task <id>            Task id (default: fix-<short-sha>)
  --source-dir <dir>     Repository to mine (default: cwd)
  --include <dir>        Restrict the fixture to these paths (repeatable; required for large repos)
  --verifier-cmd <cmd>   Override the test command (default: node --test)
  --prompt-file <path>  Use the original issue request instead of the fix commit message

Docs: https://github.com/remote-controlled-man/skillfit
`;

const CLI_OPTIONS = {
  agent: { type: 'string' },
  'judge-agent': { type: 'string' },
  mode: { type: 'string' },
  'baseline-skill': { type: 'string' },
  request: { type: 'string' },
  'plan-sha': { type: 'string' },
  policy: { type: 'string' },
  records: { type: 'string' },
  replay: { type: 'boolean', default: false },
  'compete-installed': { type: 'boolean', default: false },
  input: { type: 'string' },
  bench: { type: 'string' },
  trials: { type: 'string' },
  'max-calls': { type: 'string' },
  profile: { type: 'string' },
  'profile-path': { type: 'string' },
  skill: { type: 'string', multiple: true },
  all: { type: 'boolean', default: false },
  starter: { type: 'boolean', default: false },
  list: { type: 'boolean', default: false },
  'no-rules': { type: 'boolean', default: false },
  'min-sessions': { type: 'string' },
  'upstream-lock': { type: 'string' },
  task: { type: 'string', multiple: true },
  set: { type: 'string', multiple: true },
  unset: { type: 'string', multiple: true },
  export: { type: 'string' },
  'input-root': { type: 'string', multiple: true },
  prompt: { type: 'string' },
  'prompt-file': { type: 'string' },
  freeze: { type: 'boolean', default: false },
  'from-commit': { type: 'string' },
  include: { type: 'string', multiple: true },
  'source-dir': { type: 'string' },
  'verifier-cmd': { type: 'string' },
  expect: { type: 'string' },
  oracle: { type: 'string' },
  decompose: { type: 'boolean', default: false },
  'verifier-kind': { type: 'string' },
  kind: { type: 'string' },
  'should-trigger': { type: 'string' },
  calibrate: { type: 'boolean', default: false },
  json: { type: 'boolean', default: false },
  'dry-run': { type: 'boolean', default: false },
  project: { type: 'boolean', default: false },
  strict: { type: 'boolean', default: false },
  yes: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  version: { type: 'boolean', short: 'v', default: false },
} as const;

function jsonBenchCommand(): string | null {
  const supported = ['check', 'list', 'show', 'edit', 'remove'];
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
  if (values['baseline-skill'] !== undefined && command !== 'eval') {
    throw new Error('--baseline-skill applies only to eval --mode installed.');
  }
  if (values.kind !== undefined && !(command === 'bench' && positionals[1] === 'init')) {
    throw new Error('--kind applies only to bench init.');
  }
  if (values.task !== undefined && command !== 'eval' && !(command === 'bench' && positionals[1] === 'add')) {
    throw new Error('--task applies only to eval or bench add.');
  }
  if ((values.set || values.unset) && !(command === 'bench' && positionals[1] === 'edit')) throw new Error('--set and --unset apply only to bench edit.');
  if (values.export !== undefined && !(command === 'report' && positionals[1] === 'eval')) throw new Error('--export applies only to report eval.');
  if (values['input-root'] && values.export === undefined) throw new Error('--input-root requires report eval --export.');
  if (values.export !== undefined && (values.replay || values.records || values.policy)) throw new Error('--export cannot be combined with --replay, --records or --policy.');
  if (command === 'bench' && positionals[1] === 'add' && values.task && values.task.length !== 1) throw new Error('bench add requires exactly one --task.');
  if (values.request !== undefined && command !== 'eval') throw new Error('--request applies only to eval.');
  if (values['plan-sha'] !== undefined && (command !== 'eval' || values.request === undefined || values['dry-run'])) throw new Error('--plan-sha requires a non-dry-run eval --request.');
  if ((values.policy !== undefined || values.records !== undefined || values.replay) && !(command === 'report' && positionals[1] === 'eval' && values.json)) {
    throw new Error('--policy, --records and --replay require report eval --json.');
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
  if (maxCalls !== undefined && command !== 'eval' && !(command === 'bench' && positionals[1] === 'check' && values.calibrate)) {
    throw new Error('--max-calls applies only to eval or bench check --calibrate.');
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
          if (values.json) throw new Error('report eval --json requires a manifest or native run directory.');
          console.error('Usage: skillfit report eval <manifest.json>');
          process.exitCode = 2;
          return;
        }
        if (values.export !== undefined) {
          const result = await exportEvaluation(positionals[2], values.export, { yes: values.yes, dryRun: values['dry-run'], benchDir: values.bench, inputRoots: values['input-root'],
            log: values.json ? () => {} : undefined });
          if (values.json) console.log(JSON.stringify(result, null, 2));
          return;
        }
        if (values.json) console.log(JSON.stringify(await reportEvalComponent(positionals[2], {
          policyPath: values.policy, recordsPath: values.records, replay: values.replay, benchDir: values.bench,
        }), null, 2));
        else runEvalReport(positionals[2]);
        return;
      }
      await runReport({ agent: values.agent, json: values.json ?? false });
      return;
    case 'eval': {
      if (values.request !== undefined) {
        if (positionals.length !== 1 || ['agent', 'mode', 'baseline-skill', 'bench', 'task', 'trials', 'max-calls', 'input', 'judge-agent'].some(key => values[key as keyof typeof values] !== undefined) || values['compete-installed']) {
          throw new Error('--request cannot be combined with a target or positional eval settings; put settings in the request.');
        }
        const result = await runEvalComponent(values.request, { dryRun: values['dry-run'], expectedPlanSha256: values['plan-sha'], log: line => console.error(line) });
        console.log(JSON.stringify(result, null, 2));
        if (result.status === 'stopped') process.exitCode = failureExitCode(2);
        return;
      }
      if (values.json) throw new Error('eval --json requires --request.');
      const skillPath = positionals[1];
      if (!skillPath) {
        console.error('Usage: skillfit eval <target-path> [--bench <path>] [--trials <n>] [--agent <id>] [--mode <mode>]');
        process.exitCode = 2;
        return;
      }
      const mode = values.mode ?? 'inject';
      if (mode !== 'inject' && mode !== 'installed' && mode !== 'trigger') {
        console.error(`Unknown --mode: ${mode} (expected "inject", "installed" or "trigger")`);
        process.exitCode = 2;
        return;
      }
      await runEval({
        ...common,
        skillPath,
        baselineSkillPath: values['baseline-skill'],
        bench: values.bench,
        taskIds: values.task,
        mode,
        inputMode,
        judgeAgent: values['judge-agent'],
        competeInstalled: values['compete-installed'],
        maxCalls,
        trials,
      });
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
          for (const task of result.tasks) console.log(`${task.id}\t${task.verifierKind}\t${task.oracle ? 'oracle' : 'no oracle'}\t${task.fixture}`);
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
        await runBenchInit({ ...common, dir: positionals[2], kind });
        return;
      }
      if (subcommand === 'check') {
        if (values.json && values.calibrate) throw new Error('bench check --json is offline only; --calibrate cannot be combined with --json.');
        const report = await runBenchCheck({
          dir: positionals[2],
          log: values.json ? () => {} : undefined,
          calibrate: values.calibrate
            ? {
                agent: values.agent,
                inputMode,
                maxCalls,
                dryRun: values['dry-run'] ?? false,
                trials,
              }
            : false,
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
      (process.argv.includes('--json') && process.argv.includes('report') && process.argv.includes('eval'))) {
    console.log(JSON.stringify(componentError(err), null, 2));
    process.exitCode = failureExitCode(2);
    return;
  }
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = failureExitCode(1);
});
