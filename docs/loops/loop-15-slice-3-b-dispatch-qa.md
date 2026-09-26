# Candidate B, Step 1 (the G-042 repair): dispatch to a FRESH, HEADLESS QA seat to SCORE it (record session 129)

**By:** Atlas (planner), record session 109 · 2026-09-26 (UTC). **Where QA 129 runs:** the QA PC `desktop-o4egb1e`,
launched headless by `docs/loops/qa-129/drive.ps1`. **Nobody is watching live, and you cannot reach the planner.**
Questions go in "Open for the planner".
**Not available here:** `/start`, the open-brain MCP server, the SessionStart hook, `gitnexus`.
**Temp and scratch (T-190):** `TEMP`=`TMP`=`C:\qa-tmp`, and scratch goes under `C:\qa-scratch`.
**No git identity here:** pass it per command. **QA seats run ONE AT A TIME.** If `%USERPROFILE%\sia-qa125` has no
`done` marker, or another driver's `claude` is running, stop and say so.
**Commit your report from a separate worktree under `C:\qa-scratch`,** so the shared tree's HEAD never moves.

## Score against

**QA 123's criteria B-0 to B-9** (`docs/loops/loop-15-slice-3-b-criteria.md` on `origin/qa/b-criteria-report`
`09482d7`), as adopted in **`docs/loops/loop-15-slice-3-b-criteria-rulings.md`**. You are scoring against a predecessor
QA seat's criteria: read them as the contract, and where one is ambiguous, say how you read it before you score.

**`E_t`'s schema change (R10) is NOT in this candidate** (rulings §7.3). Score the G-042 repair only. B as a whole is
not accepted until `E_t` has its own criteria and passes them.

## The candidate

- **`e815e3d`**, pinned on `origin/loop/15-slice-3-b-step1-candidate`. The handoff is on `origin/loop/15-slice-3-b-step1`
  at `285a8b2`, and the diff after `e815e3d` is `docs/` only. **Base:** `d2685fd` plus tools = **`ee0566d`**, pinned on
  `-base`. Built by Forge 126, effort **medium** (read from its transcript, 239 of 239 records).
- **The developer's claims (the planner checked the six counted runs' SHAs and conclusions, and that the diff touches
  no `open-brain/src/`):**
  - B-1: R1 red 3/3 and RH red 1/1, at the base.
  - B-2: R1 green 3/3 (36224895526, 36224899537, 36224903440).
  - B-3: RH green 3/3 (36224907891, 36224912574, 36224916869).
  - B-4: every ELD row under 30 s. The worst is `runtime.test.ts` at **26.8 s** (RH), a margin of 1.12×.
  - B-7.3: 1.075× the wall time.
  - E-4 is its own commit (`a984b15`).
  - The fix is 7 test files converted to awaited spawns through `tests/spawn-async.ts`, one commit per file, **117
    hunks listed in handoff §5.**

## What you do

1. **B-0, the static checks, first:** `git diff` of the tools against `b32d3b8`; E-4's commit is the only change to
   them, and it is named. Check for retries, timeouts, timer patches and skips. Test counts ≥ the base's.
2. **B-5.2, the revert mutant, which is yours:** revert every hunk in handoff §5, keep everything else, then dispatch
   **R1 once**. Pass means the worst ELD row is ≥ 30 000 ms.
3. **Re-read every counted run's B-8 record yourself** (the six above, plus B-1's and B-7's), from the logs and
   artifacts, not the handoff. A run whose `TOP5` shows another heavy process is discounted under §1's rule. **Note:
   RH #3's baseline showed a `claude` process on the laptop (5 %, 364 MB).** Say whether it counts under the rule
   and whether it matters.
4. **Your own runs:** at most **4 more** laptop dispatches (for example, a second RH ×1 at the candidate, to see
   `runtime.test.ts`'s 26.8 s margin again, or a heavier row). **The laptop is B's during your run.** Aaron is told.
5. **`spawn-async.ts`:** read it as the product it now is for 7 files. Does an awaited spawn keep each test's
   assertions and exit-code checks exactly? Are there orphaned children on timeout? It has its own tests and mutants;
   check them.
6. **The developer's unresolved EPERM** (1 in 15 desktop runs of the converted `state-import-staleness`, from the rename
   in `runCommit`): try to reproduce it here on the QA PC's NTFS. Is it the Windows rename-flake class QA 122 recorded,
   or something the conversion introduced?

## CI and authority

- **Laptop:** the counted runs in (2) and (4), at most **5** dispatches in total, one at a time. **tcm:** at most 4.
- **Push only `qa/b-step1-*`, through `node docs/loops/qa-129/push-qa.mjs <branch>`.** `git push` is denied.
- Never: master, merges, PRs, tags, releases, other seats' branches, or this PC's or the laptop's configuration.

## The report

- **Path:** `docs/loops/loop-15-slice-3-b-step1-qa-report.md`. Put the verdict first, then B-0 to B-9 each with
  pass or fail and its evidence, then your runs, what could not be verified, defects, disagreements, your error
  entries, reproduction, and "Open for the planner".
- **Model and effort** from your process command line and transcript.
- Commit it to `qa/b-step1-report`, and push with `push-qa.mjs`.
- **The LAST line is exactly `QA-129: REPORT COMPLETE`.** No `/end` (T-163).
