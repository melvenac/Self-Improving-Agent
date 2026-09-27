# Importer fixes round 4: rulings on QA 122, and the merge

**By:** Atlas (planner), record session 109 · 2026-09-26. **On:** QA 122's report,
`origin/qa/importer-fixes-r4-report` `36c29d5`, 413 lines, ending `QA-122: REPORT COMPLETE`. The planner read the
Verdict, rows IF-21 to IF-25, Defects (with F1, F2 and O12–O15), Disagreements and "Open for the planner".

## Accepted: round 4 is sound, and the importer (rounds 1–4) goes to merge

- **Rows:** IF-21 to IF-25 PASS. IF-1 to IF-20 hold.
- **Closed:** D8 by class (12 of 12 shapes, each written by PS 5.1 itself), D9, and D10's Q1 and Q17.
- **Suites:** 1109 of 1109 on the Defender-on control, and CI green.
- **QA's Open 3 is accepted:** D11 and D12 are older than round 4, and neither is a regression.

**The merge needed one resolution.** QA 122 checked the merge against T-185 **round 1** (`9473b0d`), as dispatched.
Master now carries T-185 **round 2** (`820dacd`), which changed `state migrate`'s usage line. `cli.ts` conflicts on
two help-text lines, one from each side. The planner resolved it by keeping both: the importer's `--accept-stale` on
the `state import` line, and T-185's `--last-session-seat` on the `state migrate` line. That is merge commit `7e00b6b`
on `loop/importer-fixes-merge`, tsc clean. It is a planner commit, so it is named here as one. It changes help text
only, and tcm CI on the merged tree is the check. **This dispatch's error:** it named `9473b0d`, which was the accepted
T-185 at the time. The merge check should name the branch tip that will actually merge.

## Rulings

- **R4-4 (D11, QA's Open 1): a small fix, recorded as a task and not as a merge blocker, due before T-181 adopts a
  Windows project that is not a fresh install** (co-op-mailer, then Makerspace). The fix:
  - test the UTF-32LE BOM `FF FE 00 00` before `FF FE`, and file UTF-32 as `unreadable`;
  - put the NUL check on the BOM paths, so a BOM that lies becomes `unreadable`;
  - file a judged input with no readable `# ` title as `unreadable`. That closes UTF-7, any encoding nobody has named,
    and O12's zero-byte case.
  - Add byte tests for each. **Known positive:** `qa/importer-fixes-r4-d11` `aff7135` (tcm `36215197448`).
- **R4-5 (D12, QA's Open 2): R4-1's scope is JUDGED inputs, as the brief's body says.** A not-judged input
  (DECISIONS.md) does not block. The report and the `--commit` output must still name its NUL bytes, and which ADRs
  were and were not imported. This goes in the same task as R4-4.
- **O7 (QA's Open 4):** QA's reasoning is accepted. The **oldest** snapshot holds the originals from before the first
  failed `--commit`. The two-marker message names the oldest and says what the newer one holds. It is a message change,
  in the same task.
- **F1 (QA's Open 5): the record for session 116 is effort HIGH, from the transcript** (D-047). The planner has found
  the cause: two seats in a row were told "medium" in the dispatch and ran high. The effort line in a dispatch message
  sets nothing, and only the session's own setting counts. **From now on, dispatches state the effort the seat must be
  SET to, and the seat's first message reports its effort read from its transcript.**
- **F2:** accepted. `4b88f5d`'s `cli.ts` is +4/−1, not +3/−1.
- **Disagreement 2** (N17 and E1 not reproducing): accepted as the Windows rename EPERM flake class. It is recorded,
  not scored.
- O13, O14 and O15 are recorded. **O14** (`blocksCommit` fails open on a missing reason): a type that requires the
  reason goes in the R4-4 task.

## Frogger (T-181, the first pilot)

Frogger is a **fresh install**, so neither D11 nor D12 touches it: its files are written by the agent in UTF-8. Once
the importer merges, frogger's path is open. `git init` is Aaron's call, then `/bootstrap`, then `state import` on the
merged build (T-175's seeds are gone).
