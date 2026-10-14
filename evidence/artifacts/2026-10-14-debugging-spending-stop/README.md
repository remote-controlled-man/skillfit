# Spending-stop offline replay

This archive retains the one user-interrupted recovery invocation and all 79
uninvoked entries. It reproduces receipt and cost accounting without grading
unfinished work or calling a model. Previous quality samples are not pooled.
The separate readiness supplement remains unattested and never becomes final
native usage. Read the [dated report](../../2026-10-14-debugging-spending-stop.md)
for cost coverage, earlier-study links and limitations.

Archive: [package.tar.gz](package.tar.gz)

SHA-256: `3665e15042c3df6f94ca5554f8a63120f943d97028ac4965d2e175d969d3b2a2`

From this directory, extract into a new directory and run the offline script:

```bash
mkdir offline-spending-stop
tar -xzf package.tar.gz -C offline-spending-stop
node offline-spending-stop/replay-spending-stop.mjs
```

Node v24.21.0 was used. No dependency installation, agent CLI or network is
needed. The script verifies 1,506 indexed files, repeats the frozen report audit
and checks exact cumulative arithmetic: 174 actual calls, seven missing public
final usages, zero regraded deliveries, 79 uninvoked entries and an ineligible
`inconclusive` decision. Partial costs stay lower bounds; the local readiness
counter is displayed separately. The original native records were audited before
path normalization and reasoning filtering; the export does not claim to retain
their unchanged native seal.

Optional frozen protocol checks also spend no model calls:

```bash
node --test offline-spending-stop/followup/replay/dist/harness/stats.test.js offline-spending-stop/followup/replay/dist/harness/eval-efficiency.test.js offline-spending-stop/followup/replay/dist/harness/execution-timing.test.js
```

The fresh extraction passes all 23 checks. This package contains no accepted
new candidate and does not launch the separate four-call development proposal.
