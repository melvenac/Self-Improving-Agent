# QA 248 rulings: slice four, step 4 re-run (D-093)

**By:** Atlas (planner), record session 156, 2026-10-02. **Report:** `origin/qa/s4-rerun-report` at `49378d6e`,
`docs/loops/loop-15-slice-4-step4-rerun-qa-report.md` (session `a35fcfeb`). **Dispatch:**
`docs/loops/qa-248-s4-step4-rerun-dispatch.md` with D-092 (`docs/loops/qa-245-rulings.md`).

## Verdict: ACCEPT. Step 4 is complete, and slice four's live half is closed (PROVISIONAL)

- All 13 primary calls were answered (HTTP 200), each by `jev-1.13.0`. There were 0 retries and 0 `auth`
  failures. The total is 15 attempts, within the cap of 17.
  - **4.2:** `reject` on `scope_size`.
  - **4.3:** 8 of 8 `G_done`, all `reject`.
  - **4.4:** 5 of 5 `G_qa`: `proceed` for #209 and #218, `reject` for #195, #220 and #227.
- These are **shadow observations, PROVISIONAL (N=8 / N=5 seat-built, 0 runtime). No calibration is claimed.**
  Eight of eight done-gate rejects is a finding about the thresholds or the inputs, not about the diffs. It goes into
  the slice's close-out discussion, not into a policy change.
- **Checked by the planner, not taken from the report:**
  - **Base and commits:** `49378d6e` has the parent `460c9a49` (the T-220 merge), so the run used the right base. It
    is a single commit.
  - **QA 245's material is untouched:** its two ledger lines are byte-identical to master, and neither its `G_plan`
    record nor its report is in the diff.
  - **The push was clean:** it went through `docs/loops/qa-248/push-qa.mjs`, unmodified.
    `C:/qa-scratch/qa248-tools/push.mjs` on the laptop, read over ssh, only spawns that helper.
  - **The key-scan transcript path (K1)** is named, and it is the session's own `.jsonl`, found through a marker
    printed once in the session.
  - **Spend** (clark): 46,062 input tokens, about $0.0019.

## Open items

1. **F5 (`count-attempts` exits 1 on the 4.2 link) is ACCEPTED under D-092 ruling 3.** The runner chained the new
   attempt to QA 245's unanswered `auth` record. That record has no answer, so this is not a re-roll. The exit 1 is
   the counter not knowing that ruling, and it does not show a broken rule. **T-222:** a fresh attempt after a
   non-retryable outcome is recorded without `retry_of`. Alternatively the counter can be taught to accept it. Either
   way `count-attempts` exits 0 on these records again. **Edit no record to get there.**
2. **S4-2.1 ("exactly one live plan record") is MET, read with ruling 3.** There is exactly one ANSWERED live
   `G_plan`. The other is QA 245's unanswered `auth` attempt, which the ledger preserves as an attempt, not as an
   observation.
3. **S4-8.4 is MET by the planner, who read the CI history the seat was not allowed to read.** The first green
   master CI run that includes F11 (`3b192871`, merged in #182 as `677c1dd5`) is **run 36358116586**, with
   `head_sha` `2b121d996ca4c9eb1c919587f6ae3ad590dcfa0c` and `created_at` `2026-09-27T23:16:08Z`. The three master
   runs before it (`677c1dd5`, `a1fa4b12` and `b744e190`) failed. The record of S4-8.4 is this ruling. The close-out is not
   edited, because its tables are generated and checked.
4. **F6** (the done-gate reason claims "checks failed" when `checks_source` is `none`) and **F7**
   (`checks_source` keeps a scratch path) go to **T-222**, as its low clauses. **F8** (the 4.4 SHA column) is
   ruled a naming question: the column is relabelled "E_t commit", also under T-222. **F9** is cosmetic and gets no
   task.
5. **Tests not run** (`t195-plan-gate`, `s4-g2-key`). The seat was right not to run them on a machine that holds a
   live key. CI ran the full suite on #266 (run 36964091129, green). That covers them.

## Next

- **The release (D-073)** for slices three and four is now unblocked. Releases are Aaron's under D-019. The CHANGELOG
  holds three separate Unreleased sections: `[0.45.0]` bootstrap, T-003, and `[0.44.3]` importer. The planner puts
  a consolidation plan to Aaron before any version bump.
