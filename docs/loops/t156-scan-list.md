# T-156 source-text scans

Method: tests under `open-brain/tests` that read source (or a copied source string) and assert with a regex or `includes` that a thing is present or absent. A planted positive must match. A near-miss (the sentence that forbids the thing, or a lookalike) must not. Scans that only parse JSON fixtures are not in this list.

## Already has a planted positive and a near-miss

- `open-brain/tests/harness/git.test.ts:61-66` — no git push / denied subcommand. Positive and the sentence that forbids it.
- `open-brain/tests/harness/gate-artifacts.test.ts:126-144` — artifact scan. Positive and near-miss in the same test.
- `open-brain/tests/harness/policies.test.ts:310` and `:419-421` — `thresholdLiterals`. Positive `0.7`, comment and block-comment near-miss, version string.
- `open-brain/tests/harness/s4-guards.test.ts:132-148` — `importsMerge` and `doneGate` / spread. String positive and string near-miss, then the real files.
- `open-brain/tests/harness/spawn-sites.test.ts:110` — spawn-site scan, planted positives for each API form.
- `open-brain/tests/trigger/no-network.test.ts` and `floor.test.ts` — named G-040; fixture strings beside the scan.

## Added in this branch

- `open-brain/tests/harness/s4-g5-qa.test.ts` Q6 — planted `0.6` already matched. Near-miss: a comment that names `0.6` must not match.
- Same file Q8 — planted `const planted = 0.6` already matched. Near-miss: a comment that names `0.6` must not match.
- `open-brain/tests/pipelines/sync/probe-markers.test.ts` — wiring line. Positive is the push call. Near-miss is the same text in a `//` comment.
- `open-brain/tests/pipelines/sync/worktree-layout.test.ts` — same shape for `checkWorktreeLayout`.
- `open-brain/tests/t048-r3.test.ts:116` — looks for `/* non-critical */` near `recordRecallEvent`. No fixture pair yet; the branch only fires when `handleRecall` is missing. Left as a listed gap, not edited, because the scan is inside a fallback.
- `open-brain/tests/t048-r2b.test.ts:98` — `formatScoreCategoryLine` on `cli.ts`. Positive is the call. Near-miss is the same name in a `//` comment.

## Deferred: test file is in a PR that is in QA or frozen

Do not edit until that PR merges.

- deferred: `open-brain/tests/pipelines/sync/checks.test.ts` in PR #442 (audit already cites checks.test.ts:124 as covered; leave the file)
- deferred: `open-brain/tests/cli-bootstrap.test.ts` in PR #437
- deferred: `open-brain/tests/cli-session-end-dedupe.test.ts` in PR #437
- deferred: `open-brain/tests/shared/session-hook-claim.test.ts` in PR #437
- deferred: `open-brain/tests/t003-r2.test.ts` in PR #427
- deferred: `open-brain/tests/t003-session-proof.test.ts` in PR #427
- deferred: `open-brain/tests/t235-p2-3-cursor-proof.test.ts` in PR #427
- deferred: `open-brain/tests/t235-p2-5-cursor-recall.test.ts` in PR #436
- deferred: `open-brain/tests/setup-hooks.test.ts` in PR #425 and #436
- deferred: `open-brain/tests/setup-cursor-commands.test.ts` in PR #424
- deferred: `open-brain/tests/setup-scratch-home.test.ts` in PR #425
- deferred: `open-brain/tests/harness/config-channel.test.ts` in PR #421
- deferred: `open-brain/tests/pipelines/session-start/hub-presence.test.ts` in PR #434
- deferred: `open-brain/tests/pipelines/session-start/hub-seat-state.test.ts` in PR #434
- deferred: `open-brain/tests/pipelines/session-start/briefing-budget.test.ts` in PR #434
- deferred: `open-brain/tests/pipelines/session-start/focus.test.ts` in PR #434
- deferred: `open-brain/tests/pipelines/session-start/seat-map.test.ts` in PR #434
- deferred: `open-brain/tests/pipelines/sync/greeting-size.test.ts` in PR #434
- deferred: `open-brain/tests/pipelines/sync/hub-seats.test.ts` in PR #434
- deferred: `open-brain/tests/pipelines/sync/vault-pollution.test.ts` in PR #441
- deferred: `open-brain/tests/shared/paths.test.ts` in PR #441
- deferred: `open-brain/tests/pipelines/sync/retirements-rehash.test.ts` in PR #442
- deferred: `open-brain/tests/pipelines/sync/t048-counts-parity.test.ts` in PR #442
- deferred: `open-brain/tests/suite-run-meta.test.ts` in PR #444

Those files were listed because the PR touches them, not because each one was shown to be a source-text scan. A scan inside one stays untouched until merge.
