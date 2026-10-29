import { VERSION } from "../shared/version.js";
import { DEFAULT_EVAL_TRIALS } from "./eval.js";

// Help and parseArgs declarations share this CLI-owned source.
export const USAGE = `skillfit ${VERSION} — evidence-driven configuration for AI coding agents

Usage:
  skillfit doctor [--agent <id>]            Inspect current agent configuration health
  skillfit report [--agent <id>] [--json]   Skill usage receipts from local session history (read-only)
  skillfit report eval <summary-or-run-dir>  Read paired, calibration or trigger reports (read-only)
  skillfit report eval <summary-or-run-dir> --json  Return a typed saved-evidence report for an Agent
  skillfit report eval <run-dir> --export <new-dir>  Plan a portable offline replay package
  skillfit eval --request <request.json> --dry-run  Return a pinned JSON plan without calls
  skillfit eval --request <request.json> --plan-sha <sha256>  Run that plan and return JSON evidence
  skillfit eval <target-path> [options]     A/B-test a Skill, rules, or MCP setup against a bench
  skillfit mcp check <spec.json>            Handshake with a stdio or Streamable HTTP MCP server and audit its tool catalog
  skillfit bench init [dir] [--kind output|command]  Scaffold a text-output or code-editing case
  skillfit bench check [path-or-name] [--json]  Validate a local/bundled bench offline
  skillfit bench self-test <path-or-name> [--json]  Check declared synthetic controls through the paired pipeline; zero model calls
  skillfit bench check [path-or-name] --calibrate  Plus real baseline-difficulty runs (needs --agent)
  skillfit bench add <dir> --freeze ...     Freeze a real failure into a bench task (see below)
  skillfit bench add <dir> --from-commit <sha>  Mine a fix commit (parent = fixture, fix's tests = verifier)
  skillfit bench list <path-or-name> [--json]  List local/bundled cases without running verifiers
  skillfit bench show <path-or-name> <task-id> [--json]  Inspect one registered case
  skillfit bench edit <dir> <task-id> --set <field=value>  Plan a manifest edit (apply with --yes)
  skillfit bench remove <dir> <task-id>     Plan to unregister a case, preserving its files
  skillfit install [options]                Inspect or apply a managed configuration profile
  skillfit setup codex [options]            Select verified upstream Skills and global Codex guidance
  skillfit bundle export <dir> [options]    Export used Codex skills and global guidance as a portable profile

Options:
  --agent <id>        Target agent: claude-code | codex | kimi-code (default: all detected)
  --judge-agent <id>  Drive a paired eval's blind judge (prefer a different family than --agent)
  --mode <mode>       Eval mode: inject (default) | installed (paired complete Skill) | trigger (single arm)
  --baseline-skill <path>  With --mode installed, compare a previous Skill version against the target
  --request <path>    Version 1 Skill revision request (JSON output; excludes positional eval options)
  --plan-sha <hash>   Confirm an eval/calibration/self-test dry-run plan (also needs --run-group)
  --json             Machine output for bench check/self-test/list/show/edit/remove, report, eval and calibration
  --spending-budget <file>  Eval/calibration/drafting: input, cachedInput, uncachedInput, output, durationSeconds stop lines
  --executor-timeout-seconds <n|none>  Eval/calibration/drafting: executor deadline (integer 1–3600; none requires Token-only budget)
  --pair-order <order>  Paired eval: baseline-first (default) | balanced
  --runs-root <dir>   Eval/calibration/drafting/self-test output parent (default: ./runs)
  --run-group <name>  Fresh record group; reuse its name when confirming an eval preview
  --policy <path>    With paired report eval, assess against a policy (post-hoc changes cannot authorize adoption)
  --records <dir>    With paired report eval, use native evidence from this run directory
  --replay           With report eval, audit receipts and regrade cloned deliveries; never call a model
  --export <dir>     With report eval, plan a portable package; --yes writes a fresh destination
  --input-root <label=path>  With --export, recover pinned inputs from a matching copy (repeatable)
  --compete-installed With --mode trigger, copy other user-level Skills into each trial so recall is not an upper bound
  --input <mode>      Paired eval or baseline calibration: snapshot (default) | workspace (CLI only)
  --bench <path>      Bench directory for eval (default: bundled benches)
  --task <id>        With eval/calibration, select cases (repeatable, manifest order); requests use taskIds
  --trials <n>        Repetitions per condition for eval (integer 1–20; default: ${DEFAULT_EVAL_TRIALS})
  --max-calls <n>     Call ceiling for eval / bench check --calibrate / bench add --decompose
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
  --schema-version <1|2>  Explicit schema opt-in (default 1; schema 2 starter claims quality)
  --kind <kind>         output (default, grades a reply) | command (grades file edits)

bench self-test options:
  --controls <file>     Controls v1 file relative to the bench (default: controls.json)
  --suite <id>          Select declared suites (repeatable, controls-file order)
                       inject/installed only; trigger/rules/MCP/judge/drafting unsupported
                       JSON execution needs --run-group and the preview's --plan-sha

bench edit options:
  --set <field=value>   Change fixture, prompt, promptTrigger, verifier, verifierKind, verifierTimeoutSeconds,
                       oracle, rubric or shouldTrigger (repeatable)
  --unset <field>       Remove promptTrigger, verifierTimeoutSeconds, oracle, rubric or shouldTrigger (repeatable)
                       Edits/removals default to a plan; --yes backs up bench.json and applies

bench add --freeze options:
  --claim <quality|efficiency|activation>  Repeat for schema 2 tasks; required for freeze/from-commit
  --task <id>            Task id (required)
  --prompt <text>        Task prompt, or --prompt-file <path> (required)
  --verifier-cmd <cmd>   Command run in the task run dir; exit 0 = pass
  --expect <string>      Alternative: pass when the agent's final output contains <string>
  --decompose            Draft verifier.mjs + oracle.mjs with an agent (--agent <id>), gated by NOP + oracle checks
  --verifier-kind <k>    With --decompose: output (default, grades _output.md) | command (grades file state)
  --oracle <cmd>         Register an oracle (reference-solution) command for the new task
  --verifier-timeout-seconds <n>  Each verifier/oracle deadline (integer 1–3600; default: 120)
  --source-dir <dir>     Directory to snapshot as the fixture (default: cwd; git-tracked files only when inside a git repo)
  --include <path>       Select a file/subdirectory (repeatable; required outside Git; no symlinks)
  --should-trigger <yes|no>  Label for trigger-mode evaluation

bench add --from-commit options:
  --task <id>            Task id (default: fix-<short-sha>)
  --source-dir <dir>     Repository to mine (default: cwd)
  --include <dir>        Restrict the fixture to these paths (repeatable; required for large repos)
  --verifier-cmd <cmd>   Override the test command (default: node --test)
  --prompt-file <path>  Use the original issue request instead of the fix commit message

Docs: https://github.com/remote-controlled-man/skillfit
`;

export const CLI_OPTIONS = {
  controls: { type: 'string' },
  suite: { type: 'string', multiple: true },
  agent: { type: 'string' },
  'judge-agent': { type: 'string' },
  mode: { type: 'string' },
  'baseline-skill': { type: 'string' },
  request: { type: 'string' },
  'plan-sha': { type: 'string' },
  'spending-budget': { type: 'string' },
  'executor-timeout-seconds': { type: 'string' },
  'pair-order': { type: 'string' },
  'runs-root': { type: 'string' },
  'run-group': { type: 'string' },
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
  'verifier-timeout-seconds': { type: 'string' },
  kind: { type: 'string' },
  'schema-version': { type: 'string' },
  claim: { type: 'string', multiple: true },
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
