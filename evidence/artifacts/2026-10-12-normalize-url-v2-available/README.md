# Readiness check refused before benchmark startup

The one allowed CLI readiness invocation exited after 0.122s because its
workspace was not initialized as a Git repository. The receipt records
`executorInvoked: true`: the CLI was spawned. It is not evidence that a provider
accepted or billed a model request. No token usage or public stream was returned.
No benchmark group or paired call was started.

The temporary sleep assertion was released. `readiness-records.tar.gz` preserves
the prompt, started/failed ledger, receipt and power record. `export-index.json`
pins original/exported metadata bytes, with only local paths normalized.
`replay/` retains the exact compiled/source/Skill/bench/declaration/live-entry
inputs. The frozen live entry is retained as a local-preparation counterexample;
do not repeat it or change its receipt. A later declaration initializes its
readiness worktree with the existing harness Git/reflog routine first.

Offline: extract the archive and compare each file against export-index.json.
The receipt is ready=false, actual CLI invocations=1, paired invocations=0.
There is no quality score or per-success cost. The 0.122s interval remains
recorded and token coverage remains unknown. No credentials or hidden rollout
logs are included. Fresh model procedures do not guarantee identical output.
