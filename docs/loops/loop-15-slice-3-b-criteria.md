# Candidate B (the G-042 repair): acceptance criteria

**By:** the QA seat, record session 123 · 2026-09-26 (UTC) · on the QA PC `desktop-o4egb1e`, headless, launched by
`docs/loops/qa-123/drive.ps1`. **Model:** Opus 5.5 (`claude-opus-5-5`). **Effort:** `high`. Both come from this
process's command line (`claude.exe -p … --model claude-opus-5-5 --effort high --permission-mode dontAsk`), and the
model also from the transcript's init record (`%USERPROFILE%\sia-qa123\run-0.jsonl`, session
`cc9e0c43-d427-4b1e-9217-b77c35282631`).
**Dispatch:** `docs/loops/loop-15-slice-3-b-criteria-dispatch-qa.md` (`2a29898`). **Read:** the Step 0 brief,
amendment 1 (R81) and amendment 2 (R89) on `origin/docs/session-100-qa99-dispatch`, Step 0's handoff at `5ffb664`
including §9, the tools at `b32d3b8`, and the design at `e1173b1`.
**Preconditions:** `%USERPROFILE%\sia-qa122\done` exists (QA 122 finished). The only `claude.exe` running was this seat,
PID 5368, whose parent was `drive.ps1`.

**This is not a scoring run. It writes the criteria that B is scored against.** Four laptop dispatches were made to
test them (§4). Every generator report was clean. Three baselines were quiet. The fourth printed `BASELINE_QUIET`
with `CompatTelRunner` at 103 % of a core, and that exposed a threshold in the baseline step that is 8× looser than
the handoff states (E-4). §1's counted-run rule now reads the `TOP5` lines itself.

---

## 1. The criteria

### Terms used by every criterion

- **Tools:** Step 0's four files at `b32d3b8`: `open-brain/scripts/load-generator.mjs`, `open-brain/tests/eld-setup.ts`,
  `open-brain/vitest.config.ts`'s conditional setup entry, and `ci.yml`'s `test-windows` Step 0 inputs and steps.
- **Base:** `origin/master` at the moment B's candidate is frozen, named by SHA in the developer's handoff. It is
  `be7ddfb` today. That is **three merges past** Step 0's base `8af41dd` (T-183 r2, T-185 r2, importer), with 9 more
  test files and 191 more tests. **Base + tools** means the base with `b32d3b8` cherry-picked, the four tool files
  byte-identical to `b32d3b8`'s. QA did this as `qa/b-criteria-on-master` = `7e8da33`.
- **The rows.** Every row: `laptop-win`, `gh workflow run ci.yml --ref <branch> -f windows=true -f step0=true -f cpu=0
  -f disk=0 -f spawn=K`, **with the `workers` input left empty**, so the tree's own vitest configuration decides the
  worker count and the log's command line is `vitest run --testTimeout=30000` with no `--maxWorkers`.
  - **R1 = `spawn=2`.** Step 0's red set.
  - **RH = `spawn=4`.** The heavier row. Why this one is in §3, Q1.
- **A counted run** is one whose `test-windows` job log shows all of the following. A run missing any of them is an
  **instrument failure**. It is reported with its run id, it is not counted, and it is replaced once. A second
  instrument failure in the same row stops scoring, because the load or the laptop is not what the row says.
  - `BASELINE_QUIET` (not `BASELINE_NOT_QUIET`), with the `BASELINE` line and the five `TOP5` lines, **and** no `TOP5`
    line for a process outside `Runner.*`, `powershell` and `WmiPrvSE` with `cpu_pct` over 15. `cpu_pct` is percent
    of one logical processor. The step's own marker divides by the processor count, so on the 8-thread laptop it
    marks a process only above 120 % of a core (E-4). This clause holds the run to the rule as the handoff states it;
  - `BASELINE cpu_load_pct` ≤ 25;
  - `PARAMS cpu=0 disk=0 spawn=K children=K`, matching the row;
  - `SUITE_EXIT=<0|1> … deadBeforeStop=0 leakedByReport=0 aliveNow=0`, and the generator step did not exit 90 or 91;
  - `ELD rows=N`, where N equals the number of `*.test.ts` files in the tree at that SHA (71 at `b32d3b8`, 80 at
    `be7ddfb`), so no file ran uninstrumented;
  - the artifact `step0-<run>-<attempt>` uploaded.
