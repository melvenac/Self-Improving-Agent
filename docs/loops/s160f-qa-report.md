# QA 272 report (s160f): #415 (T-239 follow-up), #420 (T-200 port), #421 (G-053), plus the #418 retro-check

**By:** QA 272 (headless Claude Code, Opus 5.5), record session 160, 2026-10-04 UTC. **Dispatch:**
`docs/loops/qa-272-s160f-dispatch.md`. **Dispatch tree:** `~/qa-scratch/qa272-wt` at
`71b2b924b1020a454e2eaa7035366c841de0f8f5` (`git -C ~/qa-scratch/qa272-wt log -1 --format=%H`). This equals
`origin/master` at fetch time, and it contains #418 (`4ada3bb3`).

**Candidates.** All three are still the PR heads according to `gh pr view`:

| PR | Head (pinned = actual) | Tree | Merge-base / base tree |
|---|---|---|---|
| #415 | `dc092840af38f86dfe18af060564fe181988f159` | `~/qa-scratch/qa272-pr415` | `8f14ca91` / `qa272-base415` |
| #420 | `0d2bc66e94ebed4ca7008395eede8426f43e055c` | `~/qa-scratch/qa272-pr420` | `651ac36b` / `qa272-base420` |
| #421 | `82aeb3da3e9036d5f6812738be541cb67ada1e07` | `~/qa-scratch/qa272-pr421` | `651ac36b` / `qa272-base421` |

Merge row tree: `~/qa-scratch/qa272-merge`.

**Job class LIGHT.** One test file per vitest invocation, mutants on touched files only, `tsc --noEmit`, `typecheck:tests`, and
`gh` reads. No full suite was run.
- **No live Jev call** was made, and **no live `.agents/state.json`** was written. Every record write went to a scratch fixture under `~/qa-tmp`.
- No issue or PR was created, commented on or edited.
- The only branch pushed is `qa/s160f-report`, through `push-qa.mjs`.
- No base tree was left modified (`git status` is clean in each).

**Deviations, stated:**
- **npm cache.** Every `npm ci` (7 trees) used `npm_config_cache=~/qa-tmp/npm-cache`.
- **TMPDIR.** The harness refuses shell loops, `$` expansion and env-prefixed commands. My node runners in `~/qa-tmp` therefore set
  `TMPDIR=~/qa-tmp` and `npm_config_cache` for each child they spawn: `q272-run.mjs`, `q272-mutate.mjs`, `q272-ci.mjs`, and the scratch scripts.
  All vitest runs went through those runners.
- **Scratch tests.** Three throwaway test files were written into PR trees and deleted after their run. They read and write fixtures under `~/qa-tmp` only:
  - `tests/qa272-row5.test.ts` in pr415;
  - `tests/qa272-row7.test.ts` in pr420;
  - `tests/qa272-row10.test.ts` in pr421.

## Verdicts

- **#415 / T-239 follow-up (`dc092840af38f86dfe18af060564fe181988f159`): ACCEPT.** No gaps. One out-of-scope note (row 5).
- **#420 / T-200 port (`0d2bc66e94ebed4ca7008395eede8426f43e055c`): ACCEPT.** There are three non-blocking gaps:
  - the source line sits outside the verbatim Briefing block;
  - two QA mutants survive: the Sizes block, and the branch where no local record is readable.
- **#421 / G-053 (`82aeb3da3e9036d5f6812738be541cb67ada1e07`): REJECT.** It fails row 10, a condition the dispatch states outright:
  - `gc.auto=" 0"` is **admitted**, and so are `"\t0"`, `"0 "` and `"0\n"`. The checker `.trim()`s the value before testing the
    anchored `/^0$/`.
  - Nothing pins `00`, `0x` or the other `gc.*` keys as refused. Two QA mutants survive: `/^0/`, and widening the key to `gc.*`.
  - No admitted value runs a program (row 10 gives the argument). The fix is one expression plus rows.
- **#418 retro-check (merged `4ada3bb3`): PASS.** Every listed condition holds, and all four test files are green. One cosmetic
  fix-forward note is under row 12.
