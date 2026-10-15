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

## Completion record

- [PR #26](https://github.com/remote-controlled-man/skillfit/pull/26) merged at
  `9027d8d80a3974c7e352af10e8ede3029c69205b`: all three feature groups, contracts,
  mirrored READMEs, driver Skill and 0.10.0 preparation; 600 offline tests and
  Linux/macOS/Windows CI passed. The merged feature branch was cleaned up.
- [OIDC preview](https://github.com/remote-controlled-man/skillfit/actions/runs/38777935270)
  and [one real publication](https://github.com/remote-controlled-man/skillfit/actions/runs/38778295053)
  passed. Registry/latest 0.10.0 and every one of 2,609 installed files match the
  previewed archive. The 23 initial unavailable-version reads remain in the
  original CI receipt; no upload was repeated.
- [Independent installed-feature checks](../releases/0.10.0-feature-smoke.json)
  passed, including moved-package replay after originals are removed and exact
  retained costs. Registry signature/attestation passed. See the
  [release receipt](../releases/0.10.0-verification.json) and executable recipe.
- Actual model/agent evaluation calls added: zero. Historical study totals,
  unknown final usage, immutable evidence and private lab contents are unchanged.
  Partial/stopped evidence cannot authorize an upgrade; no upgrade is automatic.
