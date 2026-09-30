# Record 198 (QA probe tests on master; symlink EPERM skips; the "not for merge" detector): QA dispatch (record 203)

**By:** Atlas (planner), 2026-09-28. **Runs headless through the Cursor QA driver, with Composer 2.5.** **Never write
a live `state.json` or the real knowledge DB.** Commit the report from a separate worktree.

## The candidate

- Product **`dabc7fe`** on `origin/loop/qa-probes-on-master`, tip `c025800` (handoff); red is `fc7f7a0`. Handoff:
  `docs/loops/qa-probes-on-master-developer-handoff.md`. Mutants: `origin/loop/qa-probes-on-master-mut-{phrase,eperm}`.
- Built by Grok 4.7 (`cursor-builder`). The brief is "Record 198" in `docs/loops/session-147-dispatches.md`.

## Score

1. **Removed or kept:** each QA-named test under `open-brain/tests/` is gone, or has a header saying what it guards.
   Nothing under `open-brain/tests/` says "not for merge".
2. **EPERM:** every symlink-creating test goes through the skip helper. An EPERM is a skip whose reason names EPERM
   and says it is not a pass. Any other error still throws. Look for a symlink call that bypasses the helper.
3. **The detector:** `probe-markers` fails on a file containing the phrase and on a missing tests directory. Check
   whether it matches its OWN test file or fixture text (G-040: a scan that matches the sentence forbidding a thing).
   Validate it against a known positive and a known negative.
4. **Preserve:** the three kept QA tests still pass, and no other test was deleted.
5. Your own mutants, at least two, on `qa/qa-probes-mut-*`.

## The report

- **Path:** `docs/loops/qa-probes-on-master-qa-report.md`, on `qa/qa-probes-report`.

## Evidence file (NEW from this dispatch on; C's criteria §8 P1)

Beside the report, write `docs/loops/qa-probes-on-master-qa-report.E_t.json` with loop id `198-qa-probes`, following the `EvidenceSchema` (`open-brain/src/harness/schema.ts`). One `acceptance[]` row per item above, with status `met`, `unmet`, `partial`, `not_evaluated` or `pending`, and `order` set to `shown` or `attributed` on every `met` row. Also `runtime_checks` from the CI you ran, and `candidate_git.sha` as the full 40-character product SHA. From `open-brain/`, run `node build/harness/cli.js validate evidence <file>` against the candidate's build; if the path differs, use the one `harness help` names. Quote its exit code in the report. **A report without a valid evidence file is incomplete.** Commit it on the report branch.

## CI and authority (D-061: QA runs the CI; developers no longer do)

Dispatch the candidate's red, green and mutant runs on tcm yourself (`gh workflow run ci.yml --ref <branch>`), at most 4 runs. **No `windows=true`.** Quote each run id with its conclusion and headSha.

**The LAST line of the report is exactly `QA-203: REPORT COMPLETE`.** Push only `qa/qa-probes-*`, through
`node docs/loops/qa-203/push-qa.mjs`.
