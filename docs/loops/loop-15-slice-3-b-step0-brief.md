# Candidate B, Step 0: brief for a FRESH developer session (Claude)

**By:** Atlas (planner), record session 90 · 2026-09-24. **To:** the Claude developer seat (Forge) in
`~/Worktrees/sia-forge`, record session number assigned in the dispatch. **Not before:** candidate A is ACCEPTED by
QA **and merged by Aaron**. Step 0 runs against A's accepted SHA, and nothing else may run a suite during it.

## 1. What B is, and why Step 0 comes first

- **B = the G-042 repair plus `E_t`'s schema change** (D-036; rulings-5 R23; rulings-2 R10). C (T-155, the shadow
  merge gate) builds on B's accepted SHA.
- **G-042:** the full suite exits 1 on `[vitest-worker]: Timeout calling "onTaskUpdate"` when the machine is
  loaded, while every test passes. R23's acceptance: **the suite stays green under a deliberately generated,
  reproducible load that turns the current code red, shown red first.** A green run on a quiet machine says nothing
  about G-042.
- **The design is the developer's own** (Forge, record session 80): `docs/loops/loop-15-slice-3-developer-design-b-repair.md`
  at `e1173b1` on `origin/loop/15-slice-3-forge-design-b`. The planner ruled **Step 0 first** (D-036).
- **Step 0 builds nothing in the product.** It is a measurement: a load generator plus an opt-in instrument. Its
  result decides between the design's Step 1 (H-worker: yields at stage boundaries) and Step 2 (H-main: a worker
  cap). **QA writes B's criteria after Step 0 and before any fix.**

## 2. The work: the design's §2 Step 0, as written

1. `open-brain/scripts/load-generator.mjs`, tracked:
   - `--cpu N`, `--disk M` (write and fsync 4 MiB files) and `--spawn K` (`git --version` back to back);
   - a fixed duration, with parameters and start time printed;
   - **every child killed at the end**, and a PID and heartbeat check proving it (design §3 B-6).
2. `open-brain/tests/eld-setup.ts`, tracked, enabled only by an environment variable. It records each test
   file's `monitorEventLoopDelay` max, p99 and wall time to a file.
3. **Red first:** the full suite at A's accepted SHA, **n = 3** under one fixed parameter set. Step `N`, `M` and `K`
   up from zero until the error appears. **Report every step, the green ones included.**
4. **Decide:** a worker stretch of **60 s or more** at the failure means H-worker (Step 1). None means H-main
   (Step 2).
5. **If no parameter set reproduces the error in 3 of 3, say so.** The honest outcome is "not reproducible here",
   and B's repair half then needs a new ruling. Do not build a fix for a red you could not show.

## 3. Rules

- **Machine:** Step 0 IS load. Ask atlas before every run, so that no other seat or project runs a suite or a build
  during it. Record `ListAgents` before and after every run.
- **Branch:** `loop/15-slice-3-b-step0` from A's accepted SHA. Push only that branch (D-038), never `master`, never
  force, and read back each push.
- **CI:** CI on your own branch needs no asking (D-040). But CI is Linux, where G-042 has never appeared, so a CI
  run is not evidence for or against (design §4).
- **Record:** `.agents/state.json` belongs to the planner. Record model and effort in the handoff.
- **Hand back:** the parameter table (every step), each run's `SUITE_EXIT`, the eld table for the failing and the
  passing runs, the H-worker/H-main decision with its evidence, and what was not verified.

## 4. Not in Step 0

The fix itself (Steps 1 and 2), `E_t`'s schema change (R10), and anything of C. Each has its own ruling or
criteria first.
