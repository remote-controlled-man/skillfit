#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { runBenchAdd, runBenchCheck, runBenchInit } from './commands/bench.js';
import { runBundleExport } from './commands/bundle.js';
import { runDoctor } from './commands/doctor.js';
import { runEval } from './commands/eval.js';
import { runEvalReport } from './commands/eval-report.js';
import { runInstall } from './commands/install.js';
import { runMcpCheck } from './commands/mcp.js';
import { runReport } from './commands/report.js';
import { runCodexSetup } from './commands/setup.js';

const VERSION = '0.7.0';

const USAGE = `skillfit ${VERSION} — evidence-driven configuration for AI coding agents

Usage:
  skillfit doctor [--agent <id>]            Inspect current agent configuration health
  skillfit report [--agent <id>] [--json]   Skill usage receipts from local session history (read-only)
  skillfit report eval <manifest.json>     Render an existing evaluation as Markdown (read-only)
  skillfit eval <target-path> [options]     A/B-test a Skill, rules, or MCP setup against a bench
  skillfit mcp check <spec.json>            Handshake with a stdio MCP server and audit its tool catalog
  skillfit bench init [dir]                 Scaffold a new bench directory
  skillfit bench check [dir]                Validate a bench offline (verifier self-tests, hygiene)
  skillfit bench check [dir] --calibrate    Plus real baseline-difficulty runs (needs --agent)
  skillfit bench add <dir> --freeze ...     Freeze a real failure into a bench task (see below)
  skillfit bench add <dir> --from-commit <sha>  Mine a fix commit (parent = fixture, fix's tests = verifier)
  skillfit install [options]                Inspect or apply a managed configuration profile
  skillfit setup codex [options]            Select verified upstream Skills and global Codex guidance
  skillfit bundle export <dir> [options]    Export used Codex skills and global guidance as a portable profile

Options:
  --agent <id>        Target agent: claude-code | codex | kimi-code (default: all detected)
  --judge-agent <id>  Drive the blind judge with a local agent CLI (inject mode; prefer a different family than --agent)
  --mode <mode>       Eval mode: inject (default; Skills, rules, MCP) | trigger (Skills only)
  --bench <path>      Bench directory for eval (default: bundled benches)
  --trials <n>        Repetitions per condition for eval (default: 3)
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

Docs: https://github.com/remote-controlled-man/skillfit
`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      agent: { type: 'string' },
      'judge-agent': { type: 'string' },
      mode: { type: 'string' },
      bench: { type: 'string' },
      trials: { type: 'string' },
      profile: { type: 'string' },
      'profile-path': { type: 'string' },
      skill: { type: 'string', multiple: true },
      all: { type: 'boolean', default: false },
      starter: { type: 'boolean', default: false },
      list: { type: 'boolean', default: false },
      'no-rules': { type: 'boolean', default: false },
      'min-sessions': { type: 'string' },
      'upstream-lock': { type: 'string' },
      task: { type: 'string' },
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
      'should-trigger': { type: 'string' },
      calibrate: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      project: { type: 'boolean', default: false },
      strict: { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
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

  const common = {
    agent: values.agent,
    dryRun: values['dry-run'] ?? false,
    yes: values.yes ?? false,
  };

  switch (command) {
    case 'doctor':
      await runDoctor(common);
      return;
    case 'report':
      if (positionals[1] === 'eval') {
        if (!positionals[2]) {
          console.error('Usage: skillfit report eval <manifest.json>');
          process.exitCode = 2;
          return;
        }
        runEvalReport(positionals[2]);
        return;
      }
      await runReport({ agent: values.agent, json: values.json ?? false });
      return;
    case 'eval': {
      const skillPath = positionals[1];
      if (!skillPath) {
        console.error('Usage: skillfit eval <target-path> [--bench <path>] [--trials <n>] [--agent <id>] [--mode <mode>]');
        process.exitCode = 2;
        return;
      }
      const mode = values.mode ?? 'inject';
      if (mode !== 'inject' && mode !== 'trigger') {
        console.error(`Unknown --mode: ${mode} (expected "inject" or "trigger")`);
        process.exitCode = 2;
        return;
      }
      await runEval({
        ...common,
        skillPath,
        bench: values.bench,
        mode,
        judgeAgent: values['judge-agent'],
        trials: values.trials ? Number.parseInt(values.trials, 10) : 3,
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
      if (subcommand === 'init') {
        await runBenchInit({ ...common, dir: positionals[2] });
        return;
      }
      if (subcommand === 'check') {
        const report = await runBenchCheck({
          dir: positionals[2],
          calibrate: values.calibrate
            ? {
                agent: values.agent,
                trials: values.trials ? Number.parseInt(values.trials, 10) : undefined,
              }
            : false,
        });
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
          task: values.task,
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
      console.error('Usage: skillfit bench init [dir] | skillfit bench check [dir] | skillfit bench add <dir> --freeze ...');
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
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