- **Red for the right reason** means all of: `SUITE_EXIT=1`; `ON_TASK_UPDATE_TIMEOUTS` ≥ 1; the vitest summary shows
  every test passed, and `Errors` equals the `onTaskUpdate` count, so there is no other error; and at least one ELD
  row with `gapMaxMs` ≥ 60 000.
- **Green** means all of: `SUITE_EXIT=0`; `ON_TASK_UPDATE_TIMEOUTS=0`; no `Errors` line; every test passed.
- **No selection.** Every dispatch made at the candidate's SHA under a row is reported. None is dropped except an
  instrument failure, and a red is never re-run to get a green.

### B-0. The instruments and the test count are not what changed (static, checked first)

1. `git diff b32d3b8 <candidate> -- open-brain/scripts/load-generator.mjs open-brain/tests/eld-setup.ts` is empty.
   `ci.yml`'s `workflow_dispatch` inputs and the `test-windows` job's baseline, Step 0 test, Step 0 check and upload
   steps are byte-identical to `b32d3b8`'s. `vitest.config.ts` still adds `tests/eld-setup.ts` exactly when
   `OPEN_BRAIN_ELD_DIR` is set.
2. **Nothing masks the symptom.** The diff adds no `retry` (config or CLI), changes neither `--testTimeout=30000` nor
   vitest's locked version (3.2.4), patches nothing under `node_modules` (no `patch-package` and no postinstall
   step), and replaces no global timer (`setTimeout`, `setInterval` or `clearTimeout`) in a setup file. The design
   (§2, "Not proposed") rules these out, and so does this criterion.
3. **Nothing is removed to get there.** The diff adds no `.skip`, `.todo`, `skipIf` or `runIf` and deletes no test
   file. In every counted laptop run, `Test Files` and `Tests` passed are **≥ the base's** (80 and 1226 at `be7ddfb`,
   run 36221668780). On tcm they are ≥ the base's Linux counts (1225 passed and 1 skipped at `7e8da33`, the same run's
   `test` job).

*Red at `b32d3b8`:* not applicable. B-0 is a guard on the evidence and not a test of the fix. It exists because every
other criterion here is read from those instruments.

### B-1. Red first, on B's own base

**Pass:** base + tools, **R1, 3 of 3 counted runs red for the right reason**, and **RH, 1 of 1 red for the right
reason**, all at the base SHA the handoff names.

- If the base is still `be7ddfb`, **36221668780 is the first of the three R1 runs** (below). If the base has moved,
  all four are run on the new one. **A red shown on an older base does not transfer** (amendment 1, R81 item 2).
- **If the base is not red 3 of 3 at R1, B cannot be scored,** and that goes to the planner as "not reproducible on
  this base" (brief §2.5). It does not go back to the developer as a failure.

*Red at `b32d3b8`:* R1 **36214723622, 36215057065, 36215367834** (Step 0, 3 of 3), and RH **36221662569** (QA 123,
2 errors, 2 files at or over 60 s). *Red at `be7ddfb` + tools:* R1 **36221668780** (QA 123, 1 of 1).

### B-2. Green under R1, n = 3

**Pass:** the candidate, R1, **3 counted runs, 3 green.**

*Red at `b32d3b8`:* 36214723622, 36215057065, 36215367834: SUITE_EXIT=1, each with one `onTaskUpdate` error, with
1035/1035 passed. *At `be7ddfb` + tools:* 36221668780: 1 error, 1226/1226 passed.

