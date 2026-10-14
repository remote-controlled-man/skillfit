<div align="center">

<img src="docs/assets/skillfit-mark.svg" alt="skillfit logo" width="96" />

# skillfit

**Skill registries tell you what's popular. skillfit tells you what actually works.**

Measure whether a skill, rules file, or MCP setup improves *your* agent on *your* tasks —<br/>
then install only what survives the experiment.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![CI](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml/badge.svg)](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-blue)](package.json)
[![GitHub stars](https://img.shields.io/github/stars/remote-controlled-man/skillfit?style=flat)](https://github.com/remote-controlled-man/skillfit/stargazers)

[English](README.md) · [简体中文](README.zh-CN.md)

[Quick start](#quick-start) · [Bench guide](benches/README.md) · [Metrics protocol](docs/metrics.md) · [Evidence](evidence/)

</div>

<p align="center">
  <img src="docs/assets/skillfit-flow.en.svg" alt="The same task runs with baseline and treatment configurations before skillfit compares outcomes, token use, and uncertainty" width="100%" />
</p>

---

## Why

The agent-config ecosystem has solved **distribution** (`npx skills add`, plugin marketplaces, MCP registries) but not **selection**. The evidence says unverified configuration can hurt:

- Curated skills improve pass rates by **+16.6pp** on average — but agent-self-generated skills score **−1.3pp**, and focused skills beat large bundles ([SkillsBench, arXiv:2602.12670](https://arxiv.org/abs/2602.12670))
- LLM-generated context files scored **−3%** while raising inference cost by 20%+ ([ETH Zurich, arXiv:2602.11988](https://arxiv.org/abs/2602.11988))
- 36% of scanned public skills contain prompt injection ([Snyk ToxicSkills, 2026-02](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/))

skillfit is the missing measurement layer: paired A/B experiments with deterministic verifiers, statistical verdicts, and trigger-rate measurement — packaged as a CLI anyone can run.

## What you get

A real run, measuring whether an agent even *bothers to load* a skill when it is installed but not mentioned:

```console
$ node dist/cli.js eval ./skills/code-review --mode trigger --bench code-review --agent kimi-code

TASK        FIRE?  FIRED    UNKNOWN  ERRORS  PASS
review-r1   yes    1/3      0        0       3/3
review-r2   yes    0/3      0        0       3/3
review-r3   yes    0/3      0        0       3/3
explain-x1  no     0/3      0        0       3/3

Trigger recall      : 1/9 (11%) [95% CI 2%–44%]
False-trigger rate  : 0/3 (0%) [95% CI 0%–56%]
Precision           : 1/1 (100%) [95% CI 21%–100%]
F1                  : 0.20 (no CI: a harmonic mean of two proportions has no closed-form binomial interval)
```

The skill fired once in nine in-domain tasks — and the tasks pass 3/3 without it. That is a verdict no registry can give you.

<sub>Captured 2026-09-22 on Kimi Code against the four-task `code-review` bench. The bench has since gained a fifth task; the four metric lines above are re-rendered from that run's recorded per-task counts, so the run is real and the formatting is current.</sub>

## Install

```bash
npx skillfit@0.9.0 --help
npx skillfit@0.9.0 doctor
```

`npx skillfit` installs the published release and needs Node.js 22 or newer. The quick start below uses a source checkout so you can run the benches that ship in this repository. After `npm run build`, `node dist/cli.js` is that checkout's CLI. `skillfit` is the command installed from npm.

## Quick start

```bash
git clone https://github.com/remote-controlled-man/skillfit.git
cd skillfit
npm ci
npm run build
node dist/cli.js --help
node dist/cli.js bench check benches/code-review
node dist/cli.js bench check benches/debugging
node dist/cli.js doctor
node dist/cli.js eval skills/skillfit --bench code-review --agent codex --dry-run
node dist/cli.js install --agent codex --dry-run
```

The bench checks are offline integrity checks, not agent-quality scores. `doctor` is read-only; the eval and install commands above only print plans. `codex` is an example agent ID; replace it with yours. A real eval needs your own Skill and bench plus a local agent CLI or API credentials. The setup commands below work in Bash and PowerShell; selecting upstream Skills needs network access, and only `--yes` installs them.

`eval` now defaults to **5 trials per condition**. With 8 tasks, a paired experiment makes 80 agent executions. Five trials are a starting point; representative tasks and a healthy baseline matter as much as repetition. Inspect the dry-run count and follow [your first real evaluation](docs/first-real-eval.md) before making an efficacy claim.

For eval and baseline calibration, `--trials` must be an integer from 1 to 20. Fractional, malformed, or out-of-range values are rejected before any run or bench check starts.

Use `--max-calls <n>` for eval or baseline calibration to reject plans above a call ceiling (including enabled judges). New runs retain a frozen plan, call ledger, session state and artifact hashes; input/config drift or executor failures stop further calls. Partial runs cannot support an installation recommendation. Follow the [bounded experiment workflow](docs/experiment-workflow.md), including its environment limits.

Supported agents: **Claude Code**, **OpenAI Codex CLI**, **Kimi Code** ([capability matrix](src/matrix/agents.json) — machine-readable, dated, doc-linked). Trigger-mode capture is currently verified for Kimi Code and Codex CLI.

## Evaluate a real OSS task

Use `--input workspace` for paired CLI runs that inspect and edit files on disk,
without an inline repository snapshot. Keep the same input mode for baseline
calibration. `snapshot` remains the default; workspace input is unavailable for
API executors and is separate from `--mode trigger`.

```bash
node dist/cli.js eval <skill-dir> --bench <bench-dir> --agent codex --input workspace --trials 5 --dry-run
node dist/cli.js bench check <bench-dir> --calibrate --agent codex --input workspace --trials 3 --dry-run
```

When importing a fix, `bench add --from-commit <sha> --prompt-file issue.md` keeps
the issue request instead of revealing the fix message. Reports show per-check
results, usage coverage and installation evidence gaps. A single task informs
that task; it does not prove general benefit. Follow the [real OSS workflow](docs/oss-task-evaluation.md)
or replay the [pinned mcp-use example](benches/contrib/oss-mcp-use-utf8/README.md).

## Compare Skill revisions

Use `--baseline-skill` with `--mode installed` to compare a previous complete Skill against a revised version. Both must have the same `SKILL.md` frontmatter name and different content fingerprints. Baseline receives the previous version; treatment receives the target version, with identical natural task prompts and independent outcome verifiers. Plans, manifests and trial receipts pin both versions, including scripts and binary resources. A change to either source stops further calls. The comparison measures revision effects; installation benefit still needs a separate no-Skill baseline. See [the revision workflow](docs/skill-revisions.md).

```bash
node dist/cli.js eval ./skill-new --baseline-skill ./skill-old --mode installed --bench ./my-bench --agent codex --trials 5 --dry-run
```

## Agent evaluation component

New installed evaluations provide the same native untracked-file diff helper in both arms. Use `node _skillfit/native-diff.cjs <file>` to display a patch without output filtering. The plan and evidence pin the helper version and content; a modified helper stops further calls. This corrects the common evaluation environment, not the Skill. Old runs keep their original environment, and delivery does not prove the agent used the helper.

Use a version 1 JSON request to call the existing Skill revision engine from an Agent. A read-only preview pins inputs and the policy; execution requires its plan hash. JSON results retain improvements, regressions, all-invocation costs and evidence coverage. A separate policy returns `accept`, `reject` or `inconclusive`; insufficient evidence cannot authorize adoption, and the component never upgrades a Skill. This interface is included in [0.9.0](docs/releases/0.9.0.md), available from npm or a source checkout. See [the input/output and policy contract](docs/eval-component.md).

For new cost comparisons, set `pairOrder: "balanced"` in the request to alternate which version runs first. The plan freezes the order and offline assessment verifies the invocation ledger; paired statistical formulas remain unchanged.

The default policy requires a demonstrated quality gain. An explicit version-2 `efficiency` policy can accept stable uncached-input savings with no observed correctness regression; a quality tie keeps its `inconclusive` verdict. Both objectives require independent validation, complete evidence and spending coverage. See the [predeclared cost example](docs/examples/eval-request.diagnosing-v2-efficiency.json).

Requests can also pin `executorTimeoutSeconds` (default 600) for both versions. A changed deadline requires a new plan and batch; previous timeouts and their available spending remain in the evidence.

Failed Codex JSON calls can retain identity-bound partial usage from local numeric counters. Private transcript bodies stay out of exports, and partial usage never satisfies the final-cost or adoption gates.

```bash
node dist/cli.js eval --request ./request.json --dry-run
node dist/cli.js eval --request ./request.json --plan-sha <plan.sha256>
node dist/cli.js report eval ./runs/revision-validation-001 --json --replay
```

## Test rules and MCP setups

Put a `skillfit-experiment.json` next to baseline and treatment project overlays. A rules experiment can add `AGENTS.md`; an MCP experiment can add `.codex/config.toml`, `.mcp.json`, or the path defined for another supported agent. skillfit copies the same task fixture into both arms, snapshots it for an identical prompt, then applies each overlay so the local agent discovers configuration through its normal loader.

```text
context7-experiment/
├── skillfit-experiment.json
├── baseline/.codex/config.toml
└── treatment/.codex/config.toml
```

```bash
node dist/cli.js eval ./context7-experiment --bench ./my-context7-bench --agent codex --trials 5 --dry-run
node dist/cli.js eval ./context7-experiment --bench ./my-context7-bench --agent codex --trials 5
```

Start with `skillfit mcp check` to verify a stdio server or a Streamable HTTP endpoint and its tool catalog. It requests `tools/list` and audits names, descriptions, input schemas, and annotations without calling a tool. Then run the paired experiment to measure whether the model selects the server correctly and whether task outcomes improve. See [Rules and MCP experiments](docs/config-experiments.md).

For Codex MCP trials, skillfit passes a per-run trust override so the disposable project config loads without changing your Codex user config.

## Share an evaluation

Try the synthetic example below, then replace its path with the `Manifest:` path printed by your own paired `eval` run. The report includes provenance, uncertainty, errors, and warnings; it does not rerun the agent. See [sharing results](docs/sharing-results.md).

```bash
node dist/cli.js report eval docs/examples/eval-manifest.synthetic.json
```

New reports separate cached and uncached input, output, and elapsed time, with spending per successful task that includes failed runs. They show surviving pairs alongside all agent invocations, and mark partial or missing timeout usage instead of treating it as zero. Older manifests identify these fields as unrecorded. See [cost accounting](docs/eval-costs.md).

The latest [debugging development record](evidence/2026-10-13-debugging-completed-development.md) retains a rejected candidate, one concrete repair and increased total costs; [stopped cohorts](evidence/2026-10-13-debugging-development-stops.md) preserve errors and partial spending. Neither establishes stable improvement or authorizes an upgrade.

[Known regression controls and the first validation interruption](evidence/2026-10-13-debugging-controls-and-sleep-stop.md) retain LRU point savings, a normalize-url cost regression and a diagnosed sleep gap. All 16 completed deliveries replay offline; the interrupted invocation keeps its partial cost and receives no grade. A fresh fixed validation batch remains separate.

The [completed independent validation](evidence/2026-10-14-debugging-independent-validation.md) retains 80 real executions: both versions pass 40/40, while compact v4 reduces aggregate uncached input 16.82%, output 16.64% and time 17.48%. Its 95% uncached-input interval supports 7.69%–26.26% savings, below the declared minimum of 10% at the conservative bound. Adoption remains `inconclusive` and ineligible. Individual cost increases, all 125 study calls and a zero-model offline replay remain visible.

The [prospective followup tasks](benches/contrib/oss-skill-followup/README.md) pin eight different defects in three new repositories, with original failures, complete maintainer passes and protected regression witnesses. The [separate bounded protocol](docs/plans/2026-10-14-skill-followup.md) keeps v4 and the 10% requirement unchanged, caps this followup at 80 calls and cumulative spending at 205, and never pools earlier quality results. Offline integrity checks establish task validity, not Skill improvement.

The [stopped followup record](evidence/2026-10-14-debugging-followup-routing-stop.md) retains 46 exact offline regrades, a 47th-call CLI routing failure and 33 uninvoked entries. Timing and power are normal, but the failed token cost remains unknown; no completed prefix authorizes adoption. Individual cost increases and all 172 cumulative executor calls remain visible.

The [subsequent spending stop](evidence/2026-10-14-debugging-spending-stop.md) retains a separate readiness check and one user-interrupted recovery invocation, bringing actual cumulative spending to 174 calls. The remaining 79 entries are uninvoked. Its offline archive reproduces partial-cost lower bounds and keeps the unattested local readiness counter separate; no new quality gain, eligibility or automatic upgrade is claimed.

The [four-call reading pilot and cost review](evidence/2026-10-14-debugging-reading-pilot-and-cost-review.md) brings cumulative spending to 178 calls. All four deliveries pass, but the reading draft increases uncached input 34.35%, output 10.16% and time 13.60%, so it is rejected. A post-hoc review corrects 50 literal-empty diffs to 19 missing patches and 31 valid check-only results; the merged common diff helper has offline verification, while actual Agent use and net savings remain untested. A narrowed draft remains unvalidated. The [ordered delivery plan](docs/plans/2026-10-14-evidence-and-release-sequence.md) puts evidence and release preparation before any newly authorized experiment.

## Selectable Codex setup

From a fresh clone, inspect the source catalog of 67 installable Skills with `--list`, then use repeated `--skill` flags to select only those relevant to your tasks. The seven retired local Skills are listed with reasons. `--starter` preserves the original 13-Skill selection, which has not been evaluated as a set; `--all` selects all 67 and is not a recommended default. The catalog checks sources and installation, not efficacy: only eight entries have limited historical paired tests, and none has proven benefit for the current pinned Skill versions and Codex model. The setup command fetches selected third-party Skills from pinned author commits, verifies SHA-256 hashes, and plans a managed global `AGENTS.md` block. The two locally authored Skills live in this repository. See the [selectable setup guide and evidence summary](docs/selectable-codex.md).

```bash
node dist/cli.js setup codex --list
node dist/cli.js setup codex --skill vibe-coding --skill diagnosing-bugs
node dist/cli.js setup codex --skill vibe-coding --skill diagnosing-bugs --yes
```

## Portable Codex setup

Export the user-level Skills seen in at least two Codex sessions and your active global guidance. Transfer the resulting directory to a new machine, then install it there. See [the portable setup guide](docs/portable-codex.md) for scope and options.

```bash
node dist/cli.js bundle export ./personal-codex --dry-run
node dist/cli.js bundle export ./personal-codex --yes
# transfer the personal-codex directory to the new machine
node ./personal-codex/setup.mjs --dry-run
node ./personal-codex/setup.mjs --yes
```

To export the full 65-Skill upstream source catalog, add `--upstream-lock ./profiles/codex-upstream-sources.json`. Setup then downloads those Skills from pinned author commits and verifies each file; locally authored Skills stay in the bundle. For a smaller new environment, use the selectable setup above. See the [source audit](docs/codex-upstream-audit.md).

## The eight commands

| Command | What it does | Writes? |
|---|---|---|
| `doctor` | Detects installed agents, checks rules bloat, skill validity/conflicts, MCP declaration presence and JSON syntax where supported, and silent-failure traps (e.g. AGENTS.md that Claude Code never reads) | Never |
| `report` | Skill usage receipts from retained local session history: fires per skill, candidates with no observed fire, and raw catalog size before agent-side limits. Absence is a prioritization signal, not proof of uselessness. It also renders an existing evaluation manifest as Markdown with `report eval`. | Never |
| `eval <target>` | Paired baseline/treatment runs for a Skill, rules overlay, or MCP overlay; deterministic verifier + optional blind LLM judge, token-cost delta, McNemar exact test, paired bootstrap CI, and graded facet-score CIs. `--mode trigger` installs a Skill and measures trigger recall / false-trigger rate from the agent transcript | `runs/` locally |
| `mcp check <spec>` | Handshakes with a stdio MCP server or a Streamable HTTP endpoint, requests `tools/list`, and audits tool names, descriptions, input schemas, and annotations. Never calls a tool | Never |
| `bench` | `init` scaffolds a bench directory with a working example task; `check` validates a bench offline (verifier self-tests, oracle/NOP gates, mock-arm probes, fixture hygiene, trigger-label coverage); `add --freeze` turns a failure you just watched into a permanent bench task, and `--decompose` has an agent draft the verifier + oracle, admitted only if both gates pass | `init`/`add` after confirmation; `check` never |
| `install` | Managed-block rules (`<!-- SKILLFIT_START/END -->`, idempotent), skill copy with conflict protection, content-hash lockfile, post-install verification. Writes are staged first; if a write or verification fails, the installer rolls back changed target files, including the lockfile. Abrupt termination can still leave a partial install; re-run to reconcile. Your original is kept at `<file>.skillfit-bak` and the first backup wins, so later updates cannot overwrite it. `--dry-run` reports conflicts and exits 0; add `--strict` to make them fail (CI gates) | Only after confirmation |
| `setup codex` | Lists or installs a chosen set of pinned, verified upstream Skills and repository-owned Skills with global routing guidance; defaults to a dry run | Only with `--yes` |
| `bundle` | `export` creates a portable Codex profile from used local Skills and active global guidance | Only after confirmation |

## Bring your own bench

Evals are only as good as their tasks. A bench is just a directory — `bench.json` + fixtures + a deterministic verifier. Scaffold one with `node dist/cli.js bench init`, freeze a real failure you just watched your agent botch with `node dist/cli.js bench add <bench> --freeze`, validate offline with `node dist/cli.js bench check`, and model it on your own production scenarios: [benches/README.md](benches/README.md). If you have never written one, start with [docs/bench-authoring.md](docs/bench-authoring.md) — it walks the seven steps end to end on a single real task, and covers the ways a bench produces confident wrong numbers.

## Our own data

We ran skillfit's harness on 8 popular workflow skills (24 baseline/treatment pairs, Codex CLI, frozen 2026-07 baseline). One showed a limited regression-test artifact signal in 2/3 treated runs; no Skill showed a robust task-quality gain. These runs do not validate the current 67-Skill catalog or the legacy 13-Skill set, and a run the report labels indicative is not an installation recommendation:

| Skill | Quality Δ | Input tokens | Verdict |
|---|---:|---:|---|
| `diagnosing-bugs` | +66.7pp test-asset gain (2/3 runs); task quality unchanged | +11.7% | Limited historical process signal |
| `code-review` | +3.3pp (unstable) | +9.1% | Not enough evidence |
| `tdd` | 0.00pp | +9.2% | No measurable gain |
| `doubt-driven-development` | 0.00pp | +20.7% | No measurable gain |
| `security-and-hardening` | 0.00pp | +27.4% | No measurable gain, highest cost |
| 3 more | 0.00pp | +14.7~17.0% | No measurable gain |

Read the dated reports in [evidence/](evidence/). Some historical raw manifests remain local to their original runs; the evidence index identifies those limits. Reproduce a result on your own pinned Skill, agent, and bench with `skillfit eval`.

## Design principles

- **Standards, not formats.** AGENTS.md (AAIF), SKILL.md, `.agents/skills/`, `.mcpb` — we write what agents already read.
- **Deny by default.** We install only what a profile explicitly declares, pinned by content hash.
- **Dry-run first.** Every write command prints its plan before touching a file. Backups always.
- **Honest numbers.** New efficacy submissions need a pinned, shareable manifest; some older reports lack downloadable raw manifests. Verdict semantics are frozen in [docs/metrics.md](docs/metrics.md): significance comes from an exact McNemar test over discordant pairs, deltas carry paired-bootstrap CIs, and runs below 8 tasks × 5 trials are labeled *indicative* even if their within-bench verdict is statistically significant.

## Disclaimer

Not affiliated with Anthropic, OpenAI, Moonshot AI, or any agent vendor. Evaluation results depend on model version, harness, and tasks — treat them as dated evidence, not eternal truth.

## Roadmap

[October 2026 delivery plan](docs/growth-roadmap-2026-10.md)

- [x] doctor / eval / install core loop
- [x] Paired A/B harness with blind judging
- [x] Statistical verdicts (McNemar exact + paired bootstrap CI, manifest v4)
- [x] Trigger rates for one Skill alone (`--mode trigger` on Kimi Code and Codex CLI: recall, false-trigger rate, Wilson CIs). Recall is an upper bound until that Skill competes with a real installed set. Codex detection is a `SKILL.md` read, not a Skill-invocation event.
- [x] Bench scaffolding (`bench init` + `bench check`), failure freezing (`--freeze`), git-history mining (`--from-commit`), difficulty calibration (`--calibrate`). `bench check` is an offline integrity check, not an agent-quality score.
- [x] Rules and MCP workspace A/B experiments with identical prompts
- [x] Read-only stdio MCP handshake and tool-catalog audit
- [ ] Claude Code trigger capture, machine-verified (blocked: needs working auth)
- [x] Optional `triggerClass` (`explicit`, `implicit`, `contextual`) on positive tasks. Unlabeled tasks stay in the pooled recall.
- [x] `--compete-installed` copies other user-level Skills into a trigger trial. System Skills and plugins outside the matrix directories are not copied. `installed` reports a long-body read separately from the task result; that read is not trigger recall.
- [ ] An installation recommendation. The July 2026 eight-skill study found no robust task-quality gain. The 67-Skill catalog and the 13-Skill starter set are not evaluated as sets.
- [x] npm publication (`skillfit@0.9.0`). `npx skillfit` installs that release. Clone, `npm ci`, and `npm run build` remain valid.
- [x] Community bench and evidence submissions. Benches go in `benches/contrib`; evidence uses the Evidence submission issue template. CI runs the offline gates and does not call an agent.
- [ ] Cursor / Gemini CLI / OpenCode adapters
- [x] Streamable HTTP MCP preflight (`mcp check` transport `http`). It does not call a tool.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The highest-value contribution is a bench built from your real workflow. Evidence submissions use the Evidence submission issue template: a pinned bench, a `bench check` summary, the exact command, and a reviewed manifest. Unverifiable percentages are not accepted. Release notes live in [CHANGELOG.md](CHANGELOG.md); security reports go to [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
