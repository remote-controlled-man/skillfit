# Security

## What this project touches

skillfit runs agent CLIs and model APIs on your machine. The sensitive surfaces:

- **API keys** read from the environment (`SKILLFIT_API_KEY`, `SKILLFIT_JUDGE_API_KEY`, `OPENAI_API_KEY`) — never logged, never written to `runs/` or any manifest.
- **Local session history** read by `skillfit report` (read-only; nothing leaves the machine).
- **Arbitrary verifier commands** — a bench's verifier is code executed from the bench root; treat third-party benches like third-party code and read their `verifiers/` before running them. Agents run headless inside per-task directories under `runs/`, with fresh git repos and no access to your `~/.gitconfig` identity.
- **Generated command wrappers** — `bench add --freeze --verifier-cmd` embeds a shell command; review it like any script.

skillfit itself ships **zero runtime dependencies**; the supply-chain surface is the TypeScript compiler (devDependency) and the agent CLIs you point it at.

## Reporting a vulnerability

Please do **not** open a public issue for security reports. Email the maintainer via the contact on the
[repository profile](https://github.com/remote-controlled-man) with:

- a description of the issue and affected versions,
- a minimal reproduction (a bench, command, or manifest that demonstrates it),
- whether you are available for follow-up questions.

You will get an acknowledgement within a few days. If the report is confirmed, we fix first, disclose in
the release notes after the fix is out, and credit reporters who want to be named.

## Scope notes

- Prompt-injection resistance of the *agents under test* is out of scope — measuring behavior is the
  point of the tool, and benched agents may be manipulated by fixture content; fixtures are treated as
  untrusted input by the harness (ground truth and verifiers live outside the run directory).
- Issues in upstream agent CLIs belong to their vendors.
