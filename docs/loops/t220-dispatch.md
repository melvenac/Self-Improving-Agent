# T-220: `closeout-tables` labels, and repo-relative `G_plan` paths (dispatch)

**By:** Atlas (planner), record session 156, 2026-10-02. **Ruling:** D-092 (`docs/loops/qa-245-rulings.md`, F2, F4).
**Small: `open-brain/src/harness/` and its tests only.** This has to merge before the slice-four step-4 re-run,
because close-out tables are generated, never typed.

## F2: the `no E_t` label is wrong (must fix)

- `closeout-tables.ts:205-209` decides whether a diff has an `E_t` by checking for `pr-<n>.E_t.json` in the records
  directory. Only a `G_qa` run writes that copy. With no `G_qa`, #195, #209, #218, #220 and #227 are all labelled
  `not scored: no E_t`, but each of them has an `E_t` on its `qa/*` branch (QA 245 report, "Inputs resolved by git").
- **Required:** whether an `E_t` exists must come from a source that does not depend on a `G_qa` having run. Use the
  reconstruction map or the criteria's Terms table, whichever the harness already reads; say which in the handoff.
  - `not scored: no E_t` applies only to diffs that have no `E_t` at all: A (#182), B part 1 (#165) and B part 2
    (#187).
  - A diff that has an `E_t` but no `G_qa` record is labelled `not called`.
- Also fix the doubled full stop: `No scored records..` at line 111.
- **Red first:** a test with no `G_qa` records, where #195 is expected to read `not called` and #182
  `not scored: no E_t`. It fails on master and passes after the fix. The existing `s4-g6-closeout`, `b2-et` and
  `runtime` tests stay green.

## F4: absolute local paths in `G_plan` (low)

- `brief-plan-gate.ts:333-334` (and `sources.spec_excerpt`, line 188) writes absolute paths into the record, such as
  `C:\qa-scratch\qa245-wt\...`.
- **Required:** write repo-relative paths with forward slashes, the way the shadow runners do. Add one test for it.

## Rules

- Branch `loop/t220-closeout-labels` from `origin/master`. Run only the touched test files locally. CI runs the
  suite.
- Open the PR to master, but **do not merge it**. Merging needs the planner's ruling and Aaron's yes.
- **T-221 is open:** your push run and your PR run share a concurrency group, so one of them gets cancelled. If the
  PR is BLOCKED by a cancelled `test`, say so in your report, and the planner will re-run it. Do not push empty
  commits to get around it.
- The repo is PUBLIC: no issues, no comments, and no PRs other than the one above.
- Handoff: `docs/loops/t220-developer-handoff.md` on your branch, with the red and green test output.
- Report the SHA and the PR number to `atlas-sia`. If that seat is unreachable, report to `clark`.
