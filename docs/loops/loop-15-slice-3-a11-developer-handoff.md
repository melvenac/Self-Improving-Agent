# A11 developer handoff

Record 115, continuing through a desktop restart. Model: Grok 4.7. No effort setting is shown. GitNexus impact is unavailable on this seat. The index is at `6bd97f2`. Callers below are from grep.

Candidate `loop/15-slice-3-candidate-a11`. The product tree is `0f42cc8c11420374564916f5dce2582029c2d37d` (R88). This file is the commit after it. Parent of the series is A10 `4b7a5ae`. CA-9 (T-182, `claude` lacks `--permission-prompts`) fails every tcm run and is not this seat's.

## No merge of master

At dispatch, `git diff --name-only 9bc06e3 origin/master` was only `docs/` and `.agents/`. No merge was made. At this handoff the same command also lists paths outside those two trees (`.github/workflows/ci.yml`, `CHANGELOG.md`, `open-brain/src/cli.ts`, `open-brain/src/pipelines/state-import/`, `open-brain/src/pipelines/sync/`, and their tests, among others). Those commits landed on master during A11. They are not in this candidate. This seat did not merge them.

## Commit table

`git diff --stat` for each commit in `4b7a5ae..0f42cc8`, oldest first. Each commit is one ruling.

| SHA | diff --stat | Ruling |
|---|---|---|
| `0cf7933` | 2 files, +174. `configwatch.ts` +14, `configwatch-r83.test.ts` +160 | R83. A contained `lstat` failure is `unreadable (<code>)`, not null. |
| `6fa7cea` | 2 files, +113 −2. `configwatch.ts` +15 −2, `configwatch-r84.test.ts` +100 | R84. An observation other than a read, lost at close, fails the stage. |
| `a5f3715` | 2 files, +143 −4. `configwatch.ts` +17 −4, `configwatch-r85.test.ts` +130 | R85. A side names its failure and keeps the facts `observe` has. |
| `adb20a4` | 2 files, +71 −1. `configwatch.ts` +31 −1, `configwatch-r86.test.ts` +41 | R86. An ancestor link's type-change text carries that link's `lstat`. |
| `ff637a2` | 1 file, +83. `configwatch-r87.test.ts` | R87. The `runLoop` call site, not the helper. |
| `0f42cc8` | 3 files, +86 −4. `configwatch.ts` +25 −2, `runtime.ts` +5 −4, `configwatch-r88.test.ts` +60 | R88. A read failure at open refuses the stage. |

## R83 consumer list

A contained `lstat` failure is `identify` kind `other` plus a code. These three turned that into null (absent) at `0cf7933` and now return `unreadableIdentity`:

- `readState`, the branch before `kind !== "file"` (`0cf7933:474`, HEAD `:478`).
- `begin`, the resolution-diff branch (`0cf7933:695`, HEAD `:714`).
- `readForCompare`, the same branch (`0cf7933:716`, HEAD `:735`).

`listTree` already records that failure as `unlisted: <dir> (<code>)` (`:185`). It does not become null. `resolutionComp` keeps kind `other`. The machine side is `observe`, which does not take this null path; R84 and R85 cover it.

Two sites still turn an identity into null or skip it. Neither got a commit.

1. Kind `dir` at a watched file path returns null, which is the same state as absent. The returns are `readState` (`0cf7933:475`, HEAD `:479`), `begin` (`0cf7933:696`, HEAD `:715`) and `readForCompare` (`0cf7933:717`, HEAD `:736`). A directory is not a config file and git does not execute a directory at a hook path, so a directory that was never a file is not a config change. A directory that replaces a file is still a change: begin held a file and close holds null, so `changed` is true and the existing restore stop for a directory at that path applies.

2. `repositoryLinksAtBase` `:227` lists a watched tree only when `identify(t).kind === "dir"`. Kind `other` (an `lstat` failure on the tree) skips the symlink scan and writes no unlisted note. That `lstat` failure is reachable: any code other than `ENOENT` or `ENOTDIR` on `hooks` or `info`. The stage does not depend on this scan. `currentFiles` calls `listTree` on the same tree, `listTree` records `unlisted`, and begin refuses with `config-watch-unestablished` before the role runs. No hole that lets a role run.

## R85 search

Whole-file search of `configwatch.ts` for a side built from a bare word or from zeroed facts, after `a5f3715`.

Printed as a real absence, not as a contained failure:

- `stateHash(null)` is the word `absent`.
- A tree root that was absent at base is `before: "absent"` (`:788`).
- `baseText` for a non-link that did not resolve is `absent at loop base`.
- `hashOf(null)` is the word `absent`. `stateHash` does not call it for a read error or an unread identity; those return earlier.

Printed with the failure, not as a stand-in for it:

- `stageBefore` prints `did not resolve: <code>` for a failed `lstat`. The word `absent` alone is not that side.
- `currentSide` prints `s.reason` when a non-link did not resolve, so an ancestor link's current side names `ENOENT` and does not print `dev null`.
- A link side is `link: type symlink` plus `lstat`, then `resolves to:` or `does not resolve (<code>)`.
- An open that throws `ENOENT` sets `reason` to `absent (<code>)` and `currentSide` prints that reason.

Still zeroed, and the row does not forbid it:

- When `realpath` throws, `observe` returns the unresolved snap (`kind absent`, `dev null`, `nlink 0`, `size 0`, `mtimeNs 0`). The unobservable close text is `unobservable (<code>);` plus `factText` of that snap, so the zeros are printed. `R85-UNOBSERVABLE-FACTS` requires `dev `, which `dev null` satisfies. The facts `observe` has there are the code, not an `lstat`.

## Per ruling

CA-9 is on every run below and is not counted.

**R83.** Red `36206389362`, head `3dbe5c7`. All four rows red: `R83-NOSEARCH-PLANT` (code undefined, not `stage-changed-config`), `R83-NOSEARCH-KEEP` (kind `deleted`), `R83-BEGIN-UNSEARCHABLE` (hook reads back deleted), `R83-BEGIN-DIFF` (begin recorded created). Green `36206544020`, head `0cf7933`. All four passed. Mutants, each one consumer removed:

- `readState` `02871d7`, `36206587305`. Kills only `R83-BEGIN-UNSEARCHABLE`.
- `readForCompare` `5de5bb3`, `36206621733`. Kills `R83-NOSEARCH-PLANT` and `R83-NOSEARCH-KEEP`.
- `begin` `3593680`, `36206655901`. Kills only `R83-BEGIN-DIFF`.

**R84.** Red `36207028035`, head `ad6e601`. `R84-ABSENT-THEN-EACCES` and `R84-NOT-A-FILE-THEN-EACCES` red (code undefined, loop completed). `R84-ALREADY-UNOBSERVABLE` passed. Green `36207220360`, head `6fa7cea`. All three passed. Mutants:

- read `f353f3e`, `36207340877`. Kills `R84-ABSENT-THEN-EACCES` and `R84-NOT-A-FILE-THEN-EACCES`. `R84-ALREADY-UNOBSERVABLE` stayed green.
- env `1d203bd`, `36207497348`. Kills `R84-ALREADY-UNOBSERVABLE`. The same mutant also reddens `R73` and `R72` (both expected `unreadable` and got `unobservable`).

**R85.** First red `36210115789`, head `1bb1ddc`, is not the counted red: `R85-ANCESTOR-ENOENT` passed because it watched `find()` rather than the link's `compare()`. Corrected red `36211775483`, head `d838c38`. All four rows red for the right reason: `R85-START-LSTAT` (`before` was `absent`), `R85-UNOBSERVABLE-FACTS` (no `dev `), `R85-ANCESTOR-ENOENT` and `R85-ANCESTOR-TYPECHANGE` (no `ENOENT`, zeroed facts). Green `36212486384`, head `a5f3715`. All four passed. Mutants:

- `r85-absent` `5332ea8`, `36212897040`. Kills only `R85-START-LSTAT`.
- `r85-facts` `bf1763c`, `36212932192`. Kills only `R85-UNOBSERVABLE-FACTS`.
- `r85-ancestor` `8a4e660`, `36212963405`. Kills `R85-ANCESTOR-ENOENT` and `R85-ANCESTOR-TYPECHANGE`.

**R86.** Red `36213535226`, head `1c1d441`. `R86-ANCESTOR-LINK-FACTS` expected `link: type symlink` and did not find it. Green `36221235174`, head `adb20a4`. The row passed. Mutant `r86-link` `24de293`, `36221237060`. Kills only that row, same missing label.

**R87.** The product already called `machineChangeReported` at the call site, so there is no red on the product. The red is the call-site mutant. Green `36222006907`, head `ff637a2`. `R87-EQUAL-REPORTED` and `R87-UNCHANGED-SILENT` passed. Mutant `efc69ef`, `36222008162`, is QA 108's `if (f.before === f.after) continue`. It kills both rows: the equal-text change was not reported, and the unequal unchanged finding was. `R72-EQUAL-TEXT` stayed green.

**R88.** Red `36223778379`, head `f0c215a`. `R88-EACCES-AT-OPEN` expected `config-watch-unestablished` and the failure was undefined (the loop completed). Green `36224103396`, head `0f42cc8`. The row passed. Mutant `r88-open` `57b75a2`, `36224104646`. Drops the open read-failure check and kills only that row, same undefined code.

## Existing assertions that changed

None. `git diff --name-status 4b7a5ae..0f42cc8` is the two source files modified and the six new test files added. No existing test file was modified.

## Callers found by grep

GitNexus impact was not run. The index is at `6bd97f2`.

- `machineChangeReported`: defined in `runtime.ts`. The production call is the machine-finding loop inside `runLoop`. `cli.ts` calls `runLoop`. `configwatch-r80-report.test.ts` calls the helper directly (`R72-EQUAL-TEXT`).
- `readFailuresAtOpen`: defined on `ConfigWatch`, called from `runLoop` beside `unlistedAtOpen`.
- `runLoop`: `cli.ts`, and the harness tests.

## Not verified

No full local suite (the planner's ruling). The win32 rows these tests `skipIf` are unread here; tcm is Linux. QA 108's probes were not re-run on this seat.

## Rulings

Rulings-19 is `bddb289c4c335c1cb6d09246de7739e40bcb7468` on `origin/docs/session-100-qa99-dispatch` (`docs/loops/loop-15-slice-3-rulings-19.md`). R83 through R88.
