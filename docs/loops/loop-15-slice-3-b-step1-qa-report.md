# Candidate B, Step 1 (the G-042 repair): QA scoring report

**By:** the QA seat, record session 129 · 2026-09-26 (UTC) · on the QA PC `desktop-o4egb1e`, headless, launched by
`docs/loops/qa-129/drive.ps1`. **Model:** Opus 5.5 (`claude-opus-5-5`). **Effort:** `high`. Both come from this
process's command line (`claude.exe -p … --model claude-opus-5-5 --effort high --permission-mode dontAsk`, PID 9484,
parent `drive.ps1` PID 13928). The transcript agrees: `~/.claude/projects/C--Users-Aaron-Melven-Worktrees-sia-qa/04c10046-4e5d-45b3-95bd-45ae55b0d4a9.jsonl`
has `"effort":"high"` and `"model":"claude-opus-5-5"` on 153 of 153 assistant records at the time of reading. The
stream-json init record (`%USERPROFILE%\sia-qa129\run-0.jsonl`) names the model and carries no effort field.
**Dispatch:** `docs/loops/loop-15-slice-3-b-dispatch-qa.md` (`3afddee`). **Scored against:** QA 123's B-0 to B-9
(`09482d7`), as adopted in `loop-15-slice-3-b-criteria-rulings.md`. **Candidate:** `e815e3d`. **Base + tools:**
`ee0566d`. **Handoff:** `285a8b2`.
**Preconditions:** `%USERPROFILE%\sia-qa125\done` exists. The only `claude.exe` running was this seat. `drive.meta`
records Defender exclusions `C:\qa-scratch,C:\qa-tmp` and `TEMP=C:\qa-tmp`.

---

## Verdict

**The G-042 repair (B Step 1, `e815e3d`) PASSES B-0 to B-9.** Every criterion is met on evidence I re-read from the
job logs and artifacts myself. I did not take any number from the handoff.

- **The fix is where the stretch was.** The seven converted files ran 15–99 s without a macrotask at the base. At the
  candidate they run 0.1–4.4 s, in all 9 candidate runs: the developer's 6 and my 3 (§6.1).
- **The revert mutant breaks the bound.** With every one of handoff §5's 117 hunks reverted (and nothing else),
  R1's worst row is `hook.test.ts` at **66 042 ms**, with 4 rows ≥ 30 s (B-5.2).
- **Three more laptop runs at the candidate, all counted, all green, every row under 30 s.** RH twice (worst 19.5 s and
  24.9 s), and one heavier row outside the criteria, `spawn=8`, twice RH's load (worst 26.8 s).
- **B-4's margin is the thin spot, and it is not in this diff.** Across the 6 candidate runs at RH or above (the developer's
  3 and my 3), the worst row is 18.3–26.8 s. Every one of them is a harness file whose stretch is a single test's synchronous run of the runtime
  (design Step 1(a)). The margin at the worst is **1.12×**.

**B as a whole is not accepted by this report.** `E_t`'s schema change (R10) is not in this candidate, and it has no
criteria yet (rulings §3). This report scores the G-042 repair only.

Two defects are recorded, both low, and neither fails a criterion (§8). D-1: `spawnAsync` never kills its child when
a test times out. On Windows, a `shell: true` grandchild outlives the whole vitest process (measured). D-2: four
mutants of the helper survive its own tests. The developer's EPERM did not reproduce in 160 runs here (§5). The
evidence places it in the Windows rename-flake class that predates the conversion.

---

## 1. How I read the criteria where they are ambiguous

- **"The base."** B-1's base is `d2685fd`, frozen by the brief (rulings §1), and tools on it are `ee0566d`. B-0.3's
  "base counts" are therefore `ee0566d`'s: 80 files and 1226 tests on the laptop, and 1225 passed plus 1 skipped on tcm.
  These equal `be7ddfb`'s. `d2685fd` differs from `be7ddfb` only by a docs file.
- **B-0.1 and E-4.** The tools must be byte-identical to `b32d3b8`'s except for one named hunk that fixes E-4's
  threshold (rulings §5). I read "named" as its own commit, citing E-4.
- **B-4's "every counted run of B-2 and B-3".** Its six runs are the developer's. Under §1's "no selection" rule, I read
  my own counted runs at the candidate under R1 or RH as held to the same bound, and a row ≥ 30 s in one of them as a
  B-4 failure. Both readings give the same result here. My `spawn=8` run is not an R1 or RH row, so it is reported
  and not scored.
- **B-5.2's "worst ELD row ≥ 30 000 ms".** I read it as either column. Both are over 30 000 in the mutant.
- **B-7.1's Duration.** It is "reported", not bounded. The criterion is green with counts.
- **B-7.2 "at the base".** The developer's base run is at `ee0566d`, which is base + tools. With `step0` off, the tools
  do nothing in that job, so I accept it as the base.
- **"Laptop at most 5, tcm at most 4".** Every laptop dispatch also runs tcm's `test` job (`ci.yml`: the `test` job has
  no condition on `windows`). Five laptop dispatches would have been five tcm jobs, so **I made 4 laptop dispatches**:
  the mutant plus three. That also made exactly 4 tcm jobs. This is under "Open for the planner", item 1.

---

## 2. The criteria, one by one

