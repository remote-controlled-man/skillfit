# Security

## What this project touches

skillfit runs agent CLIs and model APIs on your machine. The sensitive surfaces:

- **API keys** read from the environment (`SKILLFIT_API_KEY`, `SKILLFIT_JUDGE_API_KEY`, `OPENAI_API_KEY`) — never logged, never written to `runs/` or any manifest.
- **Local session history** read by `skillfit report` (read-only; nothing leaves the machine).
- **Arbitrary verifier commands** — a bench's verifier is code executed from the bench root; treat third-party benches like third-party code and read their `verifiers/` before running them. Agents run headless inside per-task directories under `runs/`, with fresh git repos and no access to your `~/.gitconfig` identity.
- **Generated command wrappers** — `bench add --freeze --verifier-cmd` embeds a shell command; review it like any script. The string is written into `verifiers/<task-id>.mjs` and re-executed with `shell: true` on every later `bench check` and `eval`, so it outlives the command that created it; `bench add` logs that before writing, in both the dry-run and the real path, because the scripted `--yes` case is the one where nobody reads a prompt.
- **Agent command templates** — `src/matrix/agents.json` supplies the argv that agent CLIs are spawned with, through a shell. Editing the matrix is editing what runs on your machine. Arguments containing shell metacharacters (`; & | < > ` `` ` `` $`, newline) are refused rather than quoted, because no single quoting scheme is correct for both POSIX shells and `cmd.exe`; parentheses and backslashes are allowed so Windows paths and `node -e` expressions still work.
- **Bench-relative paths** — `bench.json` paths are checked to stay inside the bench directory, but the check compares path segments rather than resolving symlinks, so a symlink *inside* a bench can point outside it. Benches are authored content under the same trust model as verifiers.
- **Judge prompts** — the agent output shown to an optional LLM judge is untrusted and is a prompt-injection surface. Answers are fenced behind a per-call random nonce and marked as data, and the checklist is read from the *last* JSON object in the judge's reply so an echoed block cannot take the verdict. This raises the cost of a deliberate attack; it does not make an untrusted judge trustworthy, and the judge never flips a pass/fail verdict.

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
