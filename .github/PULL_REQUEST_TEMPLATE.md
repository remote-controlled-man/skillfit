<!-- Keep this short. CONTRIBUTING.md owns the rules; this only asks for them. -->

## What changed

<!-- One observable improvement. What did the CLI print or do before, and after? -->

## How you verified it

<!--
Paste the checks you actually ran. Unavailable checks must be named, not implied.
  - code/build:  npm test
  - docs:        node tools/verify/check-docs.mjs
  - bench:       node dist/cli.js bench check <bench-dir>
  - live run:    command, agent CLI/version, trials and spend authorization
-->

## Checklist

- [ ] The diff is focused on one observable improvement.
- [ ] A behaviour change has a regression check; a documentation change has facts, links and diff review.
- [ ] `npm test` passes, or every check I could not run is named above.
- [ ] For documentation: one page owns each fact and links are used instead of restatement; `README.md` and `README.zh-CN.md` stay aligned.

## AI disclosure

<!-- Required by CONTRIBUTING.md: say so, and confirm you ran the code. -->

- [ ] This PR contains AI-generated changes. I ran the code and can explain the result.
- [ ] This PR contains no AI-generated changes.