| | Criterion | Verdict | Evidence (all re-read by QA 129) |
|---|---|---|---|
| B-0.1 | Tools unchanged | **pass** | `git diff b32d3b8 e815e3d -- load-generator.mjs eld-setup.ts vitest.config.ts` is empty. `ci.yml` differs by one hunk (+3 −2), the baseline step's `$heavy` line, and `a984b15` alone makes it: `fix(b-step1): baseline step marks a process over 15 % of ONE core … (QA 123 E-4)`. The per-commit stats in `ee0566d..e815e3d` show no other commit touches `ci.yml`. `vitest.config.ts` adds `tests/eld-setup.ts` exactly when `OPEN_BRAIN_ELD_DIR` is set (read at `e815e3d`). |
| B-0.2 | Nothing masks the symptom | **pass** | I scanned the added lines of `git diff ee0566d e815e3d` for `retry`, `retries`, `timeout`/`testTimeout`, worker and pool options, `projects`, `patch-package`, `postinstall`, `node_modules`, fake timers, and global `setTimeout`/`setInterval`/`clearTimeout`. There are three hits: a `setInterval` and a `setTimeout` inside `spawn-async.test.ts`'s own event-loop row, which is a probe and not a setup-file patch, and a comment. `package.json` and `package-lock.json` are not in the diff, so vitest stays at 3.2.4 (`node_modules/vitest/package.json`, read). |
| B-0.3 | Nothing removed | **pass** | No `.skip`/`.todo`/`skipIf`/`runIf`/`.only` is added and no file is deleted (`--name-status`: 8 M, 2 A). **Test names are identical, before and after, in all 7 converted files** (extracted with a pattern and diffed; counts 13, 9, 18, 13, 8, 17, 9). In each file, the `expect(` lines removed equal those added. Laptop: 81 files and 1231 passed in every candidate run, all 9 of them, against 80 and 1226 at the base. tcm: 1230 passed and 1 skipped in all 4 of my tcm jobs and in the developer's, against 1225 and 1. |
| B-1 | Red first, on this base | **pass** | At `ee0566d`, R1 was red for the right reason in 3 of 3 runs (36223551849, 36223569425, 36223572911) and RH in 1 of 1 (36223575964). Each has `SUITE_EXIT=1`, and the `onTaskUpdate` timeout lines in the log equal `ON_TASK_UPDATE_TIMEOUTS`, which equals `Errors` (1, 1, 1, 2). Every test passed (80 files, 1226 tests). The worst rows were 72.8, 81.6, 84.4 and 99.4 s (§6.2). |
| B-2 | Green, R1, n = 3 | **pass** | 36224895526, 36224899537, 36224903440: `SUITE_EXIT=0`, `ON_TASK_UPDATE_TIMEOUTS=0`, no `Errors` line, 1231 of 1231 passed. |
| B-3 | Green, RH, n = 3 | **pass** | 36224907891, 36224912574, 36224916869: the same checks as B-2, all met. RH #3's `claude` process counts under §1's rule (§4). **My RH runs agree:** 36229262414 and 36229612533 are green too. |
| B-4 | Every row < 30 s, both columns | **pass** | Read from every row of each artifact's ELD JSONL, not the log's top ten: 81 rows and 81 distinct files in each run. The six runs' maxima (`gapMaxMs` / `eldMaxMs`) are 21 751/21 726, 17 616/17 583, 17 291/17 264, **26 789/26 743**, 21 036/21 005 and 18 261/18 237. My two RH runs are 19 475/19 445 and 24 869/24 864. No row is ≥ 30 000 in either column. |
| B-5.1 | No worker cap | **pass** | The diff adds no cap. Every step0 command line, in all 9 candidate runs and the mutant, is logged as `> vitest run --testTimeout=30000`, and the load generator's report says `cmd="npm test -- --testTimeout=30000"`. The ordinary step's `--maxWorkers=2` is untouched. |
| B-5.2 | Revert mutant ≥ 30 s | **pass** | `qa/b-step1-mutant` = `6c3b53b` (§3). R1 once: **36228947505**, counted. Worst row `hook.test.ts` **66 042 / 66 069 ms**. Also ≥ 30 s: `state-import-r2` 38 962, `sync/staleness` 36 175, `state-import-r4` 30 642. Exit 0, `ON_TASK_UPDATE_TIMEOUTS=0`, 1231 of 1231 passed, Duration 264.07 s. It was green, which the criterion allows for an n = 1 run. This is the second green run on record with a file over 60 s (§7, O-2). |
| B-6 | Product code only where needed | **pass (vacuous)** | Nothing under `open-brain/src/` is in `git diff --name-status ee0566d e815e3d`, so no safety argument is owed. |
| B-7.1 | tcm green | **pass** | Developer: 36224925217, 81 files, 1230 passed and 1 skipped, 85.81 s (base 87.69 s in the same window, 36224825024). Mine, at `e815e3d`: **46.84 s** (36229262414), **46.52 s** (36229612533) and **86.63 s** (36230004161). At the mutant `6c3b53b`: 46.16 s. The reference is 47.2 s at `7e8da33`. tcm's duration swings between about 46 s and 87 s at the same SHA, with its own load, which fits the developer's unverified reading. There is no regression. |
| B-7.2 | Laptop ordinary, both SHAs | **pass** | 36224825024 (`ee0566d`): `vitest run --testTimeout=30000 --maxWorkers=2`, 80 files and 1226 passed, 311.41 s. 36224921272 (`e815e3d`): the same command, 81 files and 1231 passed, 305.46 s. Both on `laptop-win`. |
| B-7.3 | R1 wall ≤ 1.25 × base | **pass** | Base R1 Durations 275.10, 286.98 and 305.11 s (median 286.98). Candidate 315.89, 300.07 and 308.51 s (median 308.51). **1.075 ×.** |
| B-8 | Every run's record | **pass** | For all 10 of the developer's step0 runs, I extracted the `BASELINE`, `BASELINE_QUIET` and `TOP5` lines, `PARAMS`, the `SUITE_EXIT … aliveNow` line, `ON_TASK_UPDATE_TIMEOUTS`, vitest's `Test Files`/`Tests`/`Errors`/`Duration`, the command line, `ELD rows` and the top ten, and the artifact name from the logs (anchored after the timestamp, per QA 123's E-2). Each matches handoff §6 line for line. The whole-table figures in each "Whole ELD table" sentence match the artifacts. Every run ran on `laptop-win` (`DESKTOP-0GV3HAD`). The loadgen JSON shows 0 dead, 0 never-beat, 0 alive and 0 leaked. |
| B-9 | Red under 60 s is H-main evidence | **not triggered** | No candidate run was red, the developer's 6 or my 3. In B-1's reds, errors = `onTaskUpdate` timeouts = files ≥ 60 s (1, 1, 1, 2). The handoff states this as correlation. The mutant adds a green run with a file at 66.0 s and no error (O-2). That does not contradict H-worker (design §1: the timer is armed at the call, not at the stretch's start), but it weakens "files ≥ 60 s = errors" as a count across all runs. |

**The counted-run rule (§1), applied to all 14 step0 runs read here:** every one has `BASELINE_QUIET`,
`cpu_load_pct` ≤ 5, `PARAMS` matching its row, `deadBeforeStop=0 leakedByReport=0 aliveNow=0`, `ELD rows` equal to
the tree's `*.test.ts` count (80 at `ee0566d`, 81 at `e815e3d` and `6c3b53b`, counted with `git ls-tree`), and its
artifact. The only non-exempt `TOP5` process above 0 % is `WUDFHost` at 5 % (36224907891) and `claude` at 5 %
(36224916869 and 36229612533). All are under 15 % of a core. **No run is discounted.**

---

## 3. B-5.2, the revert mutant

- **How it was built.** From `e815e3d`: `git revert --no-commit c6e8061 674d42e 54961a2 d696985 97a34b7 724b9b0 e815e3d`,
  exactly as handoff §5 says, committed as `6c3b53b` on `qa/b-step1-mutant` and pushed with `push-qa.mjs`.
- **That it reverts exactly the 117 hunks and keeps everything else:**
  - `git diff --cached a984b15` on the seven files was **empty**: each file is byte-identical to its pre-fix state.
  - The only remaining difference from `a984b15` is the helper, `spawn-async.ts` and `spawn-async.test.ts`, which is
    kept on purpose.
  - Hunks counted with `git diff -U0 <c>~1 <c>`: 19, 21, 19, 7, 8, 28 and 15, **117**. Every hunk header in handoff §5
    is identical to git's, compared by script, file by file.
- **The run:** 36228947505, R1, counted (record in §6.3). Worst row 66 042 ms, so **pass.** The mutant's profile is
  the base's: `hook` 66.0, `r2` 39.0, `sync/staleness` 36.2, `r4` 30.6, `cli-bootstrap` 29.9, `derived-artifacts` 22.8
  and `state-import-staleness` 15.4 s. The helper's presence therefore does not change what the seven files do.

---

## 4. RH #3's `claude` process

- **It counts under §1's rule.** `TOP5 claude pid=8980 cpu_pct=5 ws_mb=364`. `claude` is not in the exempt list
  (`Runner.*`, `powershell`, `WmiPrvSE`), but 5 % of one core is under the 15 % threshold.
- **It is not a CI job.** I listed every `test-windows` job since 06:00Z. `laptop-win` ran only B's jobs from 06:22 to
  07:40 and mine from 08:09 on. No other seat's job ran on the laptop in B's window.
- **It is a long-lived process on the laptop host.** The same PID 8980 is in **my** RH #2 baseline, 56 minutes later
  (36229612533, 08:23:49Z: `claude pid=8980 cpu_pct=5 ws_mb=366`). It appears only when it happens to use CPU as the
  baseline samples, so it was probably present, mostly idle, through every run of B's scoring. That includes the
  developer's other nine and my other three, where it may simply have been at 0 % and sorted below the idle
  `svchost`s. I could not see whose it is.
- **Whether it matters.** **Not for the verdict.**
  - It can only add load, never remove it, so it cannot make a green run look better than the row.
  - RH #3 is the mildest of the six RH-or-heavier candidate runs (worst 18.3 s).
  - With RH #3 discounted, B-3 would still have two counted greens from the developer and two from me. My RH #2 had
    the same process and was also green, at 24.9 s.
  - It matters for the protocol: "the laptop is B's for the whole scoring" (rulings, Cost) was not literally true.
    A Claude session was resident on the runner host, using about 365 MB of the laptop's 8 GB. The laptop had about
    2 GB free at every baseline.
  - "Open for the planner", item 3.

---

## 5. The developer's EPERM (`state-import-staleness`, `runCommit`'s rename)

**Not reproduced here: 0 in 160 runs, 80 of them the converted file.**

| Set | Variant | TEMP | ELD | Load | Runs | Failed | EPERM/EBUSY/EACCES lines |
|---|---|---|---|---|---|---|---|
| 1 | converted (`e815e3d`) | `C:\qa-tmp` (Defender-excluded) | off | none | 25 | 0 | 0 |
| 1 | converted | default `%TEMP%` (Defender scanning) | off | none | 25 | 0 | 0 |
| 1 | original (`ee0566d`'s file, same tree) | `C:\qa-tmp` | off | none | 25 | 0 | 0 |
| 1 | original | default `%TEMP%` | off | none | 25 | 0 | 0 |
| 2 | converted | default `%TEMP%` | **on** | `load-generator --spawn 4` | 30 | 0 | 0 |
| 2 | original | default `%TEMP%` | **on** | `load-generator --spawn 4` | 30 | 0 | 0 |

The variants were interleaved run by run, so time of day could not separate them. Set 2 ran from 08:31:10 to
08:43:59Z, inside the load generator's 1500 s cap (started 08:31:10Z, 4 spawn children), so every run in it was under
load. I stopped the generator when the loop ended (exit 143), and afterwards no `node` or `git` process was left. The original file was placed as
`tests/pipelines/qa129-staleness-orig.test.ts` in the same tree, so both ran against the same `node_modules` and `src/`.

**My reading: it is the Windows rename-flake class QA 122 recorded, not something the conversion introduced.** This
rests on four points and is **not proven**:

1. **The failing act is in-process.** The EPERM came from `runCommit`'s `renameSync` of `.agents/state.import-report.md`
   into the snapshot (`src/pipelines/state-import/index.ts`, the "Move the draft and the report" loop). It happened in
   a row that calls `runCommit` directly and spawns nothing. The conversion touches only the `cli()` helper, which
   those rows do not call. Every awaited child in the rows that do spawn has closed before its test returns: the
   helper settles on `'close'`, after exit and after stdio closed.
2. **Each row has its own directory.** `beforeEach` makes a fresh `mkdtemp` root, so a previous row's children, which
   had exited, wrote to a different tree.
3. **The class predates the conversion.** QA 122 recorded Windows rename EPERMs in the state-import suite at `78a7d13`
   and `4b88f5d`: N17's extra red in `state-import-atomic`, and the handoff's R41-reason flake. The planner accepted
   them as "the Windows rename EPERM flake class" (`importer-fixes-r4-rulings-qa122.md`, Disagreement 2). That was
   before any file used `spawnAsync`, and in a file this candidate does not convert. QA 111 also failed to reproduce
   the class on this PC in 63 runs.
4. **The one mechanism by which the conversion could plausibly matter** is a child still running when the next row
   starts. That happens only after a test timeout (D-1), and the developer's EPERM row had no preceding timeout.

A file lock taken by Defender or the indexer on a just-written file fits the message. This PC's excluded and
non-excluded TEMPs both stayed clean, so I cannot confirm that either.

---

## 6. Runs made by this seat, and the record read from the developer's

### 6.1 The seven converted files and the four worst harness files, `gapMaxMs` in seconds, from the artifacts

| Run | Head | Row | hook | r2 | sync/staleness | cli-bootstrap | r4 | derived-artifacts | import-staleness | runtime | policies | refwatch-stage | cli |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 36223551849 | ee0566d | R1 | 72.8 | 41.0 | 37.0 | 33.2 | 31.3 | 22.9 | 15.7 | 12.6 | 11.0 | 11.4 | 13.2 |
| 36223569425 | ee0566d | R1 | 81.6 | 46.2 | 40.4 | 35.8 | 34.4 | 23.2 | 18.3 | 14.0 | 12.5 | 13.7 | 13.8 |
| 36223572911 | ee0566d | R1 | 84.4 | 46.8 | 36.9 | 40.6 | 34.5 | 22.8 | 15.5 | 16.0 | 13.0 | 16.3 | 13.9 |
| 36223575964 | ee0566d | RH | 99.4 | 64.9 | 48.6 | 40.5 | 52.0 | 28.1 | 19.2 | 19.7 | 20.1 | 18.4 | 15.5 |
| 36224895526 | e815e3d | R1 | 0.4 | 1.0 | 1.1 | 0.2 | 2.2 | 1.7 | 1.4 | 21.8 | 11.9 | 16.5 | 18.0 |
| 36224899537 | e815e3d | R1 | 0.4 | 1.2 | 0.9 | 0.2 | 2.7 | 1.1 | 1.4 | 16.6 | 15.9 | 17.6 | 12.9 |
| 36224903440 | e815e3d | R1 | 0.3 | 0.8 | 1.6 | 0.1 | 1.8 | 1.2 | 2.6 | 17.3 | 10.1 | 16.4 | 13.2 |
| 36224907891 | e815e3d | RH | 0.3 | 0.9 | 1.5 | 0.2 | 1.8 | 2.0 | 1.6 | **26.8** | 11.8 | 19.2 | 18.7 |
| 36224912574 | e815e3d | RH | 0.5 | 1.5 | 1.1 | 0.2 | 2.4 | 2.1 | 2.0 | 20.6 | 21.0 | 16.8 | 20.1 |
| 36224916869 | e815e3d | RH | 0.4 | 1.2 | 1.0 | 0.2 | 2.2 | 1.1 | 1.3 | 18.3 | 13.9 | 15.5 | 12.8 |
| **36228947505** (QA, mutant) | 6c3b53b | R1 | **66.0** | 39.0 | 36.2 | 29.9 | 30.6 | 22.8 | 15.4 | 11.7 | 10.8 | 11.0 | 13.3 |
| **36229262414** (QA) | e815e3d | RH | 0.3 | 0.9 | 0.9 | 0.2 | 2.3 | 1.3 | 1.4 | 19.0 | 14.4 | 19.5 | 14.2 |
| **36229612533** (QA) | e815e3d | RH | 0.3 | 1.1 | 1.0 | 0.2 | 4.4 | 1.4 | 1.3 | 23.2 | 20.8 | **24.9** | 16.4 |
| **36230004161** (QA) | e815e3d | **spawn=8** | 0.6 | 1.7 | 1.4 | 0.2 | 2.8 | 1.9 | 1.8 | 26.1 | **26.8** | 20.3 | 20.1 |

### 6.2 This seat's four laptop dispatches (the dispatch's cap is 5; §1 says why 4), one at a time

All four were dispatched with `gh workflow run ci.yml --ref <branch> -f windows=true -f step0=true -f cpu=0 -f disk=0
-f spawn=K` and `workers` left empty. Branches: `qa/b-step1-mutant` = `6c3b53b`, and `qa/b-step1-cand` = `e815e3d`
exactly. I pinned my own branch so as not to dispatch on the developer's. Both were pushed with `push-qa.mjs` and read
back.

| # | Run | Head | Row | Baseline | SUITE_EXIT | onTaskUpdate | Files / Tests | Duration | Worst ELD (gap / eld, ms) | ≥ 30 s | tcm `test` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 36228947505 | 6c3b53b | R1 | 0.7 %, QUIET, top non-exempt 0 % | 0 | 0 | 81 / 1231 passed | 264.07 s | hook 66 042 / 66 069 | 4 | success, 1230 + 1 skipped, 46.16 s |
| 2 | 36229262414 | e815e3d | RH | 1 %, QUIET, `WmiPrvSE` 5 % | 0 | 0 | 81 / 1231 passed | 328.39 s | refwatch-stage 19 475 / 19 445 | 0 | success, 1230 + 1, 46.84 s |
| 3 | 36229612533 | e815e3d | RH | 1 %, QUIET, **`claude` pid 8980 5 %** | 0 | 0 | 81 / 1231 passed | 372.44 s | refwatch-stage 24 869 / 24 864 | 0 | success, 1230 + 1, 46.52 s |
| 4 | 36230004161 | e815e3d | spawn=8 | 1.3 %, QUIET, top non-exempt 0 % | 0 | 0 | 81 / 1231 passed | 493.72 s | policies 26 831 / 26 776 | 0 | success, 1230 + 1, 86.63 s |

### 6.3 B-8 records for this seat's runs (lines as logged)

**#1, the B-5.2 mutant: run 36228947505**, head `6c3b53b` (`qa/b-step1-mutant`), artifact `step0-36228947505-1`.
```
BASELINE cpu_load_pct=0.7 samples=2,0,0 free_ram_mb=3313 total_ram_mb=8048 at=2026-09-26T08:10:27.5629276Z
BASELINE_QUIET
TOP5 svchost#32 pid=3148 cpu_pct=0 ws_mb=7
TOP5 svchost#31 pid=2256 cpu_pct=0 ws_mb=6
TOP5 svchost#30 pid=2240 cpu_pct=0 ws_mb=14
TOP5 svchost#35 pid=3520 cpu_pct=0 ws_mb=8
TOP5 svchost#34 pid=3512 cpu_pct=0 ws_mb=8
> vitest run --testTimeout=30000
PARAMS cpu=0 disk=0 spawn=2 children=2 started=2026-09-26T08:10:33.444Z stopped=2026-09-26T08:15:01.275Z
SUITE_EXIT=0 capped=False deadBeforeStop=0 leakedByReport=0 aliveNow=0
ON_TASK_UPDATE_TIMEOUTS=0
Test Files  81 passed (81)
Tests  1231 passed (1231)
Duration  264.07s (transform 8.87s, setup 4.10s, collect 41.37s, tests 1213.65s, environment 71ms, prepare 35.95s)
ELD rows=81; top 10 by gapMaxMs:
ELD gap=66042 eldMax=66069 p99=66069 wall=66038 pid=16160 ended=2026-09-26T08:12:04.961Z hook.test.ts
ELD gap=38962 eldMax=38990 p99=38990 wall=38961 pid=8304 ended=2026-09-26T08:11:22.008Z state-import-r2.test.ts
ELD gap=36175 eldMax=36205 p99=36205 wall=36174 pid=17624 ended=2026-09-26T08:12:32.844Z staleness.test.ts
ELD gap=30642 eldMax=30669 p99=30669 wall=30641 pid=16324 ended=2026-09-26T08:11:22.028Z state-import-r4.test.ts
ELD gap=29879 eldMax=29897 p99=29897 wall=29878 pid=1448 ended=2026-09-26T08:11:55.095Z cli-bootstrap.test.ts
ELD gap=22778 eldMax=22817 p99=22817 wall=22774 pid=4668 ended=2026-09-26T08:13:32.078Z derived-artifacts.test.ts
ELD gap=15440 eldMax=15460 p99=15460 wall=15438 pid=7068 ended=2026-09-26T08:12:21.761Z state-import-staleness.test.ts
ELD gap=13311 eldMax=13279 p99=13279 wall=90087 pid=8432 ended=2026-09-26T08:13:03.180Z cli.test.ts
ELD gap=11656 eldMax=11635 p99=11601 wall=260620 pid=9300 ended=2026-09-26T08:11:00.332Z runtime.test.ts
ELD gap=11451 eldMax=11442 p99=11442 wall=42404 pid=9268 ended=2026-09-26T08:13:03.182Z refwatch.test.ts
```
Whole table from the artifact: 81 rows, 81 distinct files. Rows ≥ 30 000 in either column: `hook` 66 042/66 069,
`state-import-r2` 38 962/38 990, `sync/staleness` 36 175/36 205, `state-import-r4` 30 642/30 669. One row ≥ 60 000.
Loadgen: 2 spawn children, 0 dead, 0 never-beat, 0 alive, 0 leaked.

**#2, RH at the candidate: run 36229262414**, head `e815e3d` (`qa/b-step1-cand`), artifact `step0-36229262414-1`.
```
BASELINE cpu_load_pct=1 samples=1,2,0 free_ram_mb=1924 total_ram_mb=8048 at=2026-09-26T08:16:42.7933239Z
BASELINE_QUIET
TOP5 WmiPrvSE#2 pid=16456 cpu_pct=5 ws_mb=15
TOP5 svchost#32 pid=3148 cpu_pct=0 ws_mb=7
TOP5 svchost#31 pid=2256 cpu_pct=0 ws_mb=6
TOP5 svchost#35 pid=3520 cpu_pct=0 ws_mb=8
TOP5 svchost#34 pid=3512 cpu_pct=0 ws_mb=8
> vitest run --testTimeout=30000
PARAMS cpu=0 disk=0 spawn=4 children=4 started=2026-09-26T08:16:43.630Z stopped=2026-09-26T08:22:17.609Z
SUITE_EXIT=0 capped=False deadBeforeStop=0 leakedByReport=0 aliveNow=0
ON_TASK_UPDATE_TIMEOUTS=0
Test Files  81 passed (81)
Tests  1231 passed (1231)
Duration  328.39s (transform 10.08s, setup 5.07s, collect 51.47s, tests 1499.21s, environment 61ms, prepare 42.01s)
ELD rows=81; top 10 by gapMaxMs:
ELD gap=19475 eldMax=19445 p99=15091 wall=149384 pid=16496 ended=2026-09-26T08:18:01.653Z refwatch-stage.test.ts
ELD gap=19014 eldMax=18975 p99=18505 wall=323306 pid=17248 ended=2026-09-26T08:18:17.182Z runtime.test.ts
ELD gap=14761 eldMax=14722 p99=13464 wall=98721 pid=18308 ended=2026-09-26T08:17:48.684Z cli-flags.test.ts
ELD gap=14409 eldMax=14395 p99=14395 wall=42391 pid=7508 ended=2026-09-26T08:17:36.140Z policies.test.ts
ELD gap=14204 eldMax=14202 p99=14202 wall=99016 pid=16540 ended=2026-09-26T08:20:12.831Z cli.test.ts
ELD gap=13022 eldMax=13002 p99=13002 wall=79705 pid=11032 ended=2026-09-26T08:20:03.689Z gate-artifacts.test.ts
ELD gap=12949 eldMax=12893 p99=9446 wall=83222 pid=3884 ended=2026-09-26T08:18:14.898Z tree-currency.test.ts
ELD gap=12920 eldMax=12868 p99=12868 wall=45038 pid=12492 ended=2026-09-26T08:20:05.884Z refwatch.test.ts
ELD gap=10960 eldMax=10922 p99=10922 wall=54973 pid=16700 ended=2026-09-26T08:19:45.836Z detach.test.ts
ELD gap=10836 eldMax=10838 p99=10838 wall=10835 pid=10664 ended=2026-09-26T08:18:15.797Z checks.test.ts
```
Whole table: 81 rows, 81 distinct files, none ≥ 30 000, max `eldMaxMs` 19 445. Loadgen: 4 children, all zero.

**#3, RH at the candidate: run 36229612533**, head `e815e3d` (`qa/b-step1-cand`), artifact `step0-36229612533-1`.
```
BASELINE cpu_load_pct=1 samples=0,3,0 free_ram_mb=2024 total_ram_mb=8048 at=2026-09-26T08:23:49.8325929Z
BASELINE_QUIET
TOP5 claude pid=8980 cpu_pct=5 ws_mb=366
TOP5 svchost#31 pid=2256 cpu_pct=0 ws_mb=6
TOP5 svchost#30 pid=2240 cpu_pct=0 ws_mb=14
TOP5 svchost#29 pid=2168 cpu_pct=0 ws_mb=7
TOP5 svchost#34 pid=3512 cpu_pct=0 ws_mb=8
> vitest run --testTimeout=30000
PARAMS cpu=0 disk=0 spawn=4 children=4 started=2026-09-26T08:23:50.576Z stopped=2026-09-26T08:30:08.884Z
SUITE_EXIT=0 capped=False deadBeforeStop=0 leakedByReport=0 aliveNow=0
ON_TASK_UPDATE_TIMEOUTS=0
Test Files  81 passed (81)
Tests  1231 passed (1231)
Duration  372.44s (transform 10.59s, setup 5.27s, collect 59.14s, tests 1734.07s, environment 75ms, prepare 47.70s)
ELD rows=81; top 10 by gapMaxMs:
ELD gap=24869 eldMax=24864 p99=15947 wall=161763 pid=3104 ended=2026-09-26T08:25:10.963Z refwatch-stage.test.ts
ELD gap=23279 eldMax=23236 p99=23236 wall=111781 pid=2672 ended=2026-09-26T08:27:16.199Z gate-artifacts.test.ts
ELD gap=23172 eldMax=23119 p99=18337 wall=366827 pid=17248 ended=2026-09-26T08:25:07.383Z runtime.test.ts
ELD gap=20766 eldMax=20737 p99=20737 wall=54976 pid=4064 ended=2026-09-26T08:24:56.422Z policies.test.ts
ELD gap=20300 eldMax=20284 p99=20284 wall=61999 pid=10760 ended=2026-09-26T08:27:32.733Z refwatch.test.ts
ELD gap=16446 eldMax=16442 p99=15796 wall=122737 pid=17736 ended=2026-09-26T08:27:55.118Z cli.test.ts
ELD gap=16272 eldMax=16291 p99=16291 wall=16271 pid=9940 ended=2026-09-26T08:27:09.254Z greeting-size.test.ts
ELD gap=14254 eldMax=14202 p99=12113 wall=96802 pid=17232 ended=2026-09-26T08:25:05.314Z cli-flags.test.ts
ELD gap=11491 eldMax=11442 p99=11249 wall=76497 pid=9104 ended=2026-09-26T08:26:50.548Z detach.test.ts
ELD gap=10545 eldMax=10553 p99=10553 wall=10543 pid=17188 ended=2026-09-26T08:24:11.819Z state-writer.test.ts
```
Whole table: 81 rows, 81 distinct files, none ≥ 30 000, max `eldMaxMs` 24 864. Loadgen: 4 children, all zero.

**#4, the heavier row (informational, not a criterion row): run 36230004161**, head `e815e3d` (`qa/b-step1-cand`),
artifact `step0-36230004161-1`.
```
BASELINE cpu_load_pct=1.3 samples=1,2,1 free_ram_mb=2202 total_ram_mb=8048 at=2026-09-26T08:31:39.8246271Z
BASELINE_QUIET
TOP5 svchost#31 pid=2256 cpu_pct=0 ws_mb=6
TOP5 svchost#30 pid=2240 cpu_pct=0 ws_mb=14
TOP5 svchost#29 pid=2168 cpu_pct=0 ws_mb=7
TOP5 svchost#34 pid=3512 cpu_pct=0 ws_mb=8
TOP5 svchost#33 pid=3308 cpu_pct=0 ws_mb=8
> vitest run --testTimeout=30000
PARAMS cpu=0 disk=0 spawn=8 children=8 started=2026-09-26T08:31:45.367Z stopped=2026-09-26T08:40:07.168Z
SUITE_EXIT=0 capped=False deadBeforeStop=0 leakedByReport=0 aliveNow=0
ON_TASK_UPDATE_TIMEOUTS=0
Test Files  81 passed (81)
Tests  1231 passed (1231)
Duration  493.72s (transform 41.66s, setup 5.68s, collect 90.21s, tests 2092.79s, environment 58ms, prepare 48.77s)
ELD rows=81; top 10 by gapMaxMs:
ELD gap=26831 eldMax=26776 p99=26776 wall=73680 pid=4924 ended=2026-09-26T08:32:52.843Z policies.test.ts
ELD gap=26061 eldMax=26038 p99=24964 wall=485892 pid=3672 ended=2026-09-26T08:32:39.684Z runtime.test.ts
ELD gap=20286 eldMax=20233 p99=19260 wall=218782 pid=8152 ended=2026-09-26T08:32:55.818Z refwatch-stage.test.ts
ELD gap=20051 eldMax=20015 p99=18874 wall=144860 pid=8960 ended=2026-09-26T08:36:31.011Z cli.test.ts
ELD gap=19717 eldMax=19680 p99=19680 wall=112610 pid=9308 ended=2026-09-26T08:36:16.278Z gate-artifacts.test.ts
ELD gap=19546 eldMax=19545 p99=19545 wall=66680 pid=1760 ended=2026-09-26T08:36:07.214Z refwatch.test.ts
ELD gap=12252 eldMax=12239 p99=12239 wall=69308 pid=3748 ended=2026-09-26T08:35:52.120Z detach.test.ts
ELD gap=11653 eldMax=11652 p99=11652 wall=51148 pid=17852 ended=2026-09-26T08:34:34.431Z role-files.test.ts
ELD gap=11090 eldMax=11107 p99=11107 wall=11087 pid=11892 ended=2026-09-26T08:32:11.277Z state-writer.test.ts
ELD gap=10958 eldMax=10897 p99=10662 wall=94028 pid=9904 ended=2026-09-26T08:34:06.941Z tree-currency.test.ts
```
Whole table: 81 rows, 81 distinct files, none ≥ 30 000, max `eldMaxMs` 26 776. Loadgen: 8 children, all zero.

### 6.4 The developer's ten step0 runs, re-read

Every line of handoff §6's ten blocks matches what I extracted from the job logs. That covers `BASELINE`, `TOP5`,
`PARAMS`, `SUITE_EXIT`, `ON_TASK_UPDATE_TIMEOUTS`, the vitest summary, the command line and the top-ten ELD rows. Each
"Whole ELD table" sentence matches the artifacts' JSONL: row counts, distinct files, the rows ≥ 30 000, the number
≥ 60 000, and max `eldMaxMs`. Each B-1 red's log carries as many `[vitest-worker]: Timeout calling "onTaskUpdate"`
lines as its `Errors` count. The ordinary and tcm runs (36224825024, 36224921272 and 36224925217) match handoff §6's
second table.

---

## 7. `tests/spawn-async.ts`, read as the product it now is for seven files

**Does an awaited spawn keep each test's assertions and exit-code checks exactly? Yes, for every call site.**

| File | Before | After | Exit and output contract |
|---|---|---|---|
| `trigger/hook` | `spawnSync('npx', …, {input, encoding, env, shell: true})` | `await spawnAsync(…same, no encoding)` | Same `status`, `stdout` and `stderr` fields, and `status` is asserted in every row. The locked-store row still holds its `EXCLUSIVE` lock across the awaited child. |
| `sync/staleness`, `derived-artifacts` | `execSync(cmd, {cwd, stdio: [ignore, pipe, pipe]})` | `await execAsync(cmd, {cwd})` | Both throw on a non-zero exit, a signal or a failure to start, so G-029's "a broken git fails the test" holds. The shell is the same (`cmd.exe /d /s /c` or `/bin/sh -c`), so `&&` chains are unchanged. |
| `state-import-r4` | `spawnSync(node, …, {encoding})` | `await spawnAsync(…)` | Same shape. It never checked `error`, then or now. |
| `state-import-r2`, `state-import-staleness` | `execFileSync` in a try, returning `{status: 0, stdout, stderr: ""}` or the error's fields | `spawnAsync`, throws on `error`, returns the real `stderr` | **Changed, and stronger.** `stderr` on success is now the child's real stderr, not a constant. `PROBE-2`'s `expect(c.stderr).toBe("")` now asserts something. A child that cannot start still makes the row throw, as it did before. |
| `cli-bootstrap` | `execFileSync` (`run`), `spawnSync` (`runRaw`) | `spawnAsync` with an explicit throw on `error` or `status !== 0` | `run` throws exactly where `execFileSync` did (a signal gives `status` null, which is `!== 0`). `runRaw` keeps its shape. |

Test names are identical in all seven files (B-0.3). In each file, the `expect(` lines removed equal those added. Two
differences are not assertions:

- `execFileSync`'s default passed a successful child's stderr through to the test log. It is now captured silently.
- `spawnSync`'s `maxBuffer` (1 MiB) no longer applies. None of these children print anywhere near it.

**Per-test timeouts are unchanged in effect.** vitest 3.2.4 fails a synchronous test that overran its timeout after
the fact (`@vitest/runner/dist/chunk-hooks.js:1880`: "if test/hook took too long in microtask … we still need to fail
the test", vitest #2920). So `SPAWN_TIMEOUT`, `cli-bootstrap`'s 30 s and 20 s, and the state-import rows' 60 s failed
the old code at the same thresholds. What changes is the timing: the async test fails at the deadline, with its child
still running. See D-1 below.

**Orphaned children on timeout: yes.** Measured on this PC with `docs/loops/qa-scripts-b-step1/qa129-orphan.test.ts`,
two rows each awaiting a 15 s child under a 2 s test timeout:

- Both children were **still alive in the next test of the same file**, 1.5 s after the timeouts (`process.kill(pid, 0)`).
- After vitest exited, the **direct** child was gone (`tasklist`: no such PID), and it never wrote its 15 s marker.
- The **`shell: true`** child, which is `hook.test.ts`'s shape, **outlived vitest**. It wrote its 15 s marker after the
  run ended.
- `spawnAsync` has no timeout, `AbortSignal` or kill path, so nothing ends a child whose test was abandoned. Under
  `spawnSync` a test could not be abandoned mid-spawn, so this is new with the conversion.
- It needs a failure first (a timeout). It then turns one failure into possible later ones: an abandoned `hook` child
  still writes `logPath` and the store, which the next rows assert on and `afterAll` removes.

**The helper's own tests and mutants.** At `e815e3d`, `tests/spawn-async.test.ts` passes 5 of 5 here. The developer's
three mutants are red as claimed. I added seven (`docs/loops/qa-scripts-b-step1/helper-mutants.mjs`, which restores the
file after each):

| Mutant | Result |
|---|---|
| D1 (developer) stderr hardcoded `''` | red, 2 rows |
| D2 (developer) `spawnSync`-backed body | red: "returns to the event loop" |
| D3 (developer) `execAsync` never throws | red, its row |
| Q4 input ignored (`stdin.end('')`) | red |
| Q5 a start error never settles | red |
| Q6 status hardcoded 0 | red, 3 rows |
| **Q1 `signal` always null** | **survives** |
| **Q2 settle on `'exit'` instead of `'close'`** (can lose stdout that arrives after exit) | **survives** |
| **Q3 `execAsync` lets a signal-killed child pass** (`(status ?? 0) !== 0`) | **survives** |
| **Q7 `error` dropped for a child that started** | **survives** |

The candidate's code is right on all four survivors as written. What is missing is a test that would stop a later edit
from making it wrong. Q2 and Q3 matter most: Q2 would turn into truncated-output flakes under load, and Q3 would
quietly break G-029 for a git killed by a signal. This is D-2.

---

## 8. Defects

- **D-1 (low; the helper; not a criterion).** `spawnAsync` never kills its child. When a test times out while awaiting
  it, the child runs on into the file's later tests. On Windows, a `shell: true` grandchild (`hook.test.ts`'s `npx`
  shape) outlives the vitest process itself (§7, measured). It is new with the conversion, and it needs a prior
  timeout. **Suggested:** kill the process tree when the test ends unfinished (`onTestFinished`, or an `AbortSignal`
  from the caller, with `taskkill /T` on win32, the same as the load generator's own cleanup).
- **D-2 (low; the helper's tests).** Four mutants survive `spawn-async.test.ts`: `signal` dropped, settle on `'exit'`,
  a signal-killed child passing `execAsync`, and `error` dropped on a started child (§7). Each needs a short row: a
  child that kills itself with a signal, and a child that writes after a delay and then exits.

No defect was found in the seven conversions.

## 9. Observations (not scored)

- **O-1: the harness files' stretch is higher at the candidate than at the base.** `runtime.test.ts` at R1:
  - base 12.6, 14.0 and 16.0 s (median 14.0);
  - candidate 21.8, 16.6 and 17.3 s (median 17.3, **1.24 ×**);
  - the mutant 11.7 s.

  `policies`, `refwatch-stage` and `cli` move the same way (§6.1). A plausible cause is that the seven files'
  workers now spend less time blocked and more time running, so the harness files' single long tests meet more
  contention. **Not verified**, and n = 3 against 3. It matters because this is where B-4's margin lives. Across the 6
  candidate runs at RH or above, the worst is 26.8 s (a margin of 1.12 ×). The `spawn=8` run's worst is also 26.8 s,
  so doubling RH's load did not move the worst row past RH's worst.
- **O-2: a green run with a file over 60 s.** The mutant ran `hook.test.ts` for 66.0 s and exited 0 with no
  `onTaskUpdate` error. In B-1's RH red (36223575964), `state-import-r2` at 64.9 s did produce an error. So there is
  no clean stretch threshold, which is what design §1's mechanism predicts: the timer is armed at the worker's call,
  not at the start of the stretch. B-5.2 scores the stretch, so this does not affect it. QA 123's Q3.4 count ("errors
  = files ≥ 60 s") holds across the reds only. This is its second green counter-case, after 36222301375 (61.6 s).
- **O-3: the Linux-only skip QA 123 could not identify** is in `tests/shared/paths.test.ts`: `(14 tests | 1 skipped)`
  in every tcm log read here.
- **O-4: tcm's duration** is bimodal today at the same SHA: 46.2–46.8 s in three of my jobs, and 85.8–87.7 s in the
  developer's and in my fourth. That supports the developer's "tcm's own load" reading of their 85.8 s.

## 10. What could not be verified

- **The developer's EPERM**, in 160 runs here (§5). Its cause is a reading, not a measurement.
- **Whose `claude` process** PID 8980 on the laptop is, and whether it was active during the suites rather than only
  at the baselines (§4).
- **Orphan behaviour on Linux.** My probe ran on Windows only. On Linux, an abandoned child is reparented and not
  killed when vitest exits. That is from Node's documented behaviour, not from a run here.
- **The developer's desktop measurements** (handoff §4's before/after table, and the 1-in-15 EPERM) and their
  transcript's effort field. These are on another machine.
- **O-1's cause.**

## 11. Disagreements with the handoff

None on a number. Every figure I checked matches the logs and artifacts, and the 117 hunk headers match git's. One
point of wording: handoff §6 says "the other baselines show only idle `svchost`, `WmiPrvSE` at 5 % and `WUDFHost` at
5 %". That is right for what the baselines show, but the `claude` process was very likely resident throughout (§4),
not a one-off at RH #3.

## 12. Error entries (mine)

- **E-1 (none of consequence).** My first `gh` calls ran from a scratch directory outside any git checkout and failed
  ("not a git repository"). I re-ran them with `GH_REPO` set. No data came from the failed calls.
- **E-2 (none of consequence).** My first log extraction stripped real ESC bytes, but `gh run view --log` writes the
  colour codes as the literal text `^[[…m`. The vitest summary lines therefore did not match, and the first read
  showed no `Test Files`/`Tests`/`Duration`. I fixed the pattern and re-ran every extraction. Every number above comes
  from the second read.
- **E-3 (a count, by choice).** I made 4 laptop dispatches, not the 5 allowed, because of tcm's cap of 4 (§1).

## 13. Reproduction

Scripts are in `docs/loops/qa-scripts-b-step1/`. Worktrees are under `C:\qa-scratch\qa129\`: `cand` at `e815e3d` with
`npm ci`, `mut` on `qa/b-step1-mutant`, `report`, and `ev` for the logs and artifacts.

- **Mutant:**
  ```
  git worktree add -b qa/b-step1-mutant <dir> e815e3d
  git revert --no-commit c6e8061 674d42e 54961a2 d696985 97a34b7 724b9b0 e815e3d
  git diff --cached a984b15   # on the 7 files: empty
  ```
  Then commit, push with `push-qa.mjs`, and dispatch with
  `gh workflow run ci.yml --ref qa/b-step1-mutant -f windows=true -f step0=true -f cpu=0 -f disk=0 -f spawn=2`.
- **Records:** `gh run view <id> --log > log-<id>.txt`, `gh run download <id> -D art-<id>`, then
  `node b8.mjs <id> …`, which prints the anchored B-8 lines and the whole-table ELD figures. `node seven.mjs <id> …`
  prints §6.1's per-file table.
- **Helper mutants:** from `open-brain/` at `e815e3d`, `node helper-mutants.mjs`.
- **Orphans:** copy `qa129-orphan.test.ts` into `open-brain/tests/`, set `QA129_ORPHAN_DIR`, run
  `npx vitest run tests/qa129-orphan.test.ts`, and check the PIDs and `.done` markers afterwards.
- **EPERM:**
  - Put `ee0566d`'s `state-import-staleness.test.ts` into the candidate tree as
    `tests/pipelines/qa129-staleness-orig.test.ts`.
  - Run `eperm-loop.sh 25 <out>`, which uses `QA_DEFAULT_TEMP` for the Defender-scanned TEMP.
  - Run `eperm-loop-load.sh 30 <out>`, which runs the load generator at `--spawn 4` with ELD on.

## 14. Open for the planner

1. **The dispatch's caps interact.** Every laptop dispatch also runs tcm's `test` job, so "laptop ≤ 5, tcm ≤ 4" allows
   4 of each, not 5 laptop runs. I read the tcm cap as binding and made 4. **Recommendation:** state the laptop cap net
   of the tcm job, or say the tcm cap counts only tcm-only dispatches. Not blocking.
2. **D-1 and D-2 (the helper).** Both are small and outside the criteria. **Recommendation:** fold them into B's next
   step (the `E_t` work), or into a short follow-up, rather than holding Step 1. The seven conversions do not depend
   on them.
3. **A `claude` process lives on the laptop** (PID 8980, about 365 MB, seen at 07:27 and 08:23). It passes §1's rule
   at 5 %. But the laptop is meant to be B's alone during scoring, and an active session there can add load mid-suite
   that no baseline sees. **Recommendation:** ask Aaron whose it is, and close it before B's `E_t` runs. Not blocking
   here (§4).
4. **The remaining exposure is design Step 1(a).** Every worst row at the candidate is a harness file's single test,
   the margin is 1.12 ×, and O-1 suggests the fix raised those stretches by about a fifth. **Recommendation:** no
   change to Step 1's acceptance. If B-4's margin is to be widened later, the lever is yields in `runLoop` (design
   Step 1(a)), not more test files.
5. **B is not accepted as a whole.** `E_t` (R10) still needs its criteria and a pass (rulings §3). Nothing in this
   report waits on it.

QA-129: REPORT COMPLETE
