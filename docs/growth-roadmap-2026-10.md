# skillfit: adoption and evidence roadmap (October 2026)

## Goal and current position

Make it easy for someone who has never seen skillfit to reach a trustworthy, repeatable result,
then make that result useful to a team. Stars are an outcome to observe, not an acceptance test.

The product already has paired evaluations, deterministic bench gates, trigger measurements,
configuration experiments, an MCP preflight, and five README languages. The main adoption gap is the
path from a fresh clone to understanding what was measured: the package has not been published, live
evaluations need a local agent or API key, and the first offline check is easy to mistake for an
agent-quality result. The README also mixes cross-platform Node commands with Bash-only setup and
POSIX copy commands.

Patterns worth borrowing, without copying their claims:

| Project | Observable practice | skillfit decision |
|---|---|
| [Vercel Skills](https://github.com/vercel-labs/skills) | Short install and list paths make a first action obvious | Keep one short, copyable path from clone to an offline result; label commands that need an agent |
| [Promptfoo Action](https://github.com/promptfoo/promptfoo-action) | Evaluation can run in a pull request and leave a workflow summary | Add an opt-in, offline CI recipe before attempting hosted or paid evaluation |
| [Aider benchmark](https://github.com/Aider-AI/aider/blob/main/benchmark/README.md) | Published results carry model, command, version, and commit context | Export readable reports from pinned run manifests; keep provenance and limitations beside scores |

## Delivery order

### 0. Establish a reliable baseline — shipped

- Merge the rules/MCP experiment and documentation review in PR #6.
- Require the same offline suite, bench checks, and CLI smoke tests on macOS, Linux, and Windows.
- Keep the Codex disposable-project trust override scoped to each MCP trial.

Acceptance: all three CI operating-system jobs pass on the merged change. No live model call is part
of CI.

### 1. Make the first ten minutes work on every supported OS

- Make the five README quick starts use commands that work in Bash and PowerShell after cloning.
- Separate offline verification, local-agent evaluation, and installation so a new user knows which
  commands need credentials, network access, or file writes.
- Provide native Node CLI commands for selectable Codex setup; document the Bash convenience script
  as an alternative.
- Add a concise repository description, homepage, and focused topics on GitHub.

Acceptance: a fresh clone can run `npm ci`, build, inspect the CLI, and check both bundled benches on
macOS, Linux, and Windows. The README's first path needs no model API. The five languages preserve
the same command blocks. No package publication is required.

### 2. Turn a run into a shareable review artifact

- Add a read-only command that renders an existing evaluation manifest as Markdown with its target,
  bench hash, executor, trial count, verdict, uncertainty, and warnings. The JSON manifest remains the
  canonical machine-readable record.
- Include a small, clearly synthetic example and a real-run example in the documentation. Do not
  present mock results as evidence that a Skill helps.
- Add an opt-in GitHub Actions recipe that validates a contributed bench offline and uploads a
  Markdown summary. It must not require an API key or call a real agent.

Acceptance: the rendered report can be reproduced from the same manifest without rerunning an agent;
missing or old fields are handled explicitly; CI stays offline and passes on all three systems.

### 3. Make community evidence auditable

- Give contributors a compact bench/evidence submission path: required fixture, verifier, oracle,
  pinned configuration, model identity, and limitations.
- Review evidence submissions against the published metrics protocol before adding dated evidence
  entries. Corrections to published evidence become new dated entries.
- Publish one maintained example that a reader can reproduce locally, with an honest statement about
  its scope and cost.

Acceptance: a first-time contributor can run the two offline bench gates and submit a complete issue
or PR without private paths or tokens. New efficacy claims link to a dated evidence entry and a
reviewed, shareable manifest. Older entries whose raw manifests remain local are labeled as such.

## Later decisions, after adoption evidence

- npm publication is deferred until the clone-based path and package contents are verified. Do not
  advertise `npx skillfit` before a package exists.
- More agent adapters, HTTP MCP transport, and a hosted dashboard need real demand and their own
  compatibility tests. They should not delay the first-run and reporting work.
- Track useful signals: clean-clone success on three operating systems, bench-check completions,
  reproducible evidence contributions, and issue-to-fix time. Do not optimize the product for a star
  count alone.

The hard boundaries remain: zero runtime dependencies, offline tests, English CLI output, no writes
without a plan/backup/verification, and no access to the private `workspace4skills/` lab.
