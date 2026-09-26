# Candidate B, Step 0: developer handoff

**By:** Forge (developer seat), record session 112 · 2026-09-26 · **Model:** Opus 5.5 (`claude-opus-5-5`) ·
**Effort:** medium, as dispatched. **To:** Atlas (planner), then QA, which writes B's criteria from this.
**Read:** the brief, amendment 1 (R81) and amendment 2 (R89) on `origin/docs/session-100-qa99-dispatch`, and the
design at `e1173b1`. **Branch:** `loop/15-slice-3-b-step0` at `b32d3b8`, from `origin/master` `8af41dd`.

## 1. Result, in four lines

- **Red first exists:** at `spawn=2` (cpu 0, disk 0), default workers, `--testTimeout=30000`, the full suite on
  `laptop-win` exited **1 in 3 of 3**, each with exactly one `[vitest-worker]: Timeout calling "onTaskUpdate"` and
  **1035 of 1035 tests passed**.
- **Decision: H-worker, so the design's Step 1.** In every red run a worker's longest macrotask-free stretch was
  **over 60 s** (73.0, 79.1, 86.0, 94.0 and 99.2 s). In the one green run the worst was **56.0 s**. Five reds out of
  five were over 60 s, and the one green was not.
- **The file is `tests/trigger/hook.test.ts`**, which the design does not name. It was the worst file in all six
  runs, and its stretch equals its whole wall time: the file never yields once.
- **Row 0 (no generated load) was already red in 2 of 3.** The threshold on this laptop is between zero and
  `spawn=2`, and zero load is not reliably green.

## 2. What was built (nothing in the product)

| File | What it does |
|---|---|
| `open-brain/scripts/load-generator.mjs` | `--cpu N`, `--disk M` (4 MiB write and fsync), `--spawn K` (`git --version` back to back). Standalone (`--duration S`), or wrap mode (`-- CMD`): the load runs for CMD's whole duration, the generator exits with CMD's code, and prints `SUITE_EXIT=`. It prints the parameters, start time and child PIDs. At the end every child is killed (`taskkill /T /F` on win32, the process group on POSIX), **and the kill is proven twice**: each PID must be gone, and each child's heartbeat file (written every 250 ms) must not change across 1.5 s. **Exit 90** on a leak, and **91** if a child died early or never beat, meaning the load was not what the parameters say. |
| `open-brain/tests/eld-setup.ts` | Loaded only when `OPEN_BRAIN_ELD_DIR` is set (`vitest.config.ts` adds it conditionally, so an ordinary run is byte-for-byte the same setup list). Per test file it records `monitorEventLoopDelay` max and p99, wall time, and the longest gap of a 100 ms interval together with when that gap ended. One JSON line per file goes to `eld-<pid>.jsonl`. |
| `.github/workflows/ci.yml`, `test-windows` | New inputs: `step0`, `workers`, `cpu`, `disk` and `spawn` (7 inputs in all; the limit is 10). A **baseline step** records the CPU load (3 samples), free and total RAM, and the top 5 processes by CPU, and prints `BASELINE_NOT_QUIET` as a warning, never a failure, if the load is over 25 % or a non-runner process is over 15 % of a core. The step0 **test step** wraps `npm test -- --testTimeout=30000` in the generator, with **no `--maxWorkers` unless `workers` is given**. An **independent check** step reads the generator's report and fails the job if any child PID is still a live `node`. It also prints the vitest summary, the `onTaskUpdate` count and the top 10 files by gap. The Step 0 directory is **uploaded as an artifact** `step0-<run>-<attempt>`. A non-step0 run is unchanged: `--maxWorkers=2`, or `workers` if one is given. |

### Instrument checks made before any dispatch (desktop, small only: no suite)

- **The generator's kill check, with a mutant.** In a mutant that skipped killing one child, the check went `LEAK`,
  **exit 90**. Unmutated, 3 children and 2 children both ended with 0 alive and 0 beating. Wrap mode passed
  through inner exit 3, and `npm --version` ran through the Windows shell with exit 0.
- **The ELD histogram has a blind spot, and it was measured, not assumed.** Node's `monitorEventLoopDelay` records
  nothing until its own timer has ticked once. A 1.5 s block started straight after `enable()` read **44 ms**, and
  the same block after one tick read **1500 ms** (node 22, a bare script). In the first version of the setup
  `eldMaxMs` was 0 and then 10 for a 1.5 s probe test, while the interval-gap column read it correctly.
  **Fixed:** `beforeAll` arms the histogram and waits one 30 ms tick before the file's tests start, and `afterAll`
  waits one tick before reading. After the fix, the probe read **eldMax 1551, gap 1551**. The two columns agree
  within 1 % in every row below. **Cost:** one extra yield at the start of each file. Vitest already yields at
  file boundaries, so no stretch inside a file is shortened.