- **Batch: REJECT**, because #421 is rejected. #415 and #420 stand on their own verdicts, and they merge cleanly without #421 (row 13
  merged #421 between them with no conflict). Merge authority was not pre-approved, so any merge waits for Aaron.

## Rows for every PR

### 1. Confined: MET (all three)

`git diff --stat <merge-base> <head>`:

**#415, 3 files**, all within the task (one commit, `dc092840`):

```
 CHANGELOG.md                                       |  4 +
 .../src/pipelines/session-start/state-render.ts    |  6 +-     (checkMissingHandoff -> checkoutOf; node:path import dropped)
 .../session-start/handoff-by-checkout.test.ts      | 91 ++++-   (R8 handleStart wiring, R9 one derivation)
```

The dispatch says #415 touches `server.ts`. **It does not.** Its server-path coverage is R8, a test that calls `handleStart`.

**#420, 10 files**, all T-200 (six commits, `b92df3c8`..`0d2bc66e`):

```
 docs/loops/t200-developer-handoff.md               |  78 ++++++    (ported verbatim; still says "Local only ... no CI", historical)
 open-brain/src/pipelines/session-start/git-read.ts |  47 ++++     (new)
 .../src/pipelines/session-start/record-source.ts   | 108 ++++++++  (new)
 .../src/pipelines/session-start/role-files.ts      |  65 ++++-
 .../src/pipelines/session-start/tree-currency.ts   |   9 +-
 open-brain/src/pipelines/sync/checks.ts            |  29 ++-
 open-brain/src/server.ts                           |  46 +++-
 open-brain/tests/helpers/role-source.ts            |  25 ++
 .../pipelines/session-start/record-source.test.ts  | 280 +++++++++
 .../tests/pipelines/sync/greeting-size.test.ts     |  86 ++++++-
```

**#421, 3 files**, all G-053 (one commit, `82aeb3da`):

```
 open-brain/src/harness/configwatch.ts           |  1 +     (SAFE_LOCAL_KEYS: gc.auto = /^0$/)
 open-brain/tests/harness/config-channel.test.ts | 39 ++++-  (4 G-053 rows; disableAutoGc on the R21 init/clone/worktree row)
 open-brain/tests/harness/fixture.ts             |  6 ++     (disableAutoGc; makeRepo calls it)
```

