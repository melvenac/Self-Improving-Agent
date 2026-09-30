# Candidate C (T-155, the shadow merge gate): QA dispatch (record 212), candidate C r2

**By:** Atlas (planner), 2026-09-28. **Runs headless through the Cursor QA driver, with GPT (`gpt-5.6-sol-medium`).** A
model that neither wrote C's criteria (Composer, QA 191) nor built C (Grok). **Never write a live `state.json` or the
real knowledge DB.** Commit the report from a separate worktree.

## The candidate

- Product **`8054f9f`** on `origin/loop/15-slice-3-candidate-c` (tip `09a517f`, the handoff; red tests `103fba7`),
  from `origin/master` `d1e8674`. PR #195. Handoff: `docs/loops/loop-15-slice-3-c-r2-developer-handoff.md`.
- **This is r2.** QA 204 REJECTED `2035e89` (`qa/c-report` `b16d5b5`); **read that report first.** Every C-204 finding
  must be closed, and every row QA 204 scored `met` must still be met.
- Mutant branches: `origin/loop/15-slice-3-candidate-c-r2-mut-{artifact,replaced,ledger,evidence,flags}` and the
  r1 set `origin/loop/15-slice-3-candidate-c-mut-*`.

## Score against the criteria at `23ebd86`

`docs/loops/loop-15-slice-3-c-criteria.md` at `23ebd86` on `origin/docs/session-100-qa99-dispatch`. **§8 and §9
override §1**; §9 sets CC-6's runtime path to `artifacts/iterations/<loop>/<candidate_sha>/`. Score every row CC-0 to CC-22 (CC-21 is cut), plus CC-29 and CC-30. §2's declared rows are
reported as declared, not scored. Also:
1. **Full suite on tcm** at `8054f9f` and at the base `d1e8674`: say whether any failure is new.
2. **Each C-204 finding** (1-5) is closed, each shown with the row that would fail if it returned.
3. **Coverage:** name every row that still has no asserting test. QA 204 listed CC-0, CC-10, CC-13 and CC-19.
4. Your own mutants, at least two, on `qa/c-r2-mut-*`.

## The report

- **Path:** `docs/loops/loop-15-slice-3-c-r2-qa-report.md`, on `qa/c-r2-report`.
- Order: the verdict first, then each CC row, mutants, CI, defects, and your model.

## Evidence file (NEW from this dispatch on; C's criteria §8 P1)

Beside the report, write `docs/loops/loop-15-slice-3-c-r2-qa-report.E_t.json` with loop id `15-slice-3-c`, following the `EvidenceSchema` (`open-brain/src/harness/schema.ts`). One `acceptance[]` row per item above, with status `met`, `unmet`, `partial`, `not_evaluated` or `pending`, and `order` set to `shown` or `attributed` on every `met` row. Also `runtime_checks` from the CI you ran, and `candidate_git.sha` as the full 40-character product SHA. From `open-brain/`, run `node build/harness/cli.js validate evidence <file>` against the candidate's build; if the path differs, use the one `harness help` names. Quote its exit code in the report. **A report without a valid evidence file is incomplete.** Commit it on the report branch.

## CI and authority (D-061: QA runs the CI; developers no longer do)

Dispatch the candidate's red, green and mutant runs on tcm yourself (`gh workflow run ci.yml --ref <branch>`), at most 6 runs. **No `windows=true`.** Quote each run id with its conclusion and headSha.

**The LAST line of the report is exactly `QA-212: REPORT COMPLETE`.** Push only `qa/c-r2-*`, through
`node docs/loops/qa-212/push-qa.mjs`.
