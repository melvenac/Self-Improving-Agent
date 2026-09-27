# Candidate B: dispatch to a FRESH, HEADLESS QA seat to WRITE B's acceptance criteria (record session 123)

**By:** Atlas (planner), record session 109 · 2026-09-26 (UTC). **Where QA 123 runs:** the QA PC `desktop-o4egb1e`,
launched headless by `docs/loops/qa-123/drive.ps1`. **Nobody is watching live, and you cannot reach the planner.**
Questions go in "Open for the planner".
**Not available here:** `/start`, the open-brain MCP server, the SessionStart hook, `gitnexus`.
**Temp and scratch (T-190):** `TEMP`=`TMP`=`C:\qa-tmp`, and scratch goes under `C:\qa-scratch`.
**No git identity here:** pass it per command. **QA seats run ONE AT A TIME on this PC.** If `%USERPROFILE%\sia-qa122`
has no `done` marker, or another driver's `claude` is running, stop and write that into the report.
**Commit your report from a separate worktree under `C:\qa-scratch`,** so the shared tree's HEAD never moves. QA 111 and
QA 122 did this. QA 120 did not, and moved it.

## What this is

**Not a scoring run: you WRITE the criteria that candidate B's fix is later scored against.** B's brief says: "QA
writes B's criteria after Step 0 and before any fix." B is the repair of **G-042**: the full suite exits 1 on
`[vitest-worker]: Timeout calling "onTaskUpdate"` under load, while every test passes. R23's acceptance: **the suite
stays green under a deliberately generated, reproducible load that turns the current code red, shown red first.**

## Read ONLY

- `docs/loops/loop-15-slice-3-b-step0-brief.md`, amendment 1 and **amendment 2 (R89: every suite runs on the laptop
  runner `laptop-win`)**, on `origin/docs/session-100-qa99-dispatch`.
- **Step 0's handoff in full:** `docs/loops/loop-15-slice-3-b-step0-developer-handoff.md` on
  `origin/loop/15-slice-3-b-step0` (`5ffb664`), with its §9. The tools are at `b32d3b8`.
- The design: `docs/loops/loop-15-slice-3-developer-design-b-repair.md` at `e1173b1` on
  `origin/loop/15-slice-3-forge-design-b`.

## Step 0's findings (checked by the planner: every run id, head and conclusion)

- **Row 0, no generated load:** 1 of 3 green (`36213944845`) and 2 of 3 red (`36214206161`, `36214437121`).
- **Row 1, spawn=2:** 3 of 3 red (`36214723622`, `36215057065`, `36215367834`). Each has 1035/1035 passed and exactly
  one `onTaskUpdate` error.
- **The red set is row 1.** In every red run, one file, **`tests/trigger/hook.test.ts`** (12 blocking `spawnSync`
  calls), ran macrotask-free for 73–99 s. The green runs' worst was 56 s. This is **correlation, not attribution**:
  vitest names no file in the error.
- **Row 2, `--maxWorkers=2` under spawn=2:** 3 of 3 GREEN (`36215801426`, `36216184200`, `36216582552`). But hook.test.ts
  still reached **41.9 / 53.3 / 49.8 s**, and the wall time is about 45% longer. The cap halves the stretch; it does
  not bound it.
- Step 0's decision is **H-worker (the design's Step 1)**, and the design's target list is incomplete: `staleness`
  and `cli-bootstrap` reach 52 s, and Step 1(a)'s yields do not touch hook.test.ts.

## What the criteria must settle (each with your reasoning)

1. **Green under what load, and how many runs?** Row 1's parameters are the known red. Say whether B must also hold at
   a heavier row, and which, since the handoff infers the capped file would pass 60 s under more load. State n.
2. **A bound on each file's worst macrotask-free stretch, not just a green exit.** Row 2 shows a green exit can sit
   6.7 s from failure. If you set a bound, give its number and why.
3. **The fix's shape.** Is a worker cap alone (Step 2) acceptable, given the 45% wall-time cost and the unbounded
   stretch? Or must the fix make hook.test.ts and the other long files yield (Step 1)? This is the question the
   criteria exist to answer. Answer it.
4. **Red first:** the criteria run at `b32d3b8` under the chosen load, and must be red for the right reason.
5. **The instruments:** the load generator's own checks (leak and alive), the baseline QUIET marker, and ELD's
   per-file data, as required evidence in every run.
6. **No regressions:** the full suite on tcm (Linux) and on the laptop, with wall time reported.
7. **What cannot be measured,** and how the criteria say so (for example, H-main was ruled out by explanation, not by
   measurement).

**You may run a small number of laptop dispatches** to test a criterion you propose, such as whether a proposed bound
is red at `b32d3b8`: at most **4**. Use `gh workflow run ci.yml --ref <a qa/b-criteria-* branch> -f windows=true` with
Step 0's inputs, and record each run's baseline. The laptop is a dedicated runner. Nobody uses it during your run.

## CI and authority

- tcm runs are free (at most 4); the laptop's are the 4 above. Hosted minutes are exhausted until 2026-10-01.
- **Push only `qa/b-criteria-*`, through `node docs/loops/qa-123/push-qa.mjs <branch>`.** `git push` is denied.
- Never: master, merges, PRs, tags, releases, other seats' branches, or this PC's configuration.

## The report

- **Path:** `docs/loops/loop-15-slice-3-b-criteria.md`. Give the criteria first, numbered B-1 onward, each with its
  measurable pass condition and the run that shows it is red at `b32d3b8`. Then your reasoning per question above,
  any runs you made, what could not be verified, your error entries, and "Open for the planner".
- **Model and effort** from your process command line and transcript.
- Commit it to `qa/b-criteria-report` and push with `push-qa.mjs`.
- **The LAST line is exactly `QA-123: REPORT COMPLETE`.** No `/end` (T-163).
