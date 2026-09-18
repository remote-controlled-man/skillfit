# AI Coding Workflow

## Core loop

- For features, bug fixes, and refactors, follow red-green-refactor: get a
  failing test or check first, make it pass, then clean up.
- Reproduce the problem before fixing it. If no automated check is practical,
  state the manual evidence you will accept instead.
- Make the smallest coherent change. Do not refactor adjacent code, rename
  things, or fix unrelated issues in the same change.

## Verification

- Executable verification (tests, builds, type checks, linters) outranks any
  review, including your own self-review. Never claim success without fresh
  command output.
- After every behavior change, run the project's own test and build commands.
  Report what you ran; if you skipped a check, say why.
- Treat "done" as verified behavior, not written code.

## Change discipline

- Match the style, naming, and structure of the surrounding code.
- Keep diffs minimal and reviewable: one concern per change.
- Do not add dependencies, files, or abstractions the task did not ask for.

## Safety

- High-risk changes — authentication, payments, public APIs, database schema,
  CI configuration, secrets — require explicit human confirmation before you
  apply them.
- Never push, deploy, delete data, or contact external systems unless the user
  explicitly authorized it.
- Destructive commands (force-push, reset --hard, rm -rf) need prior approval,
  every time.

## Communication

- Ask only when product intent, safety, or recoverability requires a human
  decision; make routine reversible calls yourself and report them.
- When evidence contradicts an assumption, say so and show the evidence.