**Nit (#421):** `disableAutoGc` was inserted between `makeRepo`'s JSDoc block and `makeRepo`. That JSDoc now precedes
`disableAutoGc`'s own one-line doc, and `makeRepo` has none.

### 2. Red then green

- **#415: green at base by design; the red comes from mutants.** The head's `handoff-by-checkout.test.ts`, copied into `qa272-base415`,
  scores **17 passed (17)**. That is expected: the PR pins wiring that master already has (R8), and it swaps an inline derivation
  for an identical one (R9). At the head: **17 passed (17)**, and missing-handoff **29 passed (29)**. The red is the mutants in rows 3 and 5,
  which fail on master's wiring when it is removed. The base tree was restored.
- **#420: MET.** The head's `record-source.test.ts` copied into base **fails to collect** (no `git-read.js`). I do not count that as red.
  - **Collectable red:** I then copied only the leaf helper `git-read.ts` into base. That lets the file load against master's `server.ts`
    and `checks.ts`. Result: **11 failed | 2 passed (13)**. The 2 passes are RM-4's level-tree half and the pure `gitShow` buffer row.
    Both describe behaviour that does not change.
  - **greeting-size:** its helper imports `record-source.js`, so it cannot load at base and is not counted.
  - **Head:** record-source **13 passed (13)** and greeting-size **14 passed (14)**. The base tree was restored and is clean.
- **#421: MET.** The head's `config-channel.test.ts` plus `fixture.ts`, at base, gives **32 failed | 6 passed (38)**. Base refuses `gc.auto=0` at
  preflight (`unsafe-config-at-base`), so every loop row fails. Row 9 isolates the cause. At the head: **38 passed (38)**. The base tree was restored.

### 3. Mutants (each: unique find, `landed=true`, `tsc --noEmit` 0, test files one per run, source restored and byte-checked, `git status` clean)

**#415** (`q272-m415.json`):

| Mutant | Result |
|---|---|
| DEV Q1: `server.ts` drops `ownCheckout` from `renderBriefing` | **killed**, handoff-by-checkout 2 failed (R8 ×2) |
| DEV Q2: `server.ts` drops `ownCheckout` from `renderState` | **killed**, 2 failed (R8 ×2) |
| DEV D1: `checkMissingHandoff` derives by separator split | **killed**, 1 failed (R9); missing-handoff 29/29 |
| QA A: `ownCheckout = handoffCheckout(process.cwd())` | **killed**, 2 failed (R8 ×2); server.test 35/35 |
| QA B: `checkMissingHandoff` case-folds only the reader side | **killed**, but by missing-handoff (2 failed, T-199 end-to-end), not by R9 (17/17) |
| QA C: `checkMissingHandoff` without `resolve` (raw basename) | **killed**, 1 failed (R9) |

**#420** (`q272-m420.json`, `q272-m420b.json`), against record-source:

| Mutant | Result |
|---|---|
| DEV M1 (PR body): `revHere >= revMaster - 100000` | **killed**, 5 failed |
| DEV M4 (handoff): `server.ts` role files stay local | **killed**, 1 failed (RM-4) |
| QA 1: `server.ts` does not rebind `sj` | **killed**, 3 failed |
| QA 2: level tree read as behind (`>` for `>=`) | **killed**, 1 failed (RM-2a) |
| QA 3: `gitShow` without `maxBuffer` | **killed**, 1 failed (large file) |
| QA 4: `composeGreeting` drops the source line | **killed**, record-source 1 failed; greeting-size 14/14 |
| QA 5b: Sizes block keeps the local state.json line (`sizesFor` fed `kind: "local"`) | **SURVIVES**: record-source 13/13, server 35/35 |
| QA 6: no readable local record → LOCAL instead of master | **SURVIVES**: 13/13 |

A first QA 5 (comma operator) failed tsc with TS2695, so it was not counted and was rewritten as 5b.

**#421** (`q272-m421.json`), against config-channel:

| Mutant | Result |
|---|---|
| DEV (the PR's own row): the `gc.auto` rule removed | **killed**, 32 failed |
| QA a: value constraint dropped (any `gc.auto` admitted) | **killed**, 1 failed (the "gc.auto=1 refused" row) |
| QA b: value regex start-anchored only (`/^0/`) | **SURVIVES**: 38/38 |
| QA c: key widened to `/^gc\..*$/` | **SURVIVES**: 38/38 |

### 4. CI (read only): MET (all three)

`gh pr checks` and `gh run view`. Each `test` is **pass**, and each run's `headSha` equals the pinned head:

| PR | Run | `test` result |
|---|---|---|
| #415 | `37173052418` | pass, 3m10s |
| #420 | `37179283886` | pass, 2m47s |
| #421 | `37179333080` | pass, 2m9s |

`test-windows` was skipped on all three.

## #415

### 5. The two named mutants die; one derivation: MET

- **The named mutants.** Q1 (renderBriefing) and Q2 (renderState) are both killed by R8, in both `briefing_budget` layouts (row 3).
- **One derivation.** The scratch row (`qa272-row5.test.ts`) ran the real writer (`applyStateOps`, `set_objective`, no handoff)
  **from each spelling** of a scratch `…/sia-infra` root. For each spelling it compared the stamped `sessions[].checkout`, `checkoutOf(spelling)` and
  `checkMissingHandoff(...).kind`.

  | Spelling | Stamped | Reader | checkMissingHandoff |
  |---|---|---|---|
  | `/sia-infra` | `sia-infra` | `sia-infra` | `missing` |
  | `/sia-infra/` | `sia-infra` | `sia-infra` | `missing` |
  | `/sia-infra//` | `sia-infra` | `sia-infra` | `missing` |
  | `/sia-infra/.` | `sia-infra` | `sia-infra` | `missing` |
  | `/sia-infra/sub/..` | `sia-infra` | `sia-infra` | `missing` |

- **Windows-style path.** Writer (`state-writer.ts:268`) and reader now both call `checkoutOf`, so they agree by construction on any
  platform. On this POSIX host, `checkoutOf("C:\\Users\\aaron\\Worktrees\\sia-infra")` returns the whole string, because backslash
  is not a separator here. `path.win32` gives `sia-infra`, and also gives it for the trailing-`\` and `\sub\..` forms. Both sides always
  get the same answer.
- **Out of scope, noted:** `seat-map.ts:36` still derives the checkout inline as `basename(resolve(projectRoot))`. It agrees today. It is
  the last inline copy, and so the remaining drift risk.

## #420 (T-200)

### 6. Port fidelity: MET

**What the range covers.** `92f9cc0f..424065c` excludes `92f9cc0f` itself, and that commit is the product. I therefore compared the full original
`abae5f92..424065c` (5 commits) with the port `651ac36b..0d2bc66e` (6 commits). I used `git range-diff` and a per-file comparison of
added and removed lines (`~/qa-tmp/q272-portdiff.mjs`). Commits 2, 3 and 5 (docs) are `=` identical. The full adaptation list:

1. **`tree-currency.ts`:** the original's `function readLastFetchAt` → `export function` hunk is absent. Master already exports it
   (`tree-currency.ts:415` at base). The other 9 changed lines are identical.
2. **`checks.ts`:** one blank line sits in a different place. The code lines are identical.
3. **`server.ts`:** **all 46 changed lines are identical** to the original. Only the context differs: the imports from T-203/T-236
   (`renderBriefing`, `renderRoleDocs`, hub presence, …) and the `sj` rebinding, which now sits ahead of master's `renderBriefing` call.
   That is the developer's "rebinding `sj` before renderBriefing". Every downstream reader in `handleStart` uses `sj` (lines 390–462 at the head):
   - `renderState`, `renderBriefing`, `focusLine` and `seatsLine`;
   - `missingHandoffLine`;
   - the invalid and schema-version fallbacks.

   None reads `result.state.stateJson` directly.
4. **`record-source.test.ts`:** +13 lines, which make up the new **RM-1b** budget row (commit `0d2bc66e`, plus the `BRIEFING_START` import).
5. **`greeting-size.test.ts`:** import context only (master's `hub-presence` import). The changed lines are identical.

`git-read.ts`, `record-source.ts`, `role-files.ts` and `role-source.ts` are byte-identical in their changes.

### 7. The behaviour: MET, with one non-blocking gap

**Fixture.** A scratch row (`qa272-row7.test.ts`, 9/9) used real git: a bare origin, a seed and a clone. A **git wrapper on `PATH`** logged every git
subcommand that `handleStart` spawned.

| Case | Layout | Source line (verbatim shape) | Rendered |
|---|---|---|---|
| behind (local 140, master 163) | budgeted | `record read from origin/master <sha7> rev 163; this tree holds rev 140; last fetch 2026-10-04T05:37:57.753Z` | master objective, pick-up **inside the Briefing block**, role files; no LOCAL text |
| behind | legacy | same shape | same (the legacy layout renders an unbudgeted Briefing block, 41 lines) |
| current (163/163) | both | `record source: LOCAL (rev 163, at or ahead of origin/master rev 163)` | own record |
| ahead (170/163) | both | `record source: LOCAL (rev 170, at or ahead of origin/master rev 163)` | own record |
| master is invalid JSON | both | `record source: LOCAL (origin/master unreadable: .agents/state.json at origin/master is not a record this build can read — $: not valid JSON — …). Rendering this tree's own record, which may be older than master's.` | own record; no MASTER text |
| master `revision` is a string | both | `record source: LOCAL (origin/master unreadable: … revision: Invalid input: expected number …` | own record |
| no `origin/master` ref | budgeted | `record source: LOCAL (origin/master unreadable: origin/master does not exist in this checkout (no remote, or nothing fetched)). …` | own record |

The developer's RM-3 rows also cover: no remote, no state.json at the ref, a truncated file, an unknown `schema_version`, and the over-buffer refusal.
Unreadable master content therefore **fails closed** (master's text is never rendered) **and visibly**: the cause sits in the line. Per the
ruling it never refuses to brief.

**No network: MET.** The git wrapper logged 17 git calls per behind-start. The only subcommands were `rev-parse`, `rev-list`,
`show`, `log` and `status`, with **zero** `fetch`, `pull`, `ls-remote`, `push` or `clone`. Two cases backed this up:
- **Origin moved again after the clone's fetch** (to rev 170, "NEWER"). The brief still showed the fetched rev 163, and
  `refs/remotes/origin/master` was unchanged.
- **The origin directory was removed.** The brief still read the fetched ref (rev 180) and spawned no network subcommand.

The only `git fetch` in the code is `fetchOrigin` (`tree-currency.ts:119`), and only `cli-bootstrap.ts` (the session hook, T-208) calls it.
`handleStart` never does.

**Gap (non-blocking): the source line is outside the verbatim Briefing block.** In both layouts the line is line 5 of the `ob_start`
output (the tree-currency area), while the Briefing block starts at line 80.
- `/start` step 6 prints only `## Briefing` … `## End Briefing` verbatim. So the human-visible brief shows `state rev 163` with **no
  mention** that the rev came from `origin/master`, or that this tree holds rev 140.
- The seat reading the tool output is told. The stale-objective harm T-200 targets is fixed, because the content itself is master's.
- The original candidate predates the T-233 Briefing block. Carrying the line (or a short `record: origin/master` marker) into the
  Briefing header would close this gap. Note that the all-flags budget is at 30/30 lines (QA 270), so that has to be paid for.

**Also unpinned (row 3):** the Sizes block's master-sourced state.json line (QA 5b), and the "no readable local record → master" branch
(QA 6). Both behave as the code says, but no test fails if either is removed.

### 8. A2A golden: MET

`a2a-byte-identical.test.ts`: **3 passed (3)** at the #420 head, and 3/3 at the merge.

## #421 (G-053)

### 9. The cause, reproduced: MET as written, with one observation

**At base**, I used base's own fixture, which leaves gc at its default, plus a no-op `disableAutoGc` export so the head's test file loads.
I ran `-t "G-053|R21"`:
- **"git update-server-info writes `<common>/info/refs`"** passes at base;
- **"info/refs created during the developer stage fails the R21 gpgsign loop (known positive)"** passes at base: the loop fails
  with `info/refs created`;
- "fixtures disable gc.auto" fails at base (`git config gc.auto` is unset), as expected.

This matches master's CI failure, which I read at run `37172590273` attempt 1: R21 `filter.x.clean`, `developer was refused … <common>/info/refs created (absent →
… size 190 …)`.

**The writer, confirmed outside the suite** (`~/qa-tmp/q272-gc.mjs`, git 2.53.0). A **forced** `git gc` creates `.git/info/refs`
(repack → update-server-info).

**Observation (not blocking #421 by itself).** I could not reproduce the **trigger**:
- `gc --auto` with `gc.auto=1` and 360 loose objects did not run.
- 60 commits at the default config never produced info/refs. Each commit spawns `git maintenance run --auto --quiet --detach`
  (GIT_TRACE), and that never repacked in a small repo.

The CI flake hit a small fixture repo at the default threshold of 6700. The PR closes the `gc --auto` path, which is plausible, but the actual CI
writer is not proven. If the writer was something else, such as the detached maintenance child, the flake can recur. Row 11 shows
nothing locally either way.

### 10. SECURITY BOUNDARY: NOT MET (stated condition fails); no program-execution path

The scratch matrix (`qa272-row10.test.ts`) called the real `unsafeLocalKeys` on a fresh `git init` repo for each value. It also recorded what git itself
parses (`git config --int gc.auto`) and whether `git gc --auto` runs:

| Config | Checker | git's reading |
|---|---|---|
| `gc.auto=0` | admitted | 0 |
| `gc.auto=1` | refused | 1 |
| `gc.auto=00` | refused | 0 |
| **`gc.auto=" 0"`** | **ADMITTED** | 0 |
| `gc.auto=0x` | refused | fatal: bad numeric config value |
| **`gc.auto="0 "`** | **ADMITTED** | **fatal: bad numeric config value '0 '** (gc --auto dies too) |
| **`gc.auto="0\n"`** | **ADMITTED** | **fatal** |
| **`gc.auto="\t0"`** | **ADMITTED** | 0 |
| `gc.auto=+0`, `-0`, `0k`, `""`, bare `auto` (boolean form) | refused | 0 / 0 / 0 / fatal / fatal |
| `gc.autoDetach`, `gc.autoPackLimit`, `gc.foo.auto`, `gc.writeServerInfo`, `maintenance.auto` | refused | (n/a) |
| `GC.AUTO=0` | admitted (git keys are case-insensitive; same key) | 0 |

The four dispatch conditions:
- **The value regex is anchored, but its input is trimmed.** `configwatch.ts:1468` tests `rule.value.test(value.trim())`. The trim is
  older code, but `gc.auto` is the first rule that has a `value`, so this PR is what activates it. The result is that `" 0"` is
  admitted, and the dispatch requires it refused. Two of the admitted spellings, `"0 "` and `"0\n"`, are values **git itself rejects as fatal**. So the
  allowlist admits configs that break every gc-reading git call in the loop. That is not the strict side.
- **No other gc key is admitted: MET today, unpinned.** QA c (key widened to `gc.*`) survives the suite.
- **`info/` is still watched: MET.** `watchedLocations` (`configwatch.ts:90`) keeps `join(commonDir, "info")` (plus the worktree's
  `info` when linked). The observed watched set includes `<repo>/.git/info`, and the known-positive row still fails the loop on `info/refs`.
- **Nothing else in the allowlist changed: MET.** The diff to `configwatch.ts` is exactly one added line.

**Can disabling gc make git run a program? No.**
- `gc.auto=0` makes `git gc --auto` (and the gc task of `maintenance run --auto`) return before doing anything.
- It removes a path on which git *would* run a program: the `pre-auto-gc` hook only fires when auto gc proceeds.
- The value is an integer, not a command, path or program name.
- The whitespace variants run nothing either. `" 0"` and `"\t0"` parse as 0, and `"0 "` and `"0\n"` make git exit fatally. The failure mode is a broken loop, not execution.

So I find **no execution risk**. The REJECT rests on the dispatch's explicit `" 0"` condition and on the strict-side rule.

**Fix forward (small):**
- test the raw value: `rule.value.test(value)`, with no trim;
- add rows that refuse `00`, `" 0"`, `"0 "`, `0x` and `gc.autoDetach`. Those kill QA b and QA c.

### 11. No flake: MET

`config-channel.test.ts` at the head, five consecutive runs, one per invocation:

| Run | Result | Time |
|---|---|---|
| 1 | 38 passed (38) | 47.3 s |
| 2 | 38 passed (38) | 55.2 s |
| 3 | 38 passed (38) | 54.9 s |
| 4 | 38 passed (38) | 52.0 s |
| 5 | 38 passed (38) | 52.2 s |

A sixth run, at the merge, was also 38/38. `tsc --noEmit` 0 and `typecheck:tests` 0 at the head.

## #418 retro-check (already merged)

### 12. PASS

The script is `~/qa-tmp/q272-seats.mjs`, run on master's `.agents/SYSTEM/hub-partner-seats.json` at `71b2b924`. Room ids are names, not secrets.

- **Seats:**
  - infra = `cursor-infra` / `k57d92gqtjm9wpfs74ekbx9rns8fmy2f`;
  - builder = `cursor-builder` / `k575sfwr9wcx3r8fw83g3bc00x8fmar3`;
  - forge = `forge` / `k571z4ghp7nbp34djhecwnsk3n8fmhsf`.

  The three rooms are distinct.
- **Readers, both directions:**
  - `readers.atlas.partners` has exactly one entry per cursor seat, with `hub_as` = the seat's `hub_name` and `session_id` = its room;
  - `readers.<hub_name>.partners` has exactly one entry, `hub_as: atlas`, with the same room;
  - there are four readers (atlas, forge, cursor-infra, cursor-builder).
- **Old values gone:** `grok` appears 0 times. The three room ids removed by #418 (`k5702788…mav`, `k57098ep…kdq`, `k57frxw0…006`,
  taken from the #418 diff) appear 0 times in the file.

Test files, one per run, at master (`qa272-merge` before any merge):

| File | Result |
|---|---|
| `seat-map` | 21 passed (21) |
| `hub-presence` | 40 passed (40) |
| `hub-seats` | 5 passed (5) |
| `focus` | 10 passed (10) |

**Fix-forward item (cosmetic, no defect):** `tests/pipelines/sync/hub-seats.test.ts` lines 10 and 71 still use the retired room id
`k5702788wctxj75begyt4x2k5x8f6mav` as **synthetic** fixture data. The test is self-contained and passes, but a reader may take it for
a live room. The frozen A2A fixture (`a2a-state-1c200b41.json`) and old docs also carry the old ids, which is expected for a golden and for history.

## Batch merge row

### 13. MET (mechanically): no conflicts

In `~/qa-scratch/qa272-merge`, starting from `71b2b924`, I merged with `--no-ff --no-edit`:

| Step | Merged | Merge commit |
|---|---|---|
| 1 | #415 | `681129e7` |
| 2 | #421 | `31fc5a12` |
| 3 | #420 | `7dd34fe2477894674cbd527a4f1b134793cc9b43` |

Nothing was pushed. **No conflict** at any step, because the hunks are disjoint:
- #415 touches `state-render.ts` and a test;
- #420 touches `server.ts`, `checks.ts` and session-start modules;
- #421 touches harness files only.

Results:
- `tsc --noEmit` 0 and `npm run typecheck:tests` 0.
- Test files, one per run:

  | File | Result |
  |---|---|
  | handoff-by-checkout | 17/17 |
  | missing-handoff | 29/29 |
  | record-source | 13/13 |
  | briefing-budget | 33/33 |
  | greeting-size | 14/14 |
  | server | 35/35 |
  | config-channel | 38/38 |
  | a2a-byte-identical | 3/3 |

- `npm run build` ("build stamped 7dd34fe"), then `node --check build/server.js` OK. The working tree was clean afterwards.
- **Duplicate-import scan** (`~/qa-tmp/q272-dupimports.mjs`, `src/` and `tests/`): 9 at the merge against 8 on master. The one new hit is
  `handoff-by-checkout.test.ts`, which imports `state-render.js` twice (from #415: `renderState` and `checkMissingHandoff` in separate statements). It is a
  test file, and no binding is imported twice. `src/` gains nothing; its two hits, `cli-session-end.ts` and `harness/runtime.ts`, are already on master.

Given the #421 REJECT, the batch to approve is **#415 + #420 only**. They do not depend on #421.

## Gaps and fix-forward items

1. **#421 (blocking):** the value is trimmed before `/^0$/`, so `" 0"`, `"\t0"`, `"0 "` and `"0\n"` are admitted. Fix: no trim. Add refusal rows for
   `00`, `" 0"`, `"0 "`, `0x` and `gc.autoDetach` (they kill QA b and QA c).
2. **#421 (observation):** the real CI trigger for `info/refs` is unproven locally. Commits spawn a *detached*
   `maintenance run --auto`; watch for a recurrence after merge.
3. **#421 (nit):** `makeRepo` lost its JSDoc placement (`fixture.ts`).
4. **#420 (non-blocking):** the `record read from origin/master …` line is outside the verbatim Briefing block, so the human-visible brief
   does not say where the record came from.
5. **#420 (non-blocking):** two QA mutants survive. The Sizes block can keep the local state.json line, and the no-readable-local-record branch can go to LOCAL.
6. **#415 (out of scope):** `seat-map.ts:36` is the last inline `basename(resolve())` derivation.
7. **#418 (cosmetic):** `hub-seats.test.ts` uses a retired room id as synthetic data.

QA-272: REPORT COMPLETE