### B-3. Green under RH, n = 3

**Pass:** the candidate, RH, **3 counted runs, 3 green.**

*Red at `b32d3b8`:* **36221662569**: SUITE_EXIT=1, `ON_TASK_UPDATE_TIMEOUTS=2`, `Errors 2`, 1035/1035 passed.
`hook.test.ts` ran for 102.6 s and `staleness.test.ts` for 66.7 s. Both were a single stretch, and they are the two
files over 60 s.

### B-4. Every file's worst macrotask-free stretch stays under 30 s

**Pass:** in **every** counted run of B-2 and B-3 (six runs), **every** ELD row has `gapMaxMs` < 30 000 **and**
`eldMaxMs` < 30 000. The check reads the whole ELD table in the artifact, not the log's top ten. It covers every
test file in the tree, not a named list.

*Red at `b32d3b8`:* **every** run made at `b32d3b8` fails it, including the green ones:

| Runs | Row | Workers | Exit | Worst file, gap |
|---|---|---|---|---|
| 36213944845, 36214206161, 36214437121 | R0 | default | 0, 1, 1 | hook 56.0, 73.0, 79.1 s |
| 36214723622, 36215057065, 36215367834 | R1 | default | 1, 1, 1 | hook 86.0, 94.0, 99.2 s |
| 36215801426, 36216184200, 36216582552 | R1 | **2** | **0, 0, 0** | hook **41.9, 53.3, 49.8 s** |
| 36221215684 (QA) | RH | **2** | **0** | hook **57.8 s** |
| 36221662569 (QA) | RH | default | 1 | hook 102.6 s, staleness 66.7 s |
| 36221668780 (QA, `be7ddfb`) | R1 | default | 1 | hook 98.6 s |
| 36222301375 (QA, `be7ddfb`; baseline marked by E-4's rule) | RH | **2** | **0** | hook **61.6 s** |

**The five capped runs are green and still fail B-4.** That is the criterion's purpose: a worker cap alone passes
B-2 and does not pass B-4. On today's base, at RH, the cap alone let `hook.test.ts` run **61.6 s without a
macrotask** and still exit 0 (§3, Q3).

### B-5. The fix is the files yielding, not a worker cap

1. **No worker cap in B.** The candidate's diff adds none of `maxWorkers`, `minWorkers`, `fileParallelism: false`,
   `poolOptions.*.{maxForks,maxThreads,singleFork,singleThread}`, or a `projects` split carrying any of them, to
   the vitest configuration or to the Step 0 command. The existing `--maxWorkers=2` on `ci.yml`'s ordinary
   (non-step0) Windows step is untouched and is not part of the fix.
2. **Mutant: the yields hold the bound.** The developer lists every hunk of the fix, meaning each converted
   synchronous wait and each added yield. QA reverts all of them and keeps everything else, then dispatches **R1
   once**. **Pass:** that run's worst ELD row is ≥ 30 000 ms, which breaks B-4. Its exit and `onTaskUpdate` count
   are reported. Red for the right reason is expected, since R1 was red 3 of 3 at `b32d3b8`, but it is not required
   of an n = 1 run.

*Red at `b32d3b8`:* B-5.1 is a diff check. It is shown to matter by rows 36215801426, 36216184200, 36216582552 and
36221215684: a cap alone is green and sits 2.2–18.1 s from the 60 s timeout. On today's master, 36222301375 is green
**past** it, at 61.6 s. That run is marked under E-4. B-5.2's mutant at `b32d3b8` would be
`b32d3b8` itself, and every `b32d3b8` R1 run has a worst row of 86–99 s.

### B-6. Product code changes only where a file needs it, and each one carries its safety argument

- The design's Step 1(a), yields in the runtime at stage boundaries, **is not required by these criteria.** The worst
  file, `hook.test.ts`, never enters `runLoop`. Its stretch is 12 `spawnSync('npx', ['tsx', HOOK])` calls in the
  test harness (lines 64 and 299 at `b32d3b8`).
- **If the diff touches `open-brain/src/`:** the handoff names the ELD row that needed it, and it lists every yield
  site with the design §2 safety argument, checked from the code path: no yield between a check and the act it
  guards (R20's byte compare and its git call; Layer 2's restore and the first git read after it; the freeze check
  and the QA stage start). The full harness suite is green on tcm and on the laptop (B-7).
- *Note for the developer, not a condition:* `runtime.test.ts`, a harness file on the product path, reached a
  within-file stretch of **24.9 s** at RH (36221662569) and 21.7 s at R1 on `be7ddfb` (36221668780). That is the one
  file where B-4's 30 s leaves a margin of only about 1.2×.

*Red at `b32d3b8`:* not applicable. This is a condition on how the fix is written.

### B-7. No regressions, with wall time

1. **tcm (Linux):** the full suite at the candidate is green (a `workflow_dispatch` of `ci.yml` without `windows`),
   with counts per B-0.3. Report vitest's `Duration` against the base's: 47.2 s at `7e8da33`, and 39.3 s and 42.0 s at
   `b32d3b8`.
2. **Laptop, ordinary job** (`-f windows=true`, no `step0`): green once at the candidate and once at the base, with
   both `Duration`s reported.
3. **Wall time under load:** the median `Duration` of B-2's three runs is **≤ 1.25 ×** the median of the base's R1
   red-first runs (B-1). At `b32d3b8` that is 1.25 × 273.8 = 342 s. At `be7ddfb` it is taken from B-1's own three
   runs; 36221668780 is 307.0 s. **The cap alone fails this too:** its R1 median is 415.1 s, **1.52 ×**.

*Red at `b32d3b8`:* B-7.3 is red for Step 0's row 2 (376.3, 415.1, 419.5 s against the uncapped 265.5–294.7). B-7.1 and
B-7.2 are regression checks, and they are green at the base by construction.

### B-8. What each run's record carries

For every run of B-1 to B-7, the handoff (and later QA's scoring report) gives: run id and head SHA; the `BASELINE`
line, `BASELINE_QUIET` and the `TOP5` lines; `PARAMS`; the `SUITE_EXIT … aliveNow` line; `ON_TASK_UPDATE_TIMEOUTS`;
vitest's `Test Files`, `Tests`, `Errors` and `Duration`; the command line as logged (`> vitest run …`); `ELD rows` and
the top ten ELD rows; and the artifact name. **A run without this record is not counted.**

### B-9. What the evidence cannot show, and how a run that shows it is treated

- **A red counted run whose worst ELD row is under 60 s fails B-2 or B-3, and it is reported as the first evidence for
  H-main** (the main process could not answer), not as noise. It is not re-run away. See §3, Q7.
- The handoff states the error-to-file link as **correlation**, with the count below, and not as attribution.

---

## 2. What the criteria cost to score

About 13 laptop runs of 5–8 minutes each, one at a time. B-1: 3 R1 and 1 RH (2 R1 and 1 RH if the base is still
`be7ddfb`). B-2: 3. B-3: 3. B-5.2: 1. B-7.2: 2. Plus 2 tcm runs for B-7.1, although every laptop dispatch also runs
the tcm `test` job.

---

## 3. Reasoning, per question in the dispatch

### Q1. Green under what load, and how many runs

**R1 (`spawn=2`) and RH (`spawn=4`), n = 3 each.**

- **R1 is the known red,** and R23 asks for exactly that: the load that turns the current code red. 3 of 3 at
  `b32d3b8`, and 1 of 1 on today's master.
- **RH is required as well, and it is now measured rather than inferred.** At `spawn=4` with default workers,
  36221662569 was red with **two** errors, and **two files were over 60 s**: `hook.test.ts` at 102.6 s and
  `staleness.test.ts` at 66.7 s. Step 0 inferred that "a heavier load row would turn them red", and this run shows
  it. **A fix confined to `hook.test.ts` would be red at RH** because of `staleness`. R1 alone could not show that:
  there `staleness` peaked at 52.5 s.
- **Why not heavier than `spawn=4`.** RH is the next doubling of the axis that bites. Step 0 found that the contended
  resource is process creation, and the harness spawns. RH has a measured red, so it is a row R23 can use.
  Something heavier would have no measured red, and it would move the claim from "passes under the recorded load"
  toward "passes whatever the machine is doing", which design §4 disclaims.
- **Why n = 3 and not more.** Three greens on their own exclude only a per-run failure rate of 63 % or more at 95 %
  confidence (0.37³ ≈ 0.05). **That is why B-4 exists:** the n = 3 carries weight only because each run also
  measures its margin. Six runs, each under half the timeout, say much more than six green exits.

### Q2. A bound on each file's worst stretch: 30 s, and why

- **A green exit is not a margin.** Row 2 (the cap) was green three times with `hook` at 41.9–53.3 s. QA's RH capped
  run 36221215684 was green at **57.8 s, 2.2 s from the timeout.**
- **The number is derived from the spread Step 0 and QA measured.**
  - Run-to-run spread at identical parameters, as the worst stretch's max ÷ min: row 0 **1.41** (56.0–79.1 s), row 1
    1.15, row 2 1.27.
  - One load step (spawn 0 → 2, medians): `hook` 73.0 → 94.0 s, **1.29 ×**. Spawn 2 → 4: `staleness` 51.7 → 66.7 s,
    1.29 ×; capped `hook` 49.8 → 57.8 s, 1.16 ×.
  - A stretch measured at X can therefore plausibly reach X × 1.41 × 1.29 ≈ **1.82 X** on another day, one load
    step up. For that to stay under 60 s, X ≤ 33 s. **30 s, half of birpc's `DEFAULT_TIMEOUT` of 60 s, is the round
    number under it.**
- **Why not tighter.** At 20 s, `runtime.test.ts` (21.7–24.9 s within one file, on the product path) would force
  the design's Step 1(a), product-code yields, for a file that has never been near 60 s. The bound should force
  what the evidence says is dangerous, and no more.
- **Why every file and not a list.** The design's list (`cli`, `runtime`, `config-channel`) missed the worst file.
  Today's master adds two single-stretch files nobody has listed: `state-import-r2.test.ts` at **43.4 s** and
  `state-import-r4.test.ts` at 30.2 s, both at R1 in 36221668780. A named list goes stale with the next merge. The
  ELD table covers every file.
- **Both columns.** `gapMaxMs` (interval ticks) and `eldMaxMs` (histogram) agreed within 1 % in every row QA read.
  Requiring both means one instrument's blind spot cannot pass a file.

### Q3. The fix's shape: a worker cap alone is NOT acceptable. The files must yield (Step 1)

**Answer: Step 1, with no cap in B (B-5.1).** Four measurements settle it, one of them new:

1. **The cap does not bound the stretch. It lowers it, and the stretch still grows with load.** Capped `hook` at
   `b32d3b8`: 41.9–53.3 s at R1 and **57.8 s at RH**. Capped `hook` on today's master at RH: **61.6 s**
   (36222301375). That run is marked: `CompatTelRunner` was in its baseline, so the load was RH or more (§4). Uncapped at the same rows: 86–99 s and 102.6 s. The file still never yields. The cap halves the
   stretch, and one load step plus one merge of tests used up the rest of the margin.
2. **The cap fails the bound in every run** (B-4's table): 5 of 5 capped runs over 30 s.
3. **Its price is wall time, paid on every run:** R1 medians 415.1 s capped against 273.8 s uncapped, **1.52 ×**;
   at RH 445.2 s against 345.3 s, 1.29 ×. B-7.3's 1.25 × would reject it on this alone.
4. **The error tracks the stretch, not the worker count.** Across all 13 laptop runs (Step 0's nine and QA's four):
   - in **every red (7 of 7), the number of `onTaskUpdate` errors equals the number of files at or over 60 s**: 1 and
     1 six times, and 2 and 2 in 36221662569;
   - **5 of the 6 greens have no file at or over 60 s.** The sixth, 36222301375, had `hook` at 61.6 s and no error.
     This fits the mechanism rather than contradicting it. birpc arms its 60 s timer when the worker **calls**
     `onTaskUpdate`, not when the stretch starts (design §1). The error therefore needs a stretch of 60 s **plus**
     the time from the stretch's start to the first call inside it. The smallest stretch that sat in a red run was
     66.7 s, and the largest that did not was 61.6 s.

   What removes the error is removing the stretch. Fewer workers only shorten it. On today's base, at RH plus a
   telemetry process the laptop runs on its own schedule, the cap alone has already been **past 60 s**, and it was
   green because of when the first update fell. A criterion of
   "green at RH" alone would have passed that run.

What Step 1 has to reach, on this evidence: `hook.test.ts`, `staleness.test.ts` and `cli-bootstrap.test.ts` (38.9 s
at RH) at `b32d3b8`, plus `state-import-r2.test.ts` and possibly `state-import-r4.test.ts` on today's master. That is
design §2 Step 1(c), the sweep, **not optional**, as Step 0's §5 said. The criteria name the outcome (B-4) and leave
the method to the developer.

### Q4. Red first

Each criterion above carries its red run. **B-1 makes red-first a scored criterion on B's own base**, because
the base has already moved: at `be7ddfb` + tools, R1 was red 1 of 1 (36221668780), and three more runs are owed. **Red
for the right reason** is defined once, in §1's terms: the exit, the `onTaskUpdate` count, every test passed, no other
error, and a file at or over 60 s.

### Q5. The instruments, as required evidence

These are in §1's "counted run" and in B-8: the generator's leak and alive checks (`deadBeforeStop=0
leakedByReport=0 aliveNow=0`, and no exit 90 or 91), `BASELINE_QUIET`, and the ELD table with a row count equal to
the file count. B-0.1 freezes the instruments at `b32d3b8`, so the candidate cannot change what measures it.

### Q6. No regressions

This is B-7: tcm and the laptop's ordinary job, green with counts, and both wall times reported. The laptop's
under-load wall time is bounded at 1.25 × the base, because the cheapest wrong fix (the cap) is a wall-time fix.

### Q7. What cannot be measured, and how the criteria say so

- **H-main is not measured.** Nothing instruments vitest's main process. It is excluded by explanation (birpc's timer
  runs in the worker's own loop, design §1) and by the count in Q3.4: every one of 7 reds had exactly as many files
  at or over 60 s as it had errors. **B-9 turns this into
  something a run can contradict:** a red with every file under 60 s is reported as evidence for H-main. It is not
  noise.
- **Attribution.** Vitest names no file in the error. The criteria bound every file, so they do not need the
  attribution.
- **Per-test stretches are not recorded.** ELD is per file. B-4 bounds the longest gap within a file, which is the
  quantity the 60 s timer sees. Whether vitest yields between files is Step 0's statement (every file's stretch
  starts at its own first test), and **it was not verified by QA.**
- **One machine and one kind of load.** The claim is "green on `laptop-win` under R1 and RH as recorded". Linux (tcm)
  is a regression check only, and never evidence about G-042 (design §4).
- **The small n of QA's own red rows:** RH red is n = 1 at `b32d3b8` and n = 0 at `be7ddfb`. Today's master red at R1
  is n = 1. B-1 makes both up at scoring time.

---

## 4. Runs made by this seat (4 laptop dispatches, the dispatch's limit; 4 tcm `test` jobs came with them)

Branches: `qa/b-criteria-load` = `b32d3b8` exactly. `qa/b-criteria-on-master` = `7e8da33` = `be7ddfb` + `b32d3b8`
cherry-picked, with the four tool files byte-identical to `b32d3b8`'s (checked by `git diff`). Both were pushed
with `push-qa.mjs` and read back. The dispatches ran one after another, and the laptop took them one at a time.

| # | Run | Head | Row | Workers | Baseline (CPU %, free RAM) | SUITE_EXIT | onTaskUpdate | Tests | Duration | Top ELD rows (gap, ms) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 36221215684 | b32d3b8 | RH | 2 | 0.7, 3397 MB, QUIET | **0** | 0 | 1035/1035 | 445.2 s | hook 57 800, cli-bootstrap 23 438, staleness 21 948, derived-artifacts 13 522, cli 9 588 |
| 2 | 36221662569 | b32d3b8 | RH | default | 1.0, 2347 MB, QUIET | **1** | **2** | 1035/1035, Errors 2 | 345.3 s | hook **102 602**, staleness **66 687**, cli-bootstrap 38 929, derived-artifacts 27 768, runtime 24 896 (wall 339 333) |
| 3 | 36221668780 | 7e8da33 | R1 | default | 0.0, 2265 MB, QUIET | **1** | 1 | 1226/1226, Errors 1 | 307.0 s | hook **98 617**, cli-bootstrap 52 395, state-import-r2 43 358, staleness 41 581, state-import-r4 30 247 |
| 4 | 36222301375 | 7e8da33 | RH | 2 | 4.0 (samples 9, 1, 2), 2217 MB, "QUIET" by the step; **`CompatTelRunner` cpu_pct=103** | **0** | 0 | 1226/1226 | 588.1 s | hook **61 578**, state-import-r2 33 915, staleness 28 430, cli-bootstrap 25 063, state-import-r4 24 565 |

- **Baselines:** runs 1–3 show idle `svchost` in the top 5, plus `WmiPrvSE` at 5 % in run 3. **Run 4 does not count
  under §1's rule.** `CompatTelRunner` (Windows compatibility telemetry) was at 103 % of a core when the baseline
  was taken, and the step still printed `BASELINE_QUIET` (E-4). Whether it ran through the suite is not known,
  because the baseline is taken once. It can only have added load. So run 4 shows that the cap alone reached 61.6 s
  under RH **plus** that process, and it is not a clean RH measurement. It is kept in every table and marked.
- **Every run:** `deadBeforeStop=0 leakedByReport=0 aliveNow=0`. `ELD rows` = 71 at `b32d3b8` and 80 at `7e8da33`, equal to each tree's test-file
  count. The logged command line shows `--maxWorkers=2` only in the capped runs.
- **Each red's errors are all `[vitest-worker]: Timeout calling "onTaskUpdate"`,** thrown from `Timeout._onTimeout`
  in `index.B521nVV-.js:59`, the birpc timer the design names.
- **tcm `test` jobs** (Linux, `--maxWorkers=2`, the ordinary job): run 1 at `b32d3b8` passed 1034 with 1 skipped, in
  41.96 s. Run 2 likewise, in 39.33 s. Run 3 at `7e8da33` passed 1225 with 1 skipped, in 47.22 s. Run 4 at `7e8da33`: 1225 and 1 skipped,
  46.57 s.

---

## 5. Not verified

- **That vitest yields a macrotask between test files.** Step 0 states it, and B-4 depends on it for "per file" to
  be the right unit. QA did not read vitest's runner to confirm it.
- **RH red-first on today's master.** Run 4 was capped. The uncapped RH row at `be7ddfb` is owed by B-1.
- **The per-test cost inside `hook.test.ts`** (about 8 s per row at R1, from 94 s over 12 rows) is arithmetic, not a
  measurement. It is why 30 s looks reachable by yielding between tests. It is not a promise that it is.
- **The one test skipped on Linux** (1034 + 1 on tcm, against 1035 passed on Windows) was not identified. B-0.3
  compares per platform for that reason.
- **Master's own push CI:** 36220964237 at `be7ddfb` "was not started because recent account payments have failed"
  (hosted billing, as the dispatch says). Nothing about the suite can be read from it.

## 6. Error entries

- **E-1 (the handoff, low).** §9 says row 2 ran at head `b32d3b8`. Runs 36215801426, 36216184200 and 36216582552 ran at
  **`787c7d9`**, which is `b32d3b8` plus the handoff's own commit (`git diff --stat b32d3b8 787c7d9`: one file,
  `docs/loops/loop-15-slice-3-b-step0-developer-handoff.md`). The code is identical, so no number changes. The head
  was misstated.
- **E-2 (this seat, none of consequence).** My first log extractions with `grep` matched the log's echo of the
  PowerShell source before the real output lines, so the first read of run 1 showed file names without numbers. I
  re-read the lines anchored on `ELD gap=` and `PARAMS cpu=`. Every number above comes from the second read.
- **E-3 (this seat, a count).** The 4 tcm runs were not chosen: each laptop dispatch also runs the `test` job on tcm.
  That is exactly the dispatch's tcm cap of 4. No tcm run was made on its own.
- **E-4 (the tools at `b32d3b8`, medium: it decides which runs count).** Handoff §2 says the baseline step prints
  `BASELINE_NOT_QUIET` when "a non-runner process is over 15 % of a core". The step computes
  `($_.PercentProcessorTime / $cores) -gt 15`, where `$cores = [Environment]::ProcessorCount`. On the laptop's
  i7-8565U (8 logical processors, per amendment 2) that is **15 % of the whole machine, 120 % of one core**: 8×
  looser than the text. `PercentProcessorTime` from `Win32_PerfFormattedData_PerfProc_Process` is percent of one
  logical processor, as the logged `cpu_pct` shows. Run 4's `CompatTelRunner` at `cpu_pct=103` was therefore
  printed `BASELINE_QUIET`. **No Step 0 row is affected:** its baselines' largest non-runner process was
  `tailscale-ipn` at 5 %, as the handoff reports. Runs 1–3 here are also unaffected. B-0.1 freezes the step as it is,
  so the criteria do not ask the developer to change an instrument mid-measurement. §1's counted-run rule applies
  the stated threshold from the `TOP5` lines instead.

## 7. Open for the planner

1. **The base moved.** B's criteria are written against the base at freeze, and B-1 re-shows red there. Today that
   is `be7ddfb`: R1 red 1 of 1, 2 R1 and 1 RH runs owed. **Recommendation:** freeze B's base at dispatch and name it,
   so that B-1 is run once. Nothing here waits on this.
2. **A worker cap as a "second layer" (design §2 Step 2).** B-5.1 excludes it from B. It costs 1.29–1.52 × wall
   time and bounds nothing. **Recommendation:** if a cap is wanted later, rule it as its own change, with B-2 to B-4
   shown with the cap removed. Not blocking.
3. **`E_t`'s schema change (R10)** is part of B per the Step 0 brief §1, and it is **not covered here**. This
   dispatch asked for the G-042 repair only. It needs its own criteria or a statement that it is out of B.
4. **The laptop's `CompatTelRunner` (E-4).** Windows' compatibility-telemetry task ran at one full core in run 4's
   baseline. It runs on its own schedule, and B's scoring is about 13 runs, so it may land in one. §1's rule will
   discount such a run and replace it once. **Recommendation:** ask Aaron whether that scheduled task may be
   disabled on the dedicated runner, the same kind of change as WSearch. The laptop is not this seat's to change. Not
   blocking: the criteria work either way, at the cost of replaced runs.
5. **`ci.yml`'s ordinary Windows step keeps `--maxWorkers=2`.** B-5.1 leaves it alone. Once B is accepted, whether
   that cap should go is a separate question: it hides G-042 in ordinary runs. Not blocking.

QA-123: REPORT COMPLETE
