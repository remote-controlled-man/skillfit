#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { runBenchCheck, runBenchInit } from './commands/bench.js';
import { runDoctor } from './commands/doctor.js';
import { runEval } from './commands/eval.js';
import { runInstall } from './commands/install.js';

const VERSION = '0.1.0';

const USAGE = `skillfit ${VERSION} — evidence-driven configuration for AI coding agents

Usage:
  skillfit doctor [--agent <id>]            Inspect current agent configuration health
  skillfit eval <skill-path> [options]      A/B-test a skill against a bench
  skillfit bench init [dir]                 Scaffold a new bench directory
  skillfit bench check [dir]                Validate a bench offline (verifier self-tests, hygiene)
  skillfit install [options]                Install evidence-backed configuration

Options:
  --agent <id>        Target agent: claude-code | codex | kimi-code (default: all detected)
  --mode <mode>       Eval mode: inject (default, skill in prompt) | trigger (skill installed, measure invocation)
  --bench <path>      Bench directory for eval (default: bundled benches)
  --trials <n>        Repetitions per condition for eval (default: 3)
  --profile <name>    Profile for install (default: "recommended")
  --project           Install into the current project instead of user-level config
  --dry-run           Print the plan without writing anything
  --yes               Non-interactive mode (CI-friendly)
  --help, -h          Show help
  --version, -v       Show version

Docs: https://github.com/remote-controlled-man/skillfit
`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      agent: { type: 'string' },
      mode: { type: 'string' },
      bench: { type: 'string' },
      trials: { type: 'string' },
      profile: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      project: { type: 'boolean', default: false },
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
    case 'eval': {
      const skillPath = positionals[1];
      if (!skillPath) {
        console.error('Usage: skillfit eval <skill-path> [--bench <path>] [--trials <n>] [--agent <id>] [--mode <mode>]');
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
        trials: values.trials ? Number.parseInt(values.trials, 10) : 3,
      });
      return;
    }
    case 'install':
      await runInstall({ ...common, profile: values.profile ?? 'recommended', project: values.project ?? false });
      return;
    case 'bench': {
      const subcommand = positionals[1];
      if (subcommand === 'init') {
        await runBenchInit({ ...common, dir: positionals[2] });
        return;
      }
      if (subcommand === 'check') {
        const report = await runBenchCheck({ dir: positionals[2] });
        if (report.failures > 0) process.exitCode = 1;
        return;
      }
      console.error('Usage: skillfit bench init [dir] | skillfit bench check [dir]');
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
