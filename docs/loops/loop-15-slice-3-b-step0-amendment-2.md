# Candidate B, Step 0: amendment 2 (where the measurement runs)

**By:** Atlas (planner), record session 109 · 2026-09-26. **Amends:** `loop-15-slice-3-b-step0-brief.md` and amendment 1
(record 112). Everything in both stands except what is below. **Authority:** Aaron's word in session 109 ("yes", to
running Step 0 on the laptop).

## Why

- Step 0 is full suites under a deliberate load, with nothing else running a suite during it. The planner has ruled
  that this desktop is never quiet during the day, so no developer runs a full local suite here. A Step 0 run on this
  box would measure the generated load plus whatever Aaron is doing, and neither would be controlled.
- **The laptop runner has already reproduced G-042 by itself.** Run **36207661776** (`test-windows`, head `9f7206d`,
  `--testTimeout=30000`, default workers) passed 1035 of 1035 tests and exited 1 on `[vitest-worker]: Timeout calling
  "onTaskUpdate"`. The machine is an i7-8565U (4 cores, 8 threads) with 7.9 GB, under its own contention. With
  `--maxWorkers=2` and background apps closed, 36208034860 was green. **That is a known positive and a first data
  point for the design's Step 2 (a worker cap).** It is not yet a controlled measurement, because the load was not
  generated.

## R89: Step 0's suites run on the laptop runner, dispatched through CI

1. **Machine.** Every Step 0 suite run is a `workflow_dispatch` of `ci.yml` on the self-hosted runner `laptop-win`
   (label `laptop`, egress-isolated, merged in PR #159 as `8af41dd`). No Step 0 suite runs on this desktop or on the QA
   PC. The runner takes one job at a time, so runs cannot overlap.
2. **The workflow change is the developer's.** On the Step 0 branch, add inputs to `ci.yml`'s `test-windows` job:
   - `step0` (a boolean) runs the load generator in the same job, for the suite's whole duration, with the parameters
     taken from inputs;
   - `workers` sets `--maxWorkers`, defaulting to vitest's own default for Step 0 rows. The job's `--maxWorkers=2` is
     the candidate fix, so a Step 0 red-first row must NOT carry it;
   - the ELD instrument is enabled by the brief's environment variable, and its output is uploaded as an artifact.

   A dispatch runs the branch's own `ci.yml`, so none of this needs merging to run. It merges with B, as Aaron's act.
3. **The load generator's own check** (design §3 B-6) runs inside the job: after the suite, no child process of the
   generator is left, shown by PID. The job fails if one is.
4. **Quiet laptop.** Before a Step 0 run, the job records the laptop's CPU and free RAM, plus the top five processes
   by CPU, in its log. A run whose baseline shows another heavy process is marked, and does not count. Aaron is told
   (through the planner) not to use the laptop during a Step 0 batch.
5. **Known positive:** 36207661776. **Known negative:** 36208034860 (workers=2). The red-first ladder starts from zero
   generated load at the default worker count, and reports every step, the green ones included, as the brief says.

## Seat and base

- **Worktree:** `sia-infra` is now taken by T-185 (record 117), and `sia-builder` by importer round 4 (record 116).
  Step 0 (record 112) goes to **whichever of the two frees first**, as a fresh session. The planner names it in the
  dispatch.
- **Base:** `origin/master` at dispatch (amendment 1's R81 stands). It is `8af41dd` or later, which carries the
  `test-windows` job.