## 3. The ladder, every row

All rows: `laptop-win`, head `b32d3b8`, **default workers** (no `--maxWorkers`), `--testTimeout=30000`, the ELD
instrument on, `disk=0`. Runs went one at a time, and each dispatch waited for the previous one to finish.

| Row | cpu | spawn | Run | Baseline (CPU %, free RAM) | SUITE_EXIT | onTaskUpdate | Tests | Duration | Worst file, gap |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 36213944845 | 1.3, 3243 MB, QUIET | **0** | 0 | 1035/1035 | 183.4 s | hook.test.ts, **55 970 ms** |
| 0 | 0 | 0 | 36214206161 | 1.3, 1932 MB, QUIET | **1** | 1 | 1035/1035 | 187.4 s | hook.test.ts, **72 958 ms** |
| 0 | 0 | 0 | 36214437121 | 1.0, 1919 MB, QUIET | **1** | 1 | 1035/1035 | 202.0 s | hook.test.ts, **79 070 ms** |
| 1 | 0 | 2 | 36214723622 | 3.3, 3500 MB, QUIET | **1** | 1 | 1035/1035 | 273.8 s | hook.test.ts, **86 032 ms** |
| 1 | 0 | 2 | 36215057065 | 2.3, 1909 MB, QUIET | **1** | 1 | 1035/1035 | 265.5 s | hook.test.ts, **93 986 ms** |
| 1 | 0 | 2 | 36215367834 | 1.0, 1914 MB, QUIET | **1** | 1 | 1035/1035 | 294.7 s | hook.test.ts, **99 162 ms** |

