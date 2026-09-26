# Candidate B, Step 1: the G-042 repair. Brief for a FRESH developer session (record 126)

**By:** Atlas (planner), record session 109 · 2026-09-26. **To:** the Claude developer seat (Forge), record **126**, a
fresh session (D-035) in `~/Worktrees/sia-infra`. **Authority:** Aaron's word ("(b)", session 109).
**Scored against:** QA 123's criteria **B-0 to B-9**, `docs/loops/loop-15-slice-3-b-criteria.md` on
`origin/qa/b-criteria-report` (`09482d7`), as adopted in `docs/loops/loop-15-slice-3-b-criteria-rulings.md`.
**Starting the session is Aaron's act.** Merging stays his (D-019).

## 1. What B Step 1 is

**G-042:** the full suite exits 1 on `[vitest-worker]: Timeout calling "onTaskUpdate"` under load, with every test
passing. **Step 0 found the cause by correlation:** test files that never yield for 60 s or more. The worst is
`tests/trigger/hook.test.ts` (12 blocking `spawnSync('npx', ['tsx', HOOK])` calls, `:64` and `:299` at `b32d3b8`), then
`staleness` and `cli-bootstrap`.

**The fix is making those files yield** (B-5). No worker cap, and no retry, timeout change, timer patch or skipped
test (B-0.2 and B-0.3). The runtime yields of the design's Step 1(a) are NOT required (B-6). If you touch
`open-brain/src/`, the handoff names the ELD row that needed it, and gives the design §2 safety argument for every
yield site.

**`E_t`'s schema change (R10) is NOT in this step.** It gets its own criteria later.

## 2. Start

1. `/start`. Your record number is **126**. **Aaron sets your effort in the session.** A line in a dispatch sets
   nothing; report yours from the transcript.
2. **Base, frozen now:** `origin/master` = **`d2685fd`** (rulings §7.1). Name it in every run's record.
3. `git fetch origin && git switch -c loop/15-slice-3-b-step1 origin/master`, then bring in Step 0's tools
   (`load-generator.mjs`, `eld-setup.ts`, the `vitest.config.ts` hook and `ci.yml`'s step0 inputs and steps) from
   `origin/loop/15-slice-3-b-step0` `b32d3b8`, **byte-identical** (B-0.1). Commit that alone first. QA 123's
   `7e8da33` shows how.
4. **Read ONLY:** QA 123's criteria in full, the rulings, and Step 0's handoff (`5ffb664`, §6 to §9).

## 3. The work, in order

1. **B-1, red first on YOUR base:** R1 ×3 and RH ×1 at base plus tools, before any fix. **If R1 is not red 3 of 3,
   stop and tell atlas:** B cannot be scored on this base, and that is not a failure of yours.
2. **E-4 (rulings §7.5): fix the baseline step's threshold** as its own named commit, with QA 123's E-4 as the reason.
   It is the only allowed change to the tools.
3. **The fix:** convert each long file's blocking waits to yielding ones (for example `spawnSync` to an awaited
   `spawn`), file by file. Every file whose ELD row is at or over 30 s in any counted run must come under 30 s (B-4).
   That is the whole ELD table, not a named list. One commit per file, each listed as a hunk for QA's B-5.2 revert
   mutant.
4. **B-2, B-3, B-4 and B-7:** R1 ×3, RH ×3, the ordinary laptop job at the candidate and at the base, and tcm. Each
   run's record is B-8's, and a run without it is not counted. A red counted run whose worst row is under 60 s is
   **evidence for H-main** (B-9): report it, and do not re-run it away.

## 4. How

- **The laptop is B's.** Message atlas before your first laptop dispatch, so Aaron can be asked to keep off it. It
  takes one job at a time. Windows Search and the compatibility-telemetry tasks are now disabled there, at Aaron's
  word. Anything else heavy in a `TOP5` discounts the run (§1's counted-run rule), so replace it once.
- **No full local suite on this desktop.** Single test files, locally, only to iterate.
- `npx tsc --noEmit -p .` before every push. Push only `loop/15-slice-3-b-step1` and `loop/15-slice-3-b-step1-*`. Never
  master, never force, and read back each push.

## 5. Hand back

`docs/loops/loop-15-slice-3-b-step1-developer-handoff.md`, with:
- the base SHA;
- a commit table built from each commit's own `git diff --stat`;
- the hunk list for B-5.2;
- B-8's record for every run, counted and discounted;
- per criterion B-0 to B-9: met, not met, or not yours to show;
- your model and effort, read from your transcript.

**Push it BEFORE messaging atlas.** No `/end`.
