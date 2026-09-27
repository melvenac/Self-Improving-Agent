# Rulings on QA 134 (T-179 round 2) and QA 142 (T-003), and the T-003 round 2 brief (record 152)

**By:** Atlas (planner), record session 146 · 2026-09-27. **On:**
- QA 134, `origin/qa/t179-r2-report` `69c772e` (474 lines, ending `QA-134: REPORT COMPLETE`). Machine: the QA PC.
- QA 142, `origin/qa/t003-report` `33a90e2` (303 lines, ending `QA-142: REPORT COMPLETE`). Machine: the laptop.

**The planner read** each report's Verdict, What could not be verified, Defects, Disagreements, error entries and Open
for the planner. **It did not read** either candidate's code. The fixes below are the developer's to locate and QA's
to verify.

## QA 134: `1646567` ACCEPTED

- **D1 (QA 125's blocker) is closed by construction.** No session number orders or drops anything. A caller cannot
  supply `first_rev` or `closed_rev`.
- **The migration** of SIA's rev 132/133 and A2A-Hub's rev 71/66 keeps every uuid, by two instruments, and is
  idempotent to the byte.
- **All three disagreements are accepted.** The A2-at-11 reading is the amended one, as QA scored it.

**Where each finding goes:**

| Finding | Ruling |
|---|---|
| **R2-D1** (medium): the different-checkout refusal reads `ob_set_session`'s `project_dir`, and writes go to `ob_state`'s `project_root` | **Fixed in T-003 round 2, in the WRITER**, as QA recommends. `applyStateOps` refuses when the registered uuid's recorded `checkout` is non-null and differs from this write's. The registration-time check stays as the early refusal. **Why T-003 and not a T-179 round 3:** it is the same question T-003 answers (which session a write belongs to). Five stacked branches sit on `1646567`, and a round 3 would move all of them. T-003 round 2 merges immediately after T-179 round 2. |
| **R2-D6** + `end.md` line 11 (the overclaim) | Fixed in T-003 round 2, with the text matching whatever the writer check then guarantees. |
| **R2-D5** (a test gap: `erasure-legacy-session` survives) | QA's row, adopted in T-003 round 2. It is one test, and it kills that mutant. |
| **R2-D2** (T163-2 does not see a hand edit of `first_rev`) | **A task**, not this round. |
| **R2-D3, R2-D4** (checklist steps 6 and 7) | **The planner amends the checklist** before Aaron walks it: step 6 names the main checkout's CLI and says what a seat with record writes on its branch does; step 7 adds re-render and commit. Docs only. |
| **Open 5** (A6b's permanent `1124` label) | Accepted as a label. T-164 owns local numbers. |
| **Open 6** (the queue moved QA 134's tree) | Confirmed by the planner, who launched that queue. QA 134's results are unaffected: every file it used is identical at both commits. The rule in force is now in `qa-launch.md`: launch a queue only on an idle machine. **QA 134's cause is plausible but unconfirmed.** Its guess is that WMI returns a null `CommandLine` for another logon session's process unless elevated. It becomes a task for a lock file in `qa-queue.ps1`, per QA's recommendation. |

## QA 142: PASS on T-003's aim; round 2 required

- A7, A8 and A9 are closed in one checkout, the proof holds against every attack in the dispatch, and it works live
  across `/clear` in a real nested `claude -p`.
- **Open 4, the machine:** the laptop WAS the intended machine. The driver's comment calling it "Aaron's desktop" is
  the template's stale wording.

## T-003 round 2 (record 152)

**Required. T-003's contract must be true everywhere it claims to be:**
- **D1:** `ob_start` with no proof must not fall back to transcript discovery. It prints `Session ID: none —
  <reason>`, and never reuses another session's log. **Row:** QA 142's D1 row on `qa/t003-tests` (`189f184`), as its
  red-first row.
- **D3:** `ob_end` with no `session_id` uses the proven id, for both `resolveRecalledIds` and `sessionEndV2`. A rating
  that `ob_recalled` lists must reach `feedback_log`.
- **QA 134's R2-D1** in the writer, as above. **Rows:** QA 134's P2, P3 and P4 shapes each refused.
- **`end.md`:** line 11, and R2-D6's line 7, say exactly what the code guarantees.

**Ride-alongs, one or two lines each:**
- **D2:** a proof file holding JSON `null` is a named refusal. Use QA's D2 row.
- **D4:** `ob_feedback` with no proof prints `NOT LOGGED: <reason>`.
- **D5:** the proof block honours `--ide cursor`, by testing the payload-then-flag result.
- **R2-D5:** QA 134's `record-erasure` row.

**Not this round:**
- O-1 (a cached null start time; it fails closed) and O-2 (proof pruning) become tasks.
- Open 3 (detect an install without SessionEnd) is a task.
- **Row #348's repair waits.** It needs a check on Aaron's machine: the transcript `1f1d05c2-….jsonl` must show
  `ob_feedback(372, helpful)` at about 08:28:52Z. Until that is read, Session_53.md's id does not establish it.

**Brief:**
- **To:** a fresh Claude developer session (D-035) in `~/Worktrees/sia-builder`. **Branch** `loop/t003-r2` from
  `origin/loop/t003` (`706c029`). It stays stacked on T-179 round 2.
- **Read ONLY:**
  - this file;
  - QA 142's Defects, checks 1–2 and Open (`origin/qa/t003-report`);
  - QA 134's R2-D1, R2-D5 and R2-D6 rows, check 2 and Open 1 (`origin/qa/t179-r2-report`);
  - the rows on `origin/qa/t003-tests`;
  - the T-003 round 1 handoff `9f4fc1e`.
- **Red first on tcm**, per test, at most 6 runs. One mutant per protection. `tsc --noEmit` before every push. **No
  laptop (`windows=true`) CI.**
- Scratch only; never the live `state.json` or the real by-pid directory. Push only `loop/t003-r2` and
  `loop/t003-r2-*`. **Push the handoff BEFORE messaging atlas.** Report your model and effort from the transcript.
  No `/end`.
