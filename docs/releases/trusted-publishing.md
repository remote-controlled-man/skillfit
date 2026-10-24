# Manual npm releases from GitHub Actions

The `npm release` workflow is manual, runs only from `main` in
`remote-controlled-man/skillfit`, and defaults to a dry run. It uses the
`npm-release` GitHub environment and npm OIDC authentication. No model or agent
invocation is part of the workflow.

## Configuration

The environment must allow deployments only from the `main` branch. Configure
the npm trusted publisher with these exact values:

| Field | Value |
| --- | --- |
| Package | `skillfit` |
| Provider | GitHub Actions |
| Repository | `remote-controlled-man/skillfit` |
| Workflow filename | `npm-release.yml` |
| Environment | `npm-release` |
| Allowed action | Direct `npm publish` |

The existing npm CLI can preview this binding without writing it:

```bash
npm trust github skillfit --repo remote-controlled-man/skillfit --file npm-release.yml --env npm-release --allow-publish --dry-run
```

Create the actual binding with the same command without `--dry-run`, using
npm's required two-factor authentication, and verify with `npm trust list
skillfit`. Existing trusted publishers must be inspected before any change.

New bindings need their first successful publish within two days or they expire.
Create a binding when a reviewed new version is ready. Saving a binding or
running a dry run does not verify OIDC publication. See
[npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

## Release procedure

1. Prepare and review a new stable version, matching both lockfile version fields
   and current command documents. Existing versions cannot be uploaded again.
2. Merge through the normal PR checks and wait for the exact main commit's full
   three-system CI. The release gate reads its structured results, job conclusions,
   repository, source and attempt. Missing evidence, record-only CI or an unfinished
   run blocks preparation with the source run link. It does not repeatedly poll CI.
3. Start the default preview. It compiles and packs once, applies the package and
   current-document policy, and records the exact archive SHA-256/integrity, source
   and CI evidence. Source tests already ran in CI and are not repeated here.

```bash
gh workflow run npm-release.yml --repo remote-controlled-man/skillfit --ref main -f dry_run=true
```

Use the run ID from Actions/the dispatch result. One command can wait without
repeated agent queries; the final exit code is significant:

```bash
gh run watch <run-id> --repo remote-controlled-man/skillfit --interval 60 --exit-status
```

The preview summary provides the exact run/attempt, archive digest and next
command. Review that artifact before authorizing publication. Main must still
have the same source; a later preview rerun must not silently replace the reviewed
attempt. A formal run requires both explicit values:

```bash
gh workflow run npm-release.yml --repo remote-controlled-man/skillfit --ref main -f dry_run=false -f preview_run_id=<reviewed-run-id> -f preview_run_attempt=<reviewed-attempt>
```

4. Formal publication retrieves the reviewed tar, without repacking. It verifies
   the same repository/workflow/main source, successful preview attempt, version,
   original bytes and full CI evidence. The run must be attempt 1. Before upload,
   it checks the version is unused and persists an immutable version-named
   publication-intent artifact. An earlier intent or failure to persist the new
   intent blocks uploading. Publication remains serialized and uses the existing
   OIDC environment. No new token, bot or direct-main write permission is added.
5. After the single upload, one automated acceptance command checks registry
   version/latest/integrity, a fresh isolated registry installation and every
   installed file against the original tar. It checks bundled driver fields and
   the five current documents, executable examples, the general feature recipe,
   default HTTPS restoration, zero-network offline restoration and all original
   historical replay/export procedures, followed by exact source proof and npm
   registry signature/attestation verification. Historical recipes retain Node
   **24.21.0/POSIX** requirements; the workflow pins that environment. No model or
   agent CLI calls or actual user configuration writes are part of acceptance.
6. Read `workflow-summary.json`/Actions Summary once after the run. Each check has
   pending/running/passed/failed state, immutable individual receipts and timestamped
   events. Failures retain observations/logs and stop dependent checks. A successful
   verification cannot disguise a later receipt-delivery failure. Inspect detailed
   logs only for a failure, uncertain result or requested investigation.

Preview and publication artifacts are named `npm-release-<run-id>-<attempt>` and
retained for **90 days**. They contain the original tar/pack, source/CI evidence,
state/summary, failure logs and a `records/` bundle. This is temporary retention;
permanent Git records still need normal repository delivery.

## Generated receipts and plan state

The workflow generates all receipt files, their digest references, the release
page status and an optional plan status block. It does not create a privileged
receipt PR or recursively create a second PR to record the first PR's own CI.
Download the exact completed run and preview the import:

```bash
gh run download <publication-run-id> --repo remote-controlled-man/skillfit --name npm-release-<publication-run-id>-<attempt> --dir /tmp/skillfit-release-results
node scripts/release-records.mjs /tmp/skillfit-release-results/records /absolute/path/to/skillfit --plan docs/plans/<release-plan>.md
```

Apply the same import with `--yes` after reviewing its paths. It validates the
manifest, every file digest, successful checks and all receipt references before
writing. Existing receipt files/status blocks, symlinks, escaping paths or altered
files are rejected. New data receipts are copied exclusively; release/plan status
is added to the requested Markdown files. It neither commits nor publishes. Review
and deliver the generated diff through normal Git/PR checks. Successful publication
and permanent receipt delivery are separate outcomes.

Only tightly scoped release bookkeeping uses targeted three-system CI: plan
Markdown, version release pages and newly added versioned JSON/text receipts.
It still builds and validates the real package, driver/current-document versions,
links, receipt JSON and referenced digests. Executable, package/lock, ordinary
public guide, configuration, bench, archive, mixed, deleted/renamed or unknown
changes run full CI. The same three required job names remain present; old PR
runs may be canceled by a new PR push, while running main/release workflows are
not canceled. Local pre-commit requirements in `AGENTS.md` still apply.

## Upload accepted or outcome unknown; verification failed

Never rerun publication. A registry 404 during scanning does not establish that
an earlier upload was rejected. Publication intent and the attempt-1 restriction
conservatively block a second upload, including when the original command's
outcome is unknown. An authentication failure before upload can leave an intent;
review the original evidence and prepare a new version rather than deleting the
record to retry silently.

Availability and transient npm installation failures share one **20-minute**
deadline. Metadata reads back off to 60 seconds; an ETARGET/E404 or selected
transient install failure uses a fresh prefix/cache and retains the failed
attempt. Authentication/integrity failures stop immediately. Only read/install
operations retry, never `npm publish`.

Download the original formal artifact and check out its exact source with build
tools available (`npm ci` and `npm run build`). Use a fresh attempt directory:

```bash
node scripts/release-acceptance.mjs recover /absolute/path/to/original-artifact /absolute/path/to/new-attempt
```

This command copies only the original reviewed inputs, preserving the original
failed state/observations. It never publishes. If the upload-success marker is
missing, it requires public registry metadata and exact source/run provenance
before treating the original intent as an accepted upload; crypto signature
verification remains a required acceptance stage. Unknown acceptance fails closed.
The successful second attempt retains a reference to the first failure. Recovery
still requires matching current latest and the original archive; it is not an
unrestricted audit mode for superseded npm versions.

The older `node scripts/npm-release.mjs verify <pack.json>` remains a read-only
installation check. It alone does not establish that all acceptance stages passed.

The optimized workflow requires its new structured source-CI receipts and a
schema-2 preview. Old 0.13.1 artifacts remain historical and cannot authorize this
new publication path. Tests/fixtures and local candidate checks do not establish
that the changed workflow has already performed a real new npm publication.
The workflow does not change evaluation acceptance policy or upgrade a Skill.

## First verified OIDC publication

The [0.9.1 receipt](0.9.1-verification.json) records the first real publication
through this binding and an independent registry installation. npm's package
metadata identifies the GitHub trusted publisher, and the verified attestation
pins the repository, source commit, workflow and original run. The initial
availability deadline failures remain preserved; the original run is still
failed. This recovery did not repeat the upload. Future reviewed releases can
use the manual CLI-triggered workflow without a local npm login or publish token.

## Receipt layout and compatibility

New source exports use manifest schema 2 and place machine receipts under
`docs/releases/records/<version>/`. The version's existing Markdown release page
links `records/<version>/verification.json`; plan status links the same receipt
relative to the plan. Failure observations and signatures remain included.
The importer also accepts prior schema 1 bundles with flat version-prefixed
files. Existing published records keep their original paths and bytes.

Import preview makes no directories or writes. Explicit import verifies every
manifest/reference digest, rejects aliases/traversal and refuses existing files
or a previously imported version marker. Added known grouped receipts can use
targeted records CI; edits, deletion, executable or unknown paths require full
CI. Ordinary npm packages omit these source-maintenance receipts.
