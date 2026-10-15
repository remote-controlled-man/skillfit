# Case workflow and 0.10.0 delivery

The user authorized all four proposed items and a new npm release on October 16,
2026. Real model/agent calls remain unauthorized. Tests use injected executors.

1. Add repeatable `eval --task <id>` and optional request `taskIds`. Reject empty,
   duplicate or unknown selections before calls. Preserve bench order, full input
   hashes, selected IDs, exact call budgets and small-sample restrictions.
2. Add `bench list/show/edit/remove`, including JSON. Edits/removals preview by
   default and apply only with `--yes`, back up the manifest and verify/roll back.
   Removal unregisters the task and preserves shared assets. Add a real task
   before removing the last teaching task; bench schema 1 stays nonempty.
3. Add `report eval <run> --export <dir>`. Preview by default; fresh, collision-
   protected output after `--yes`. Verify original sealed evidence and required
   pinned inputs before copying. Include a hash inventory, pinned implementation,
   bench/Skill inputs and an offline replay entry point. Never rewrite original
   receipts, invent unknown costs, run an agent, or upload the contents. Missing
   inputs prevent a supposedly complete export. Explicit replay executes trusted
   local verifiers only; exported project data needs review before sharing.
4. Update contracts, bilingual documentation and roadmap, test offline, merge
   after Linux/macOS/Windows CI, then prepare the exact 0.10.0 archive through
   the existing manual OIDC dry run. Publish once, verify registry bytes and an
   isolated install, and retain release receipts. An accepted upload must not be
   repeated if publication scanning delays registry availability.

Completion requires the implemented commands, meaningful regression tests,
green `npm test`, offline bench checks, a fresh-directory portable replay test,
remote synchronization, and a verified npm installation. No new Skill efficacy
claim or automatic upgrade is part of this work. Published evidence and private
lab contents remain untouched.