- **Every baseline was quiet.** The top 5 were `WmiPrvSE` at 5 % (the baseline step's own CIM queries) and idle
  `svchost` instances. No run is marked and none is discounted.
- **Every generator report:** deadBeforeStop 0, leaked 0, and `aliveNow` 0 from the independent check. The load
  ran as stated and ended.
- **The ladder stopped at the first red row, as planned and accepted.** No `cpu` or `disk` row was run, because
  `spawn=2` was already 3 of 3.

### ELD, the top five files per run (ms; gap is the interval column, eldMax the histogram)

| Run | Exit | 1st | 2nd | 3rd | 4th | 5th |
|---|---|---|---|---|---|---|
| 36213944845 | 0 | hook 55 970 | cli-bootstrap 24 824 | staleness 23 905 | derived-artifacts 16 926 | cli 12 680 (wall 67 870) |
| 36214206161 | 1 | hook 72 958 | staleness 39 496 | cli-bootstrap 26 604 | derived-artifacts 15 620 | runtime 15 367 (wall 184 956) |
| 36214437121 | 1 | hook 79 070 | staleness 45 657 | cli-bootstrap 32 404 | derived-artifacts 16 039 | runtime 15 902 (wall 199 527) |
| 36214723622 | 1 | hook 86 032 | staleness 51 672 | cli-bootstrap 29 342 | derived-artifacts 21 006 | runtime 20 124 (wall 270 399) |
| 36215057065 | 1 | hook 93 986 | staleness 51 037 | cli-bootstrap 48 620 | derived-artifacts 19 946 | runtime 19 390 (wall 261 791) |
| 36215367834 | 1 | hook 99 162 | staleness 52 505 | cli-bootstrap 51 940 | derived-artifacts 29 519 | refwatch-stage 19 846 (wall 147 589) |

**For hook, staleness, cli-bootstrap and derived-artifacts, gap equals wall time.** None of the four yields a
single macrotask from its first test to its last. The full per-file rows (71 per run) are in each run's artifact
and in the job log's `ELD` lines.

## 4. The decision, with its evidence

- **H-worker predicts** a worker stretch of 60 s or more at the failure. **H-main predicts** none.
- **Observed:** five reds, and each has **exactly one** error and **exactly one** file over 60 s: `hook.test.ts`, at
  73 to 99 s. The one green has **no** file over 60 s, with a worst of 56.0 s. The second-worst file never
  exceeded 52.5 s in any run.
- **Therefore H-worker, and the design's Step 1, with Step 2 dropped as the primary fix** (design §2).
- **What this does not prove, stated before QA has to find it:**
  - **Vitest does not name the file in the error.** "Unhandled Error … onTaskUpdate" carries no test path in any
    of the five. Pinning the error to `hook.test.ts` is a correlation (one error and one stretch over 60 s per
    red; none of either in the green). It is not an attribution. The instrument records when each gap ended, but
    vitest prints its error at the end of the run, so the two times cannot be matched from the log.
  - **H-main is not excluded by a measurement of the main process.** Nothing instruments the main process. It is
    excluded only because H-worker alone already accounts for every red, and the green is the one run without
    the condition.
  - **n is small.** Six runs. The 56 s green is close to the threshold, which fits a load-dependent mechanism,
    but it is one run.

## 5. For Step 1 and for QA's criteria

- **The design's target list is incomplete.** §1 names `cli.test.ts`, `runtime.test.ts` and
  `config-channel.test.ts` from a quiet harness-only run. **Under the load that bites, the worst file is
  `tests/trigger/hook.test.ts`**. Its 12 rows (9 `it`, one 3-row `it.each`) run the recall-trigger hook
  `src/cli-recall-trigger.ts` through `spawnSync('npx', ['tsx', HOOK])` (lines 64 and 299, counted, not assumed), it
  has no `await`, and one `npx tsx` start on the laptop costs several seconds. **The next three**
  (`staleness`, `cli-bootstrap`, `derived-artifacts`) are also a single stretch each, and reached 52.5, 51.9 and
  29.5 s. A fix confined to the design's list, or to `hook.test.ts` alone, would leave `staleness` and
  `cli-bootstrap` about 8 s under 60 at `spawn=2`, and **a heavier load row would turn them red**. Design §2
  Step 1(c), the sweep of synchronous waits in the test tree, is not optional on this evidence.
- **Step 1(a), yields in the runtime, would not touch the worst file.** `hook.test.ts` launches the recall trigger, not
  `runLoop`, so its stretch comes from the test harness and not from the product. That is a fact for QA to weigh
  against Step 1(a)'s product-code cost, not a ruling.
- **The candidate red set for B-1 is `cpu=0 disk=0 spawn=2`, default workers, `--testTimeout=30000`, on
  `laptop-win`.** Dispatch: `gh workflow run ci.yml --ref <branch> -f windows=true -f step0=true -f cpu=0 -f disk=0
  -f spawn=2`.
- **Amendment 1's consequence still holds:** if A merges before B is frozen, this red has to be shown again on the
  new master.

## 6. Row 0 is not the known positive, like for like (the planner's fact 1)

36207661776 was red with default workers and no generated load, **before** Brave, a second user session and the
startup apps were removed and WSearch was disabled (per Atlas, at Aaron's word). Row 0 here ran on the changed
laptop and was **still red in 2 of 3**. It is not a repeat of 36207661776: the laptop's own contention is lower now,
and the suite still crosses 60 s in `hook.test.ts` without generated load. **The laptop configuration was not
changed during this batch by this seat.** SysMain was not touched, and all six baselines look alike.

## 7. Not verified, and not done

- **The known negative 36208034860 (`--maxWorkers=2`) was not repeated under `spawn=2`.** That is Step 2's
  evidence and is outside Step 0. It would take one dispatch with `-f workers=2`.
- **The heavier rows (cpu, disk) were not run.** The ladder stops at the first red row.
- **CI on Linux:** each dispatch also ran the `test` job on tcm, because `ci.yml` runs it on every dispatch. It is
  not evidence either way (design §4), and it was not read.
- **`/sync` before the commit** (`check_only`) had 2 issues, **neither from this change**:
  - `retirements`: `ENTITIES.md` still names `dream` and `reflection queue`. It is on master as it stands.
  - `build-freshness`: this checkout's local build is stale. Nothing in Step 0 runs it, and it was not rebuilt.

  It also warned `ci-status`: master's push run at `95fb704` concluded failure (run 36213541314). That was not
  read.
- **The leaked child from the mutant test.** The mutant left one busy node child alive, as intended. It was already
  gone when I went to kill it; the tool's process tree is the likely cause, **not verified**.
- **ListAgents.** Before the first dispatch: sia-planner-4d, sia-builder-e2 (busy), a2a-qa-32 (busy),
  a2a-planner-1d. After the last: the same four plus `worth-it-window-washing-78`, started about 9 minutes before
  the snapshot. **All are desktop sessions. None runs on the laptop**, and the laptop baselines are the instrument
  that counts for R89.

## 8. The desktop rule

No full suite ran on this desktop. The local runs were two test files (a 1.5 s probe and `topics.test.ts`, three
times, for the instrument), `tsc --noEmit` twice, and the generator for 2 to 3 s at 1 to 3 children.
