# Candidate B, Step 1 (the G-042 repair): developer handoff

**By:** Forge (developer), record session **126** · 2026-09-26, in `~/Worktrees/sia-infra`. **Brief:**
`docs/loops/loop-15-slice-3-b-step1-brief.md` on `origin/docs/session-100-qa99-dispatch`. **Scored against:** QA 123's
B-0 to B-9 (`09482d7`), as adopted in `loop-15-slice-3-b-criteria-rulings.md`.
**Model:** `claude-opus-5-5`. **Effort:** `medium`. Both read from this session's transcript
(`~/.claude/projects/C--Users-melve-Worktrees-sia-infra/78725e06-d6b6-47d1-a028-81ea397fca84.jsonl`): every one of its 239
assistant records carries `"effort":"medium"` and `"model":"claude-opus-5-5"` at the time of reading. (My first message
to atlas said I could find no effort field. That was before I looked in the transcript, and it was wrong.)

## 1. Result

- **B-1 is met at base `d2685fd` + tools (`ee0566d`).** R1 was red for the right reason in 3 of 3 runs, and RH in 1 of 1.
  Every red had as many `onTaskUpdate` timeouts as errors, and as many as files at or over 60 s.
- **The candidate `e815e3d` is green in all 6 counted runs:** R1 3 of 3 (B-2) and RH 3 of 3 (B-3). In every one of
  them, every ELD row is under 30 s. The worst row across the six was `runtime.test.ts` at **26 789 ms** (RH #1).
- **The fix is seven test files that now await their child processes,** plus one helper. Nothing under `src/`, and no
  worker cap. E-4 is fixed as its own commit.
- **Wall time under load:** the candidate's R1 median is 308.5 s against the base's 287.0 s, **1.08 ×** (B-7.3 allows
  1.25 ×). The ordinary laptop job and tcm are green at both the candidate and the base.
- **The thin spot is not in this diff.** Once the seven files were fixed, the worst rows are all harness files whose
  stretch is one test's synchronous run of the runtime (§4): 17.3 to 21.8 s at R1 and 18.3 to 26.8 s at RH. That is
  design Step 1(a). QA's bound was set to leave it alone. It is also where B-4 would fail first.

## 2. Base, branches, candidate

- **Base: `origin/master` = `d2685fd`**, frozen by the brief (rulings §7.1). It differs from `be7ddfb` only by
  `docs/loops/research/jev-mcp.md`. Master has since moved on to `aae0dce` with a second docs-only file. At atlas's
  word I stayed on `d2685fd`.
- **Base plus tools: `ee0566d`** = `d2685fd` + `b32d3b8` cherry-picked. `git diff b32d3b8 ee0566d` on the four tool
  files is empty (B-0.1). Pinned as `loop/15-slice-3-b-step1-base`, so every base run resolves to the same SHA.
- **Candidate: `e815e3d`**, pinned as `loop/15-slice-3-b-step1-candidate`. Every candidate run below is at `e815e3d`.
  This handoff sits on `loop/15-slice-3-b-step1` above it, as docs only, so it does not move the scored SHA (the
  cause of QA 123's E-1).

## 3. Commits (each from its own `git diff --stat`)

| Commit | What | Stat |
|---|---|---|
| `ee0566d` | Step 0's tools, cherry-picked from `b32d3b8`, byte-identical | ci.yml 89 (+88 −1), load-generator.mjs +183, eld-setup.ts +78, vitest.config.ts 3 (+2 −1); 4 files, +351 −2 |
| `a984b15` | **E-4**: the baseline marks a process over 15 % of ONE core | ci.yml 5 (+3 −2) |
| `d9445f3` | `tests/spawn-async.ts` (`spawnAsync`) and its test | spawn-async.test.ts +46, spawn-async.ts +70 |
| `c6e8061` | fix: `trigger/hook.test.ts` | 50 (+25 −25) |
| `764c96b` | `execAsync` added to the helper, and its row | spawn-async.test.ts 10 (+9 −1), spawn-async.ts +18 |
| `674d42e` | fix: `pipelines/sync/staleness.test.ts` | 55 (+29 −26) |
| `54961a2` | fix: `pipelines/state-import-r2.test.ts` | 71 (+34 −37) |
| `d696985` | fix: `pipelines/state-import-r4.test.ts` | 17 (+9 −8) |
| `97a34b7` | fix: `pipelines/state-import-staleness.test.ts` | 31 (+14 −17) |
| `724b9b0` | fix: `cli-bootstrap.test.ts` | 72 (+38 −34) |
| `e815e3d` | fix: `pipelines/session-start/derived-artifacts.test.ts` | 43 (+23 −20) |

Total `ee0566d..e815e3d`: 10 files, +317 −169. **Nothing under `open-brain/src/`** (B-6).

## 4. What the fix is

Every file that ran as one stretch with no macrotask did so because its harness waited on child processes
synchronously (`spawnSync`, `execSync`, `execFileSync`). Vitest does not yield between the tests of one file, so a
file's synchronous spawns added up to one stretch. The fix awaits the child instead.

- **`tests/spawn-async.ts`**: `spawnAsync` returns `spawnSync`'s result shape (`status`, `signal`, `stdout`, `stderr`,
  `error`), so a call site changes by one `await`. `execAsync` keeps `execSync`'s contract: it throws on a non-zero
  exit, a signal or a failure to start, so a broken git still fails the fixtures that rely on it (G-029).
  `tests/spawn-async.test.ts` checks every channel against `spawnSync`'s answer for the same child, stdin closing, a
  command that cannot start, `execAsync` throwing, and that the event loop runs while the child does. **Mutants,
  each red:** stderr hardcoded to `''` (2 rows red); a `spawnSync`-backed body (the event-loop row red); `execAsync`
  that never throws (its row red).
- **Seven files converted**, one commit each. No assertion changed. One helper changed what it reports: the
  `execFileSync`-based `cli()` in `state-import-r2` and `state-import-staleness` returned `stderr: ""` on success
  without reading it. They now return the child's real stderr. Every assertion still passes.
- **Chosen by the whole ELD table at the base, not a list.** The five files at or over 30 s in any B-1 run (hook, r2,
  sync/staleness, cli-bootstrap, r4), plus the two single-stretch files next below them: `derived-artifacts` (22.8 to
  28.1 s, 27.8 s at RH in QA 123) and `state-import-staleness` (15.5 to 19.2 s).
- **Desktop, one file at a time, ELD on, the original (from `HEAD`) against the converted file:**

| File | gapMaxMs before (= wall) | gapMaxMs after | Tests |
|---|---|---|---|
| trigger/hook | 26 739 | 143 | 12/12 |
| sync/staleness | 10 024 | 252 | 17/17 |
| state-import-r2 | 17 634 | 471 | 18/18 |
| state-import-r4 | 14 105 | 627 | 22/22 |
| state-import-staleness | 5 617 | 163 | 8/8 |
| cli-bootstrap | 10 491 | 130 | 13/13 |
| derived-artifacts | 5 624 | 299 | 9/9 |

The "before" column is the known positive for the instrument on this machine: every original file is one stretch
as long as the file itself.

**Not converted, on purpose.** The harness files (`runtime`, `policies`, `refwatch-stage`, `gate-artifacts`, `cli`,
`refwatch`) already yield between tests (wall ≫ gap). Their stretch is one test's synchronous run of the runtime under
test: 2.5 to 3.6 s per test on the desktop, 12 to 16 s at R1 and up to 20.1 s at RH on the laptop at the base. Reaching
them means yields in `src/`, which is design Step 1(a). B-6 does not require it, and QA's 30 s was chosen so that it
would not (criteria §3 Q2). The smaller single-stretch files (`harness/checks` 11.5 s, `state-writer` 11.3 s,
`greeting-size` 10.1 s, `sync/checks` 8.9 s at R1) are under a third of the bound and were left alone.

## 5. B-5.2: the hunks to revert

Revert these seven commits and keep everything else, including the helper (`d9445f3`, `764c96b`) and E-4
(`a984b15`): `git revert --no-commit c6e8061 674d42e 54961a2 d696985 97a34b7 724b9b0 e815e3d`. Every hunk in them is
part of the fix. Hunks, as `git diff -U0 <c>~1 <c>` prints them:

- `c6e8061` `open-brain/tests/trigger/hook.test.ts`, 19 hunks: `-2 +2`, `-63, 2 +63, 3`, `-66 +66, 0`, `-153, 2 +153, 2`, `-180 +180`, `-192, 2 +192, 2`, `-201, 2 +201, 2`, `-212, 2 +212, 2`, `-222 +222`, `-236 +236`, `-238 +238`, `-255 +255`, `-260 +260`, `-272 +272`, `-285 +285`, `-294 +294`, `-299, 2 +299, 2`, `-312 +312`, `-316 +316`.
- `674d42e` `open-brain/tests/pipelines/sync/staleness.test.ts`, 21 hunks: `-5 +5`, `-18, 5 +18, 8`, `-24, 2 +27, 2`, `-38 +41`, `-40 +43`, `-61 +64`, `-64 +67`, `-82 +85`, `-85 +88`, `-123 +126`, `-125 +128`, `-142 +145`, `-145 +148`, `-151 +154`, `-153 +156`, `-159 +162`, `-171 +174`, `-185 +188`, `-192 +195`, `-198 +201`, `-207 +210`.
- `54961a2` `open-brain/tests/pipelines/state-import-r2.test.ts`, 19 hunks: `-14 +14`, `-35, 8 +35, 5`, `-120 +117`, `-122 +119`, `-124 +121`, `-220 +217`, `-223, 2 +220, 2`, `-246 +243`, `-249 +246`, `-256, 5 +253, 5`, `-263, 4 +260, 4`, `-269, 3 +266, 3`, `-278 +275`, `-280, 2 +277, 2`, `-287 +284`, `-289 +286`, `-296 +293`, `-298 +295`, `-302 +299`.
- `d696985` `open-brain/tests/pipelines/state-import-r4.test.ts`, 7 hunks: `-11 +11`, `-27, 2 +27, 3`, `-113 +114`, `-120 +121`, `-129 +130`, `-148 +149`, `-150 +151`.
- `97a34b7` `open-brain/tests/pipelines/state-import-staleness.test.ts`, 8 hunks: `-15 +15`, `-31, 8 +31, 5`, `-94, 2 +91, 2`, `-97 +94`, `-103 +100`, `-110 +107`, `-156 +153`, `-158, 2 +155, 2`.
- `724b9b0` `open-brain/tests/cli-bootstrap.test.ts`, 28 hunks: `-2 +2`, `-51, 2 +51, 5`, `-54 +56, 0`, `-56, 0 +59, 3`, `-64, 2 +69, 2`, `-67 +71, 0`, `-85 +89`, `-87 +91`, `-93 +97`, `-97 +101`, `-100 +104`, `-103 +107`, `-106 +110`, `-113 +117`, `-123, 3 +127, 3`, `-129, 2 +133, 2`, `-136 +140`, `-149 +153`, `-155 +159`, `-160 +164`, `-170, 2 +174, 2`, `-178 +182`, `-185 +189`, `-197 +201`, `-208 +212`, `-219 +223`, `-222 +226`, `-227, 2 +231, 2`.
- `e815e3d` `open-brain/tests/pipelines/session-start/derived-artifacts.test.ts`, 15 hunks: `-5 +5`, `-12, 5 +12, 8`, `-18, 2 +21, 2`, `-36 +39`, `-38 +41`, `-70 +73`, `-73 +76`, `-79 +82`, `-82 +85`, `-89 +92`, `-92 +95`, `-97 +100`, `-100 +103`, `-104 +107`, `-106 +109`.

117 hunks in all. Each commit touches one file, and together they are every change to those seven files.

## 6. B-8's record for every run

Every run below was on `laptop-win`, one at a time, in dispatch order. Each laptop dispatch also ran tcm's `test`
job, which passed every time. **All ten step0 runs are counted.** Every one has `BASELINE_QUIET`, a `BASELINE
cpu_load_pct` of 5 or less, no `TOP5` row over 15 % of a core outside `Runner.*`/`powershell`/`WmiPrvSE` (§1's rule,
read from the lines), `PARAMS` matching its row, `deadBeforeStop=0 leakedByReport=0 aliveNow=0`, `ELD rows` equal to
the tree's test-file count (80 at `ee0566d`, 81 at `e815e3d`, where `spawn-async.test.ts` is new), and its artifact
uploaded. No run was discounted, and none was replaced. **No selection:** these are every dispatch made on either SHA.

| Criterion | Run | Head | Row | SUITE_EXIT | onTaskUpdate | Errors | Files / Tests | Duration | Worst ELD row (gap / eld, ms) | Rows ≥ 30 s | Rows ≥ 60 s |
|---|---|---|---|---|---|---|---|---|---|---|---|
| B-1 | 36223551849 | ee0566d | R1 | **1** | 1 | 1 | 80 / 1226 passed | 275.10 s | hook 72 791 / 72 880 | 5 | 1 |
| B-1 | 36223569425 | ee0566d | R1 | **1** | 1 | 1 | 80 / 1226 passed | 286.98 s | hook 81 579 / 81 604 | 5 | 1 |
| B-1 | 36223572911 | ee0566d | R1 | **1** | 1 | 1 | 80 / 1226 passed | 305.11 s | hook 84 448 / 84 490 | 5 | 1 |
| B-1 | 36223575964 | ee0566d | RH | **1** | 2 | 2 | 80 / 1226 passed | 371.73 s | hook 99 420 / 99 455; r2 64 892 | 5 | 2 |
| B-2 | 36224895526 | e815e3d | R1 | **0** | 0 | none | 81 / 1231 passed | 315.89 s | runtime 21 751 / 21 726 | 0 | 0 |
| B-2 | 36224899537 | e815e3d | R1 | **0** | 0 | none | 81 / 1231 passed | 300.07 s | refwatch-stage 17 616 / 17 583 | 0 | 0 |
| B-2 | 36224903440 | e815e3d | R1 | **0** | 0 | none | 81 / 1231 passed | 308.51 s | runtime 17 291 / 17 264 | 0 | 0 |
| B-3 | 36224907891 | e815e3d | RH | **0** | 0 | none | 81 / 1231 passed | 351.76 s | runtime **26 789 / 26 743** | 0 | 0 |
| B-3 | 36224912574 | e815e3d | RH | **0** | 0 | none | 81 / 1231 passed | 380.75 s | policies 21 036 / 21 005 | 0 | 0 |
| B-3 | 36224916869 | e815e3d | RH | **0** | 0 | none | 81 / 1231 passed | 355.81 s | runtime 18 261 / 18 237 | 0 | 0 |

**Ordinary and tcm runs (B-7.1, B-7.2).** These have no step0 lines. The record is the jobs' own vitest summaries.

| Run | Head | Job | Command as logged | Files / Tests | Duration |
|---|---|---|---|---|---|
| 36224825024 | ee0566d (base) | test-windows (laptop, ordinary) | `vitest run --testTimeout=30000 --maxWorkers=2` | 80 / 1226 passed | 311.41 s |
| 36224825024 | ee0566d (base) | test (tcm) | `vitest run` | 80 / 1225 passed, 1 skipped | 87.69 s |
| 36224921272 | e815e3d | test-windows (laptop, ordinary) | `vitest run --testTimeout=30000 --maxWorkers=2` | 81 / 1231 passed | 305.46 s |
| 36224921272 | e815e3d | test (tcm) | `vitest run` | 81 / 1230 passed, 1 skipped | 87.64 s |
| 36224925217 | e815e3d | test (tcm; dispatch without `windows`) | `vitest run` | 81 / 1230 passed, 1 skipped | 85.81 s |

tcm's durations today (85.8 to 87.7 s) are about twice QA 123's 47.2 s. The base and the candidate ran in the same
window and read the same, so I read this as tcm's own load (other seats were dispatching to it through the batch). **Not
verified.**

**One observation from the baselines.** RH #3 (36224916869) has `TOP5 claude pid=… cpu_pct=5 ws_mb=364`: a Claude
process was running on the laptop when the baseline was taken. It is under the 15 % rule, so the run counts. It is
named here because the laptop is meant to be B's alone. The other baselines show only idle `svchost`, `WmiPrvSE` at
5 % and `WUDFHost` at 5 %.

### The full B-8 record, per step0 run (lines as logged; `pid`s kept)

**B-1 R1 #1: run 36223551849**, head `ee0566d` (`loop/15-slice-3-b-step1`), artifact `step0-36223551849-1`, tcm `test` job success.
```
BASELINE cpu_load_pct=0.7 samples=1,0,1 free_ram_mb=3312 total_ram_mb=8048 at=2026-09-26T06:23:09.5762236Z
BASELINE_QUIET
TOP5 svchost#32 pid=3148 cpu_pct=0 ws_mb=7
TOP5 svchost#31 pid=2256 cpu_pct=0 ws_mb=6
TOP5 svchost#30 pid=2240 cpu_pct=0 ws_mb=14
TOP5 svchost#35 pid=3520 cpu_pct=0 ws_mb=8
TOP5 svchost#34 pid=3512 cpu_pct=0 ws_mb=8
> vitest run --testTimeout=30000
PARAMS cpu=0 disk=0 spawn=2 children=2 started=2026-09-26T06:23:15.433Z stopped=2026-09-26T06:27:54.680Z
SUITE_EXIT=1 capped=False deadBeforeStop=0 leakedByReport=0 aliveNow=0
ON_TASK_UPDATE_TIMEOUTS=1
Test Files 80 passed (80)
Tests 1226 passed (1226)
Errors 1 error
Duration 275.10s (transform 7.82s, setup 4.32s, collect 46.46s, tests 1266.09s, environment 51ms, prepare 38.84s)
ELD rows=80; top 10 by gapMaxMs:
ELD gap=72791 eldMax=72880 p99=72880 wall=72788 pid=14276 ended=2026-09-26T06:24:55.942Z hook.test.ts
ELD gap=41047 eldMax=41071 p99=41071 wall=41046 pid=12268 ended=2026-09-26T06:24:07.162Z state-import-r2.test.ts
ELD gap=36975 eldMax=37011 p99=37011 wall=36974 pid=12864 ended=2026-09-26T06:25:22.760Z staleness.test.ts
ELD gap=33220 eldMax=33252 p99=33252 wall=33219 pid=8508 ended=2026-09-26T06:24:44.030Z cli-bootstrap.test.ts
ELD gap=31347 eldMax=31357 p99=31357 wall=31347 pid=12368 ended=2026-09-26T06:24:08.687Z state-import-r4.test.ts
ELD gap=22901 eldMax=22918 p99=22918 wall=22900 pid=7344 ended=2026-09-26T06:26:23.831Z derived-artifacts.test.ts
ELD gap=15667 eldMax=15670 p99=15670 wall=15667 pid=3576 ended=2026-09-26T06:25:13.182Z state-import-staleness.test.ts
ELD gap=13230 eldMax=13220 p99=13220 wall=89746 pid=12736 ended=2026-09-26T06:25:54.869Z cli.test.ts
ELD gap=12572 eldMax=12549 p99=11845 wall=270849 pid=10684 ended=2026-09-26T06:24:40.191Z runtime.test.ts
ELD gap=12424 eldMax=12407 p99=12407 wall=75394 pid=17752 ended=2026-09-26T06:26:01.798Z gate-artifacts.test.ts
```
Whole ELD table from the artifact: 80 rows (80 distinct files); rows with gapMaxMs or eldMaxMs ≥ 30 000: hook.test.ts gap=72791 eld=72880; state-import-r2.test.ts gap=41047 eld=41071; staleness.test.ts gap=36975 eld=37011; cli-bootstrap.test.ts gap=33220 eld=33252; state-import-r4.test.ts gap=31347 eld=31357; ≥ 60 000: 1; max eldMaxMs 72880. TOP5 rows over 15 % of a core outside Runner.*/powershell/WmiPrvSE: none.

**B-1 R1 #2: run 36223569425**, head `ee0566d` (`loop/15-slice-3-b-step1-base`), artifact `step0-36223569425-1`, tcm `test` job success.
```
BASELINE cpu_load_pct=2 samples=2,2,2 free_ram_mb=2109 total_ram_mb=8048 at=2026-09-26T06:28:52.1005923Z
BASELINE_QUIET
TOP5 svchost#32 pid=3148 cpu_pct=0 ws_mb=6
TOP5 svchost#31 pid=2256 cpu_pct=0 ws_mb=6
TOP5 svchost#30 pid=2240 cpu_pct=0 ws_mb=14
TOP5 svchost#35 pid=3520 cpu_pct=0 ws_mb=8
TOP5 svchost#34 pid=3512 cpu_pct=0 ws_mb=8
> vitest run --testTimeout=30000
PARAMS cpu=0 disk=0 spawn=2 children=2 started=2026-09-26T06:28:52.873Z stopped=2026-09-26T06:33:43.743Z
SUITE_EXIT=1 capped=False deadBeforeStop=0 leakedByReport=0 aliveNow=0
ON_TASK_UPDATE_TIMEOUTS=1
Test Files 80 passed (80)
Tests 1226 passed (1226)
Errors 1 error
Duration 286.98s (transform 8.12s, setup 4.73s, collect 51.20s, tests 1344.86s, environment 59ms, prepare 38.59s)
ELD rows=80; top 10 by gapMaxMs:
ELD gap=81579 eldMax=81604 p99=81604 wall=81576 pid=4092 ended=2026-09-26T06:30:45.099Z hook.test.ts
ELD gap=46225 eldMax=46272 p99=46272 wall=46224 pid=12804 ended=2026-09-26T06:29:51.551Z state-import-r2.test.ts
ELD gap=40444 eldMax=40467 p99=40467 wall=40443 pid=10760 ended=2026-09-26T06:31:14.507Z staleness.test.ts
ELD gap=35751 eldMax=35769 p99=35769 wall=35750 pid=15048 ended=2026-09-26T06:30:30.987Z cli-bootstrap.test.ts
ELD gap=34423 eldMax=34460 p99=34460 wall=34422 pid=1276 ended=2026-09-26T06:29:51.251Z state-import-r4.test.ts
ELD gap=23234 eldMax=23236 p99=23236 wall=23233 pid=7232 ended=2026-09-26T06:32:12.840Z derived-artifacts.test.ts
ELD gap=18256 eldMax=18270 p99=18270 wall=18256 pid=3584 ended=2026-09-26T06:31:04.985Z state-import-staleness.test.ts
ELD gap=14017 eldMax=13959 p99=13397 wall=282564 pid=11968 ended=2026-09-26T06:30:01.947Z runtime.test.ts
ELD gap=13842 eldMax=13841 p99=13841 wall=86804 pid=12076 ended=2026-09-26T06:32:06.228Z cli.test.ts
ELD gap=13725 eldMax=13715 p99=12826 wall=138385 pid=16704 ended=2026-09-26T06:30:03.226Z refwatch-stage.test.ts
```
Whole ELD table from the artifact: 80 rows (80 distinct files); rows with gapMaxMs or eldMaxMs ≥ 30 000: hook.test.ts gap=81579 eld=81604; state-import-r2.test.ts gap=46225 eld=46272; staleness.test.ts gap=40444 eld=40467; cli-bootstrap.test.ts gap=35751 eld=35769; state-import-r4.test.ts gap=34423 eld=34460; ≥ 60 000: 1; max eldMaxMs 81604. TOP5 rows over 15 % of a core outside Runner.*/powershell/WmiPrvSE: none.

**B-1 R1 #3: run 36223572911**, head `ee0566d` (`loop/15-slice-3-b-step1-base`), artifact `step0-36223572911-1`, tcm `test` job success.
```
BASELINE cpu_load_pct=0.7 samples=1,0,1 free_ram_mb=2113 total_ram_mb=8048 at=2026-09-26T06:34:43.0201000Z
BASELINE_QUIET
TOP5 svchost#32 pid=3148 cpu_pct=0 ws_mb=6
TOP5 svchost#31 pid=2256 cpu_pct=0 ws_mb=6
TOP5 svchost#30 pid=2240 cpu_pct=0 ws_mb=14
TOP5 svchost#35 pid=3520 cpu_pct=0 ws_mb=8
TOP5 svchost#34 pid=3512 cpu_pct=0 ws_mb=8
> vitest run --testTimeout=30000
PARAMS cpu=0 disk=0 spawn=2 children=2 started=2026-09-26T06:34:43.787Z stopped=2026-09-26T06:39:52.787Z
SUITE_EXIT=1 capped=False deadBeforeStop=0 leakedByReport=0 aliveNow=0
ON_TASK_UPDATE_TIMEOUTS=1
Test Files 80 passed (80)
Tests 1226 passed (1226)
Errors 1 error
Duration 305.11s (transform 8.46s, setup 4.82s, collect 53.61s, tests 1428.60s, environment 70ms, prepare 41.05s)
ELD rows=80; top 10 by gapMaxMs:
ELD gap=84448 eldMax=84490 p99=84490 wall=84444 pid=13708 ended=2026-09-26T06:36:39.403Z hook.test.ts
ELD gap=46771 eldMax=46775 p99=46775 wall=46769 pid=17912 ended=2026-09-26T06:35:43.013Z state-import-r2.test.ts
ELD gap=40579 eldMax=40601 p99=40601 wall=40578 pid=14792 ended=2026-09-26T06:36:27.395Z cli-bootstrap.test.ts
ELD gap=36860 eldMax=36876 p99=36876 wall=36859 pid=17776 ended=2026-09-26T06:37:06.580Z staleness.test.ts
ELD gap=34533 eldMax=34561 p99=34561 wall=34532 pid=11568 ended=2026-09-26T06:35:42.092Z state-import-r4.test.ts
ELD gap=22751 eldMax=22767 p99=22767 wall=22751 pid=8052 ended=2026-09-26T06:38:16.129Z derived-artifacts.test.ts
ELD gap=16260 eldMax=16240 p99=14168 wall=144462 pid=10532 ended=2026-09-26T06:35:59.084Z refwatch-stage.test.ts
ELD gap=15998 eldMax=15972 p99=15762 wall=300523 pid=2672 ended=2026-09-26T06:36:11.285Z runtime.test.ts
ELD gap=15541 eldMax=15561 p99=15561 wall=15538 pid=6424 ended=2026-09-26T06:36:56.615Z state-import-staleness.test.ts
ELD gap=15277 eldMax=15242 p99=15242 wall=85701 pid=1760 ended=2026-09-26T06:37:44.042Z gate-artifacts.test.ts
```
Whole ELD table from the artifact: 80 rows (80 distinct files); rows with gapMaxMs or eldMaxMs ≥ 30 000: hook.test.ts gap=84448 eld=84490; state-import-r2.test.ts gap=46771 eld=46775; cli-bootstrap.test.ts gap=40579 eld=40601; staleness.test.ts gap=36860 eld=36876; state-import-r4.test.ts gap=34533 eld=34561; ≥ 60 000: 1; max eldMaxMs 84490. TOP5 rows over 15 % of a core outside Runner.*/powershell/WmiPrvSE: none.

**B-1 RH #1: run 36223575964**, head `ee0566d` (`loop/15-slice-3-b-step1-base`), artifact `step0-36223575964-1`, tcm `test` job success.
```
BASELINE cpu_load_pct=5 samples=1,12,2 free_ram_mb=1992 total_ram_mb=8048 at=2026-09-26T06:40:51.5953405Z
BASELINE_QUIET
TOP5 WmiPrvSE#2 pid=18224 cpu_pct=5 ws_mb=16
TOP5 svchost#30 pid=2240 cpu_pct=0 ws_mb=14
TOP5 svchost#34 pid=3512 cpu_pct=0 ws_mb=8
TOP5 svchost#31 pid=2256 cpu_pct=0 ws_mb=6
TOP5 svchost#33 pid=3308 cpu_pct=0 ws_mb=8
> vitest run --testTimeout=30000
PARAMS cpu=0 disk=0 spawn=4 children=4 started=2026-09-26T06:40:57.138Z stopped=2026-09-26T06:47:14.053Z
SUITE_EXIT=1 capped=False deadBeforeStop=0 leakedByReport=0 aliveNow=0
ON_TASK_UPDATE_TIMEOUTS=2
Test Files 80 passed (80)
Tests 1226 passed (1226)
Errors 2 errors
Duration 371.73s (transform 9.94s, setup 4.97s, collect 51.92s, tests 1690.69s, environment 58ms, prepare 43.78s)
ELD rows=80; top 10 by gapMaxMs:
ELD gap=99420 eldMax=99455 p99=99455 wall=99415 pid=16236 ended=2026-09-26T06:43:14.350Z hook.test.ts
ELD gap=64892 eldMax=64928 p99=64928 wall=64891 pid=17820 ended=2026-09-26T06:42:15.396Z state-import-r2.test.ts
ELD gap=51954 eldMax=51976 p99=51976 wall=51953 pid=17504 ended=2026-09-26T06:42:16.214Z state-import-r4.test.ts
ELD gap=48649 eldMax=48654 p99=48654 wall=48648 pid=11640 ended=2026-09-26T06:43:52.113Z staleness.test.ts
ELD gap=40547 eldMax=40567 p99=40567 wall=40546 pid=15480 ended=2026-09-26T06:43:01.501Z cli-bootstrap.test.ts
ELD gap=28080 eldMax=28085 p99=28085 wall=28079 pid=10740 ended=2026-09-26T06:45:03.934Z derived-artifacts.test.ts
ELD gap=20061 eldMax=20032 p99=20032 wall=59546 pid=7240 ended=2026-09-26T06:42:06.013Z policies.test.ts
ELD gap=19704 eldMax=19680 p99=18337 wall=366964 pid=7624 ended=2026-09-26T06:41:58.129Z runtime.test.ts
ELD gap=19172 eldMax=19176 p99=19176 wall=19172 pid=18300 ended=2026-09-26T06:43:35.112Z state-import-staleness.test.ts
ELD gap=18390 eldMax=18388 p99=16047 wall=174049 pid=12248 ended=2026-09-26T06:42:16.437Z refwatch-stage.test.ts
```
Whole ELD table from the artifact: 80 rows (80 distinct files); rows with gapMaxMs or eldMaxMs ≥ 30 000: hook.test.ts gap=99420 eld=99455; state-import-r2.test.ts gap=64892 eld=64928; state-import-r4.test.ts gap=51954 eld=51976; staleness.test.ts gap=48649 eld=48654; cli-bootstrap.test.ts gap=40547 eld=40567; ≥ 60 000: 2; max eldMaxMs 99455. TOP5 rows over 15 % of a core outside Runner.*/powershell/WmiPrvSE: none.

**B-2 R1 #1: run 36224895526**, head `e815e3d` (`loop/15-slice-3-b-step1-candidate`), artifact `step0-36224895526-1`, tcm `test` job success.
```
BASELINE cpu_load_pct=2.3 samples=1,3,3 free_ram_mb=3260 total_ram_mb=8048 at=2026-09-26T06:54:40.7592200Z
BASELINE_QUIET
TOP5 svchost#32 pid=3148 cpu_pct=0 ws_mb=7
TOP5 svchost#31 pid=2256 cpu_pct=0 ws_mb=6
TOP5 svchost#30 pid=2240 cpu_pct=0 ws_mb=14
TOP5 svchost#35 pid=3520 cpu_pct=0 ws_mb=8
TOP5 svchost#34 pid=3512 cpu_pct=0 ws_mb=8
> vitest run --testTimeout=30000
PARAMS cpu=0 disk=0 spawn=2 children=2 started=2026-09-26T06:54:41.508Z stopped=2026-09-26T07:00:01.158Z
SUITE_EXIT=0 capped=False deadBeforeStop=0 leakedByReport=0 aliveNow=0
ON_TASK_UPDATE_TIMEOUTS=0
Test Files 81 passed (81)
Tests 1231 passed (1231)
Duration 315.89s (transform 8.99s, setup 5.25s, collect 46.96s, tests 1506.87s, environment 91ms, prepare 43.03s)
ELD rows=81; top 10 by gapMaxMs:
ELD gap=21751 eldMax=21726 p99=18606 wall=312410 pid=18356 ended=2026-09-26T06:56:10.547Z runtime.test.ts
ELD gap=18008 eldMax=18002 p99=18002 wall=101217 pid=14916 ended=2026-09-26T06:58:18.362Z cli.test.ts
ELD gap=16508 eldMax=16458 p99=14177 wall=150735 pid=2740 ended=2026-09-26T06:55:51.822Z refwatch-stage.test.ts
ELD gap=15020 eldMax=14982 p99=14982 wall=85107 pid=1500 ended=2026-09-26T06:58:00.802Z gate-artifacts.test.ts
ELD gap=14915 eldMax=14839 p99=12575 wall=86626 pid=5516 ended=2026-09-26T06:56:04.191Z tree-currency.test.ts
ELD gap=14678 eldMax=14647 p99=14647 wall=52870 pid=16812 ended=2026-09-26T06:58:00.723Z refwatch.test.ts
ELD gap=13732 eldMax=13749 p99=13749 wall=13731 pid=13544 ended=2026-09-26T06:56:05.446Z checks.test.ts
ELD gap=11929 eldMax=11912 p99=11912 wall=38293 pid=13364 ended=2026-09-26T06:55:26.560Z policies.test.ts
ELD gap=8427 eldMax=8431 p99=8431 wall=8426 pid=12248 ended=2026-09-26T06:54:56.612Z state-writer.test.ts
ELD gap=8231 eldMax=8204 p99=8204 wall=48817 pid=13380 ended=2026-09-26T06:57:50.854Z detach.test.ts
```
Whole ELD table from the artifact: 81 rows (81 distinct files); rows with gapMaxMs or eldMaxMs ≥ 30 000: none; ≥ 60 000: 0; max eldMaxMs 21726. TOP5 rows over 15 % of a core outside Runner.*/powershell/WmiPrvSE: none.

**B-2 R1 #2: run 36224899537**, head `e815e3d` (`loop/15-slice-3-b-step1-candidate`), artifact `step0-36224899537-1`, tcm `test` job success.
```
BASELINE cpu_load_pct=2.3 samples=1,0,6 free_ram_mb=1980 total_ram_mb=8048 at=2026-09-26T07:00:59.5859658Z
BASELINE_QUIET
TOP5 WmiPrvSE#2 pid=8816 cpu_pct=5 ws_mb=15
TOP5 svchost#32 pid=3148 cpu_pct=0 ws_mb=7
TOP5 svchost#31 pid=2256 cpu_pct=0 ws_mb=6
TOP5 svchost#35 pid=3520 cpu_pct=0 ws_mb=8
TOP5 svchost#34 pid=3512 cpu_pct=0 ws_mb=8
> vitest run --testTimeout=30000
PARAMS cpu=0 disk=0 spawn=2 children=2 started=2026-09-26T07:01:05.118Z stopped=2026-09-26T07:06:09.056Z
SUITE_EXIT=0 capped=False deadBeforeStop=0 leakedByReport=0 aliveNow=0
ON_TASK_UPDATE_TIMEOUTS=0
Test Files 81 passed (81)
Tests 1231 passed (1231)
Duration 300.07s (transform 9.18s, setup 4.85s, collect 47.73s, tests 1434.40s, environment 63ms, prepare 41.38s)
ELD rows=81; top 10 by gapMaxMs:
ELD gap=17616 eldMax=17583 p99=15460 wall=142540 pid=16548 ended=2026-09-26T07:02:08.206Z refwatch-stage.test.ts
ELD gap=16647 eldMax=16635 p99=16458 wall=296301 pid=7444 ended=2026-09-26T07:02:23.252Z runtime.test.ts
ELD gap=15858 eldMax=15804 p99=15804 wall=44435 pid=2328 ended=2026-09-26T07:01:56.688Z policies.test.ts
ELD gap=14556 eldMax=14529 p99=14529 wall=80134 pid=12552 ended=2026-09-26T07:03:56.285Z gate-artifacts.test.ts
ELD gap=13954 eldMax=13950 p99=13950 wall=45379 pid=10652 ended=2026-09-26T07:04:11.915Z refwatch.test.ts
ELD gap=12865 eldMax=12860 p99=12860 wall=94018 pid=17120 ended=2026-09-26T07:04:03.543Z cli.test.ts
ELD gap=10602 eldMax=10553 p99=9848 wall=92796 pid=14732 ended=2026-09-26T07:02:08.337Z cli-flags.test.ts
ELD gap=9956 eldMax=9957 p99=9957 wall=9955 pid=2588 ended=2026-09-26T07:03:53.155Z greeting-size.test.ts
ELD gap=9649 eldMax=9622 p99=7898 wall=68765 pid=3108 ended=2026-09-26T07:02:35.878Z tree-currency.test.ts
ELD gap=9025 eldMax=9026 p99=9026 wall=9025 pid=10576 ended=2026-09-26T07:02:32.602Z checks.test.ts
```
Whole ELD table from the artifact: 81 rows (81 distinct files); rows with gapMaxMs or eldMaxMs ≥ 30 000: none; ≥ 60 000: 0; max eldMaxMs 17583. TOP5 rows over 15 % of a core outside Runner.*/powershell/WmiPrvSE: none.

**B-2 R1 #3: run 36224903440**, head `e815e3d` (`loop/15-slice-3-b-step1-candidate`), artifact `step0-36224903440-1`, tcm `test` job success.
```
BASELINE cpu_load_pct=1 samples=2,0,1 free_ram_mb=1941 total_ram_mb=8048 at=2026-09-26T07:07:09.5229230Z
BASELINE_QUIET
TOP5 WmiPrvSE#2 pid=15816 cpu_pct=5 ws_mb=15
TOP5 svchost#30 pid=2240 cpu_pct=0 ws_mb=14
TOP5 svchost#34 pid=3512 cpu_pct=0 ws_mb=8
TOP5 svchost#31 pid=2256 cpu_pct=0 ws_mb=6
TOP5 svchost#33 pid=3308 cpu_pct=0 ws_mb=8
> vitest run --testTimeout=30000
PARAMS cpu=0 disk=0 spawn=2 children=2 started=2026-09-26T07:07:10.281Z stopped=2026-09-26T07:12:22.677Z
SUITE_EXIT=0 capped=False deadBeforeStop=0 leakedByReport=0 aliveNow=0
ON_TASK_UPDATE_TIMEOUTS=0
Test Files 81 passed (81)
Tests 1231 passed (1231)
Duration 308.51s (transform 9.68s, setup 4.96s, collect 48.82s, tests 1459.43s, environment 56ms, prepare 41.58s)
ELD rows=81; top 10 by gapMaxMs:
ELD gap=17291 eldMax=17264 p99=14093 wall=303963 pid=12076 ended=2026-09-26T07:08:53.951Z runtime.test.ts
ELD gap=16359 eldMax=16333 p99=15158 wall=153423 pid=9504 ended=2026-09-26T07:09:20.247Z refwatch-stage.test.ts
ELD gap=14943 eldMax=14881 p99=8791 wall=86902 pid=11944 ended=2026-09-26T07:09:14.479Z tree-currency.test.ts
ELD gap=14390 eldMax=14395 p99=14395 wall=83123 pid=8204 ended=2026-09-26T07:09:35.927Z gate-artifacts.test.ts
ELD gap=13221 eldMax=13212 p99=13187 wall=100381 pid=16188 ended=2026-09-26T07:10:14.236Z cli.test.ts
ELD gap=12678 eldMax=12650 p99=12650 wall=45522 pid=12728 ended=2026-09-26T07:10:26.483Z refwatch.test.ts
ELD gap=11053 eldMax=11048 p99=11048 wall=46007 pid=8808 ended=2026-09-26T07:08:51.613Z role-files.test.ts
ELD gap=10125 eldMax=10108 p99=10108 wall=34739 pid=1684 ended=2026-09-26T07:07:53.007Z policies.test.ts
ELD gap=8073 eldMax=8074 p99=8074 wall=8144 pid=17144 ended=2026-09-26T07:09:18.715Z cli-args.test.ts
ELD gap=7951 eldMax=7973 p99=7973 wall=7951 pid=2504 ended=2026-09-26T07:07:26.131Z state-writer.test.ts
```
Whole ELD table from the artifact: 81 rows (81 distinct files); rows with gapMaxMs or eldMaxMs ≥ 30 000: none; ≥ 60 000: 0; max eldMaxMs 17264. TOP5 rows over 15 % of a core outside Runner.*/powershell/WmiPrvSE: none.

**B-3 RH #1: run 36224907891**, head `e815e3d` (`loop/15-slice-3-b-step1-candidate`), artifact `step0-36224907891-1`, tcm `test` job success.
```
BASELINE cpu_load_pct=0.3 samples=0,0,1 free_ram_mb=2180 total_ram_mb=8048 at=2026-09-26T07:13:24.2544696Z
BASELINE_QUIET
TOP5 WUDFHost#1 pid=1252 cpu_pct=5 ws_mb=20
TOP5 svchost#31 pid=2256 cpu_pct=0 ws_mb=6
TOP5 svchost#29 pid=2168 cpu_pct=0 ws_mb=7
TOP5 svchost#30 pid=2240 cpu_pct=0 ws_mb=14
TOP5 svchost#34 pid=3512 cpu_pct=0 ws_mb=8
> vitest run --testTimeout=30000
PARAMS cpu=0 disk=0 spawn=4 children=4 started=2026-09-26T07:13:25.011Z stopped=2026-09-26T07:19:21.910Z
SUITE_EXIT=0 capped=False deadBeforeStop=0 leakedByReport=0 aliveNow=0
ON_TASK_UPDATE_TIMEOUTS=0
Test Files 81 passed (81)
Tests 1231 passed (1231)
Duration 351.76s (transform 15.08s, setup 5.27s, collect 58.53s, tests 1607.07s, environment 61ms, prepare 42.93s)
ELD rows=81; top 10 by gapMaxMs:
ELD gap=26789 eldMax=26743 p99=19579 wall=346805 pid=10440 ended=2026-09-26T07:15:13.811Z runtime.test.ts
ELD gap=19201 eldMax=19193 p99=13665 wall=160069 pid=7256 ended=2026-09-26T07:15:12.875Z refwatch-stage.test.ts
ELD gap=18725 eldMax=18723 p99=14999 wall=103597 pid=5748 ended=2026-09-26T07:17:22.697Z cli.test.ts
ELD gap=16980 eldMax=16962 p99=16962 wall=89002 pid=8116 ended=2026-09-26T07:17:13.757Z gate-artifacts.test.ts
ELD gap=13849 eldMax=13774 p99=13657 wall=96810 pid=7876 ended=2026-09-26T07:14:46.103Z tree-currency.test.ts
ELD gap=13356 eldMax=13288 p99=13288 wall=52655 pid=7552 ended=2026-09-26T07:17:18.836Z refwatch.test.ts
ELD gap=12575 eldMax=12600 p99=12600 wall=12574 pid=9444 ended=2026-09-26T07:14:43.696Z checks.test.ts
ELD gap=11780 eldMax=11761 p99=11761 wall=37078 pid=8812 ended=2026-09-26T07:14:11.769Z policies.test.ts
ELD gap=10351 eldMax=10335 p99=10335 wall=59129 pid=11080 ended=2026-09-26T07:15:36.978Z role-files.test.ts
ELD gap=8280 eldMax=8280 p99=8280 wall=8277 pid=8932 ended=2026-09-26T07:13:42.690Z state-writer.test.ts
```
Whole ELD table from the artifact: 81 rows (81 distinct files); rows with gapMaxMs or eldMaxMs ≥ 30 000: none; ≥ 60 000: 0; max eldMaxMs 26743. TOP5 rows over 15 % of a core outside Runner.*/powershell/WmiPrvSE: none.

**B-3 RH #2: run 36224912574**, head `e815e3d` (`loop/15-slice-3-b-step1-candidate`), artifact `step0-36224912574-1`, tcm `test` job success.
```
BASELINE cpu_load_pct=0 samples=0,0,0 free_ram_mb=2243 total_ram_mb=8048 at=2026-09-26T07:20:21.2513849Z
BASELINE_QUIET
TOP5 svchost#32 pid=3148 cpu_pct=0 ws_mb=7
TOP5 svchost#31 pid=2256 cpu_pct=0 ws_mb=6
TOP5 svchost#30 pid=2240 cpu_pct=0 ws_mb=14
TOP5 svchost#35 pid=3520 cpu_pct=0 ws_mb=8
TOP5 svchost#34 pid=3512 cpu_pct=0 ws_mb=8
> vitest run --testTimeout=30000
PARAMS cpu=0 disk=0 spawn=4 children=4 started=2026-09-26T07:20:26.841Z stopped=2026-09-26T07:26:53.066Z
SUITE_EXIT=0 capped=False deadBeforeStop=0 leakedByReport=0 aliveNow=0
ON_TASK_UPDATE_TIMEOUTS=0
Test Files 81 passed (81)
Tests 1231 passed (1231)
Duration 380.75s (transform 11.45s, setup 5.40s, collect 62.69s, tests 1768.52s, environment 85ms, prepare 47.03s)
ELD rows=81; top 10 by gapMaxMs:
ELD gap=21036 eldMax=21005 p99=21005 wall=63454 pid=11328 ended=2026-09-26T07:21:23.889Z policies.test.ts
ELD gap=20577 eldMax=20535 p99=17331 wall=375043 pid=6924 ended=2026-09-26T07:21:33.204Z runtime.test.ts
ELD gap=20078 eldMax=20066 p99=20066 wall=116149 pid=10036 ended=2026-09-26T07:24:35.414Z cli.test.ts
ELD gap=18345 eldMax=18304 p99=18304 wall=102539 pid=15960 ended=2026-09-26T07:24:42.256Z gate-artifacts.test.ts
ELD gap=16792 eldMax=16786 p99=16769 wall=180230 pid=9220 ended=2026-09-26T07:21:49.829Z refwatch-stage.test.ts
ELD gap=15790 eldMax=15771 p99=15771 wall=62298 pid=15060 ended=2026-09-26T07:24:05.528Z refwatch.test.ts
ELD gap=13617 eldMax=13648 p99=13648 wall=13614 pid=5396 ended=2026-09-26T07:20:50.946Z state-writer.test.ts
ELD gap=10889 eldMax=10897 p99=10897 wall=10886 pid=1892 ended=2026-09-26T07:20:48.919Z checks.test.ts
ELD gap=10868 eldMax=10805 p99=8531 wall=99328 pid=10760 ended=2026-09-26T07:21:37.906Z cli-flags.test.ts
ELD gap=10809 eldMax=10779 p99=9907 wall=84526 pid=1368 ended=2026-09-26T07:23:01.206Z tree-currency.test.ts
```
Whole ELD table from the artifact: 81 rows (81 distinct files); rows with gapMaxMs or eldMaxMs ≥ 30 000: none; ≥ 60 000: 0; max eldMaxMs 21005. TOP5 rows over 15 % of a core outside Runner.*/powershell/WmiPrvSE: none.

**B-3 RH #3: run 36224916869**, head `e815e3d` (`loop/15-slice-3-b-step1-candidate`), artifact `step0-36224916869-1`, tcm `test` job success.
```
BASELINE cpu_load_pct=2.7 samples=1,3,4 free_ram_mb=2330 total_ram_mb=8048 at=2026-09-26T07:27:54.5996620Z
BASELINE_QUIET
TOP5 claude pid=8980 cpu_pct=5 ws_mb=364
TOP5 svchost#30 pid=2240 cpu_pct=0 ws_mb=14
TOP5 svchost#34 pid=3512 cpu_pct=0 ws_mb=8
TOP5 svchost#31 pid=2256 cpu_pct=0 ws_mb=6
TOP5 svchost#33 pid=3308 cpu_pct=0 ws_mb=8
> vitest run --testTimeout=30000
PARAMS cpu=0 disk=0 spawn=4 children=4 started=2026-09-26T07:27:55.372Z stopped=2026-09-26T07:33:57.453Z
SUITE_EXIT=0 capped=False deadBeforeStop=0 leakedByReport=0 aliveNow=0
ON_TASK_UPDATE_TIMEOUTS=0
Test Files 81 passed (81)
Tests 1231 passed (1231)
Duration 355.81s (transform 11.11s, setup 5.98s, collect 64.46s, tests 1566.53s, environment 67ms, prepare 51.09s)
ELD rows=81; top 10 by gapMaxMs:
ELD gap=18261 eldMax=18237 p99=16568 wall=347143 pid=2284 ended=2026-09-26T07:29:32.157Z runtime.test.ts
ELD gap=15637 eldMax=15552 p99=15552 wall=87894 pid=10604 ended=2026-09-26T07:30:49.424Z gate-artifacts.test.ts
ELD gap=15511 eldMax=15494 p99=12675 wall=150667 pid=7716 ended=2026-09-26T07:29:15.098Z refwatch-stage.test.ts
ELD gap=14874 eldMax=14865 p99=14865 wall=47450 pid=12748 ended=2026-09-26T07:31:17.651Z refwatch.test.ts
ELD gap=13905 eldMax=13900 p99=13900 wall=44940 pid=17300 ended=2026-09-26T07:28:42.643Z policies.test.ts
ELD gap=12808 eldMax=12801 p99=12801 wall=115497 pid=7140 ended=2026-09-26T07:31:36.646Z cli.test.ts
ELD gap=12643 eldMax=12591 p99=10360 wall=82379 pid=10084 ended=2026-09-26T07:29:31.225Z tree-currency.test.ts
ELD gap=10895 eldMax=10897 p99=10897 wall=10894 pid=16308 ended=2026-09-26T07:30:58.866Z greeting-size.test.ts
ELD gap=10760 eldMax=10788 p99=10788 wall=10760 pid=9920 ended=2026-09-26T07:29:29.932Z checks.test.ts
ELD gap=10586 eldMax=10603 p99=10603 wall=10582 pid=11816 ended=2026-09-26T07:28:19.821Z state-writer.test.ts
```
Whole ELD table from the artifact: 81 rows (81 distinct files); rows with gapMaxMs or eldMaxMs ≥ 30 000: none; ≥ 60 000: 0; max eldMaxMs 18237. TOP5 rows over 15 % of a core outside Runner.*/powershell/WmiPrvSE: none.

## 7. Per criterion

| | Criterion | Verdict | Evidence |
|---|---|---|---|
| B-0.1 | Tools unchanged | **met** | `git diff b32d3b8 e815e3d -- load-generator.mjs eld-setup.ts vitest.config.ts` is empty. `ci.yml` differs by one hunk, E-4's (`a984b15`), which rulings §7.5 allow. |
| B-0.2 | Nothing masks the symptom | **met** | Added lines in `ee0566d..e815e3d` contain no `retry`, `testTimeout`, `maxWorkers`/`minWorkers`/`fileParallelism`/pool options, no global-timer replacement, no `patch-package` or `postinstall`. Vitest's version is untouched (`package.json` is not in the diff). |
| B-0.3 | Nothing removed | **met** | No `.skip`/`.todo`/`skipIf`/`runIf` added and no file deleted. Laptop: 81 files and 1231 passed in every candidate run, against 80 and 1226 at the base. tcm: 1230 + 1 skipped, against 1225 + 1. |
| B-1 | Red first on this base | **met** | R1 3 of 3 and RH 1 of 1 red for the right reason (§6). |
| B-2 | Green, R1, n = 3 | **met** | 3 of 3 green. |
| B-3 | Green, RH, n = 3 | **met** | 3 of 3 green. |
| B-4 | Every row < 30 s, six runs | **met** | Whole table read from each artifact: 0 rows at or over 30 000 in either column in all six runs. Worst is 26 789 / 26 743 (`runtime.test.ts`, RH #1). **The margin there is 1.12 ×.** |
| B-5.1 | No worker cap | **met** | None added. `ci.yml`'s ordinary step keeps its existing `--maxWorkers=2`, untouched. Every step0 command line is `vitest run --testTimeout=30000`. |
| B-5.2 | Revert mutant ≥ 30 s | **not mine to show** | QA's run. The hunks are in §5. |
| B-6 | Product code only where needed | **met, vacuously** | `open-brain/src/` is not in the diff. No safety argument is owed. |
| B-7.1 | tcm green | **met** | 36224925217: 81 files, 1230 passed + 1 skipped, 85.81 s. Base in the same window: 87.69 s (36224825024). QA's reference was 47.2 s; see §6 on tcm's load. |
| B-7.2 | Laptop ordinary, both SHAs | **met** | Candidate 305.46 s (36224921272), base 311.41 s (36224825024), both green. |
| B-7.3 | R1 wall ≤ 1.25 × base | **met** | Candidate median 308.51 s against base median 286.98 s: **1.075 ×**. |
| B-8 | Every run's record | **met** | §6, every step0 run in full, and the ordinary and tcm runs as the summary lines they have. |
| B-9 | A red under 60 s is H-main evidence | **not triggered** | No candidate run was red. The link from error to file is **correlation**: across B-1's four reds, errors = `onTaskUpdate` timeouts = files at or over 60 s (1, 1, 1, 2). No candidate run had a file over 30 s or an error. |

## 8. Observed and not resolved

- **One EPERM on the desktop, in `state-import-staleness.test.ts`, at the converted version.** It happened in the
  first ELD run: `EPERM: operation not permitted, rename …\.agents\state.import-report.md -> …\archive\…`, from
  `runCommit`'s own archive move (`src/pipelines/state-import/index.ts:939`) in a row that spawns nothing, and rolled
  back cleanly. The converted file then passed 14 more times; the original passed 14 of 14. **1 in 15 against 0 in 14
  cannot tell a cause from chance.** A Windows file lock on a just-written file (Defender, or the indexer) fits the
  message, and it is not verified. Not re-run away; reported.
- **The per-test stretches of the harness files** (§4) are the remaining exposure to B-4 at RH. They are the design's
  Step 1(a) and outside this step.

## 9. The desktop rule

No full suite ran on this desktop. Local runs were single files: each converted file and its original (with ELD),
`state-import-staleness` 29 more times for §8, the helper's test with three mutants, and the harness files once each
with a JSON reporter to find their long tests. `npx tsc --noEmit -p .` was clean before the push. The touched test
files were also type-checked with `--strict` (the project does not type-check tests, T-152); that check was shown to
catch the one precedence bug I had made and fixed.

## 10. /sync

`sync --check` before the commits and before the push: 24 passed, 3 issues, none from this diff. `retirements`
(`ENTITIES.md` names `dream` and `reflection queue`, on master), `greeting-size` (46 769 characters, the state render,
on master), and `build-freshness` (this checkout's local CLI; nothing in `src/` changed).
