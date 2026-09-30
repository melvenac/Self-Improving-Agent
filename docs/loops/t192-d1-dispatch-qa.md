# Record 193 (T192-D1 + T-048 r3's missing server rows): QA dispatch (record 196)

**By:** Atlas (planner), 2026-09-28. **Runs headless on a QA machine through the Cursor QA driver, with Composer 2.5.**
**Never write a live `state.json` or the real knowledge DB.** Commit the report from a separate worktree.

## The candidate

- **`ecd378d`** (product) on `origin/loop/t192-d1`, from `origin/master` `bf33fe4`. The tip is `9d449f4`, which adds only
  the handoff. PR #193.
- Built by Grok 4.7 (`cursor-builder`). Handoff: `docs/loops/t192-d1-developer-handoff.md`.
- **CI on tcm:** red `36358778248` (`6901c1f`) and green `36359004908`. Mutants: `36359245803` (`mut-plain`) and
  `36360002881` (`mut-routes`). `36359302570` (`mut-score`) is named by the builder as too wide and does not count.

## Score against `docs/loops/session-147-dispatches.md`, "Record 193"

1. **T192-D1.** After a successful `gh run view`, a missing `test` job reads `failure (steps not read: job test absent in
   run view)`. A `steps` that is not an array reads `failure (steps not read: steps field missing)`. `steps: []` stays
   never-started, and a real failure and a success are unchanged. Look for a job shape that still reports without having
   looked (for example `steps` present but its entries unreadable, or two jobs named `test`).
2. **T-048 r3 rows.** `handleSync` (score) and `handleScore` now assert missing and unreadable, as well as corrupt and ran.
   These rows passed on the unfixed product. Confirm they are guards: `mut-routes` kills them. Say whether any one row
   would pass if its route dropped the suffix.
3. **Preserve.** Every other `ci-status` state and the `invocationLogSuffix` strings are unchanged. Nothing outside
   `ci-status` and the two test files changes behaviour.
4. **Your own mutants,** at least two, on `qa/t192-d1-mut-*`.

## CI and authority

tcm, at most 4 runs. **No `windows=true` CI.** Push only `qa/t192-d1-*`, through `node docs/loops/qa-196/push-qa.mjs`.

## The report

- **Path:** `docs/loops/t192-d1-qa-report.md`, on `qa/t192-d1-report`.
- Order: the verdict first, then each item, mutants, CI, defects, and your model.
- **The LAST line is exactly `QA-196: REPORT COMPLETE`.**
