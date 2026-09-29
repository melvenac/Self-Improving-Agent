# Record 192 r3 (Cursor QA driver: mid-run seat attribution): QA dispatch (record 202)

**By:** Atlas (planner), 2026-09-28. **Runs headless through the Cursor QA driver, with GPT (`gpt-5.6-sol-medium`)**
(Composer built it; D-060). **Never touch `%USERPROFILE%\Worktrees\sia-qa` beyond reading it.** Commit the report
from a separate worktree.

## The candidate

- Product **`d67c5e7`** on `origin/loop/qa-driver-cursor-r2`, tip `13e183c` (handoff). PR #194.
- The prior round (`462403d`) was REJECTED by QA 195: `qa/qa-driver-r2-report` `dc9eee0`. **Read that report first.**

## Score

1. **QA 195's defect is fixed.** A non-`qa/` ref that the QA seat moves to a commit it created DURING the run reads
   `ref_violations`. Reproduce QA 195's own §4 case against the new `Audit-NonQaRefs`, and look for a second path to
   the same false negative: an amended commit, a cherry-pick, or a commit created in another worktree of the same
   repository.
2. **No new false positive.** Another seat's mid-run push still reads `ref_moved_elsewhere`.
3. **Push forms,** through real `cursor-agent`: the plain and PowerShell `push-qa.mjs` forms and `cmd /c cd … &&` pass;
   every `git push` form, including `& git push`, is denied.
4. **The mutant.** The ordinary harness against `462403d` (the start-of-run rule) exits nonzero on the seat-new row.
5. Your own mutants, at least two, on `qa/qa-driver-r3-mut-*`.

## The report

- **Path:** `docs/loops/qa-driver-cursor-r3-qa-report.md`, on `qa/qa-driver-r3-report`.

## Evidence file (NEW from this dispatch on; C's criteria §8 P1)

Beside the report, write `docs/loops/qa-driver-cursor-r3-qa-report.E_t.json` with loop id `192-qa-driver-r3`, following the `EvidenceSchema` (`open-brain/src/harness/schema.ts`). One `acceptance[]` row per item above, with status `met`, `unmet`, `partial`, `not_evaluated` or `pending`, and `order` set to `shown` or `attributed` on every `met` row. Also `runtime_checks` from the CI you ran, and `candidate_git.sha` as the full 40-character product SHA. From `open-brain/`, run `node build/harness/cli.js validate evidence <file>` against the candidate's build; if the path differs, use the one `harness help` names. Quote its exit code in the report. **A report without a valid evidence file is incomplete.** Commit it on the report branch.

## CI and authority (D-061: QA runs the CI; developers no longer do)

**No CI runs.** This candidate is local PowerShell, which tcm does not exercise. Set `runtime_checks` from your local harness runs, and say so in the report. **No `windows=true`.**

**The LAST line of the report is exactly `QA-202: REPORT COMPLETE`.** Push only `qa/qa-driver-r3-*`, through
`node docs/loops/qa-202/push-qa.mjs`.
