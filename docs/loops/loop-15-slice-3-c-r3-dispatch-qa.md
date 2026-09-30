# Candidate C (T-155, the shadow merge gate): QA dispatch (record 213), candidate C r3

**By:** Atlas (planner), 2026-09-28. **Runs headless through the Cursor QA driver, with GPT (`gpt-5.6-sol-medium`).** A
model that neither wrote C's criteria (Composer, QA 191) nor built C (Grok). **Never write a live `state.json` or the
real knowledge DB.** Commit the report from a separate worktree.

## The candidate

- Product **`20c2dfd`** on `origin/loop/15-slice-3-candidate-c` (tip `5f7c9a0`, the handoff; red tests `3854b2f`),
  from `origin/master` `d1e8674`. PR #195. Handoff: `docs/loops/loop-15-slice-3-c-r3-developer-handoff.md`.
- **This is r3.** QA 212 REJECTED r2 `8054f9f` (`qa/c-r2-report` `2ffece8`) on one defect: a non-SHA candidate id
  was accepted and written. QA 204 (`qa/c-report` `b16d5b5`) found five, which QA 212 confirmed closed. **Read QA 212
  first.** Every row QA 212 scored `met` must still be met.
- Mutant branches: `origin/loop/15-slice-3-candidate-c-r3-mut-sha`, plus the r2 set
  `origin/loop/15-slice-3-candidate-c-r2-mut-*`.

## Score against the criteria at `23ebd86`

`docs/loops/loop-15-slice-3-c-criteria.md` at `23ebd86` on `origin/docs/session-100-qa99-dispatch`. **§8 and §9
override §1**; §9 sets CC-6's runtime path to `artifacts/iterations/<loop>/<candidate_sha>/`. Score every row CC-0 to CC-22 (CC-21 is cut), plus CC-29 and CC-30. §2's declared rows are
reported as declared, not scored. Also:
1. **Full suite on tcm** at `20c2dfd` and at the base `d1e8674`: say whether any failure is new.
2. **QA 212's defect is closed:** every SHA input (candidate, criteria, merged, replaced) is refused unless it is 40
   lowercase hex, in the function and the CLI, before any write. Try the CLI and a direct call. Re-check the C-204
   fixes did not regress.
3. **Coverage:** name every row that still has no asserting test. QA 212 listed its own.
4. Your own mutants, at least two, on `qa/c-r3-mut-*`.

## The report

- **Path:** `docs/loops/loop-15-slice-3-c-r3-qa-report.md`, on `qa/c-r3-report`.
- Order: the verdict first, then each CC row, mutants, CI, defects, and your model.

## Evidence file (NEW from this dispatch on; C's criteria §8 P1)

Beside the report, write `docs/loops/loop-15-slice-3-c-r3-qa-report.E_t.json` with loop id `15-slice-3-c`, following the `EvidenceSchema` (`open-brain/src/harness/schema.ts`). One `acceptance[]` row per item above, with status `met`, `unmet`, `partial`, `not_evaluated` or `pending`, and `order` set to `shown` or `attributed` on every `met` row. Also `runtime_checks` from the CI you ran, and `candidate_git.sha` as the full 40-character product SHA. From `open-brain/`, run `node build/harness/cli.js validate evidence <file>` against the candidate's build; if the path differs, use the one `harness help` names. Quote its exit code in the report. **A report without a valid evidence file is incomplete.** Commit it on the report branch.

## CI and authority (D-061: QA runs the CI; developers no longer do)

Dispatch the candidate's red, green and mutant runs on tcm yourself (`gh workflow run ci.yml --ref <branch>`), at most 6 runs. **No `windows=true`.** Quote each run id with its conclusion and headSha.

**The LAST line of the report is exactly `QA-213: REPORT COMPLETE`.** Push only `qa/c-r3-*`, through
`node docs/loops/qa-213/push-qa.mjs`.
