# Loop 15 slice three — independent A13 spot-check: ACCEPTED

**QA:** record session **174**, GPT-5.6 Sol (`gpt-5.6-sol-medium` in the headless driver), 2026-09-27.
**Machine:** `DESKTOP-O4EGB1E`, Windows 10.0.19045. The process is elevated and
`SeBackupPrivilege` is **Enabled** (`whoami /priv`), so real chmod/EACCES rows ran on tcm and
win32 used the wrapped-`lstat` rows. Worktree:
`C:\Users\Aaron Melven\Worktrees\sia-qa`.

**Candidate:** product `4b43410`, frozen with handoff `0d44374` on
`origin/loop/15-slice-3-candidate-a13`. `ls-remote` still returned `0d44374` during QA.
The product diff from A12 `a69f07d` is only `configwatch.ts` (+7/-3) and
`configwatch-a13.test.ts` (+231). The handoff is the sole later file.

## Verdict

**ACCEPTED. R95, R96 and R97 hold. A12-1 is healed in the original QA-130/149 rows; the
unobservable path remains in the tree, is truthfully named as not removed, enters
`unrestored`, and stops the runtime before git. The fourth `ConfigChange.kind` has no
unhandled consumer. No regression was found in the byte-exact QA-130/149 row set.**

The independent tcm baseline was run on `b7c866c`:
[run 36306471608](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36306471608).
It had 17 expected reds, 1580 passes and 5 skips (1602): CA-9 (T-182), QA 149's 14
carried reds, and O-1's two already-reported `baseText` rows. None is A13's. All scored
A13, QA-130 and QA-149 healing rows passed.

## Checks 1–7

### 1. A12-1 is healed on real chmod and wrapped `lstat`: PASS

The branch carries the original QA-130/149 files byte-exact from `b462496`; all 18 blob
hashes were compared before the run. On tcm:

| Required shape | Result at A13 |
|---|---|
| Q149-C1-HOOKS-ONLY | `kind: unobservable`; `unrestored` has the exact note; no restore claim; plant present; `gitAfterRole: []` |
| Q149-C1-SUBDIR-ONLY | same, with real chmod/EACCES |
| Q149-MOCK-HOOKS-ONLY | same through wrapped `lstat` |
| Q149-MOCK-PLUS-CONFIG | same; additionally `cfgRestored: true` |
| Q130-R83-SUBDIR-NOSEARCH-PLANT | `kind: unobservable`; exact note; stage refused; `gitAfterRoleCount: 0` |

Every required message contains `FILE(S) COULD NOT BE PUT BACK` and `Recover by hand`,
and none contains `Every file was put back`. The original QA-149 rows—not just A13's
similar developer rows—passed.

The same three wrapped rows passed locally on win32. The focused local run was 6 passed,
6 platform skips. It observed `kind: unobservable`, the exact EACCES note, the plant
still present and zero git calls.

### 2. R96, every `ConfigChange.kind` consumer: PASS

Independent searches of the product tree found:

- `configwatch.ts` constructs the union and records the four values.
- Its message builder prints `c.kind` for ordinary changes, but intentionally omits the
  word when `after` starts with `unobservable (`. This is presentation only.
- `runtime.ts` serializes each `changes` object whole into findings.
- Counts use `changes.length`.
- Restore decisions use the local `FileState.kind`, not `ConfigChange.kind`.
- The R77 stop uses `unrestored`, `unlisted` and `ancestorLink`; no gate switches on
  `ConfigChange.kind`.
- Tests assert selected values; no production switch, exhaustive map, count or
  serializer assumes only three values.

`tsc --noEmit` passes. The fourth value therefore does not create an unhandled branch.

### 3. R97 rows assert both the summary and pre-git stop: PASS

The four developer rows each check:

- `claimsRestore: false`;
- exact unrestored wording;
- `gitAfterRole: []`;
- plant still present;
- `kind: unobservable`.

The original QA-149 rows independently assert the false restore claim and empty
`gitAfterRole`; the original QA-130 row independently asserts the empty git call list.
This closes the gap that admitted A12-1.

### 4. The note is true and narrowly emitted: PASS

The R90 arm reads the close-time failed `lstat`, does no removal, pushes
`absent at the open; cannot be lstat'd at close (<code>); not removed`, and immediately
continues. Every positive row confirms the plant remains.

QA 174 added two controls:

| Control | Observation |
|---|---|
| Q174-R95-REMOVED-CONTROL | observable created hook: `kind: created`, absent after close, `unrestored: []`, no R95 note |
| Q174-R95-RESTORED-CONTROL | changed baseline hook: `kind: modified`, original bytes restored, `unrestored: []`, no R95 note |

Both passed on win32 and tcm. The note therefore does not fire for a path that was
removed or restored.

### 5. Re-done R85 search: PASS

I read `configwatch.ts` and searched every side/summary constructor. The handoff table is
accurate:

| Site family | Failed observation text | Reaches repository `unrestored`? |
|---|---|---|
| `stateHash` | failed lstat with null device prints `unreadable (<code>); no facts: lstat failed` | no; caller decides |
| R90/R95 arm | `absent` to `unobservable (<code>)`; truthful not-removed note | **yes** |
| repository message | omits an invented kind word for the unobservable side; selects the could-not-put-back summary | prints the array |
| general created/restore arm | ordinary created/deleted/modified side; created non-file note | yes when not removed/restored |
| `factText`, `readText`, `linkSide`, `ancestorLinkText` | observed file/link facts | no |
| `unobservableSide`, `currentSide` | errno/route-specific side without invented zero facts | no |
| `baseText` | still says `absent at loop base` for O-1's EACCES base | no; O-1 is outside A13 |
| `stageBefore`, unobservable row, stable row | stage-start and close observations | no |
| absent/link and type-change rows | labelled link/type facts | no |

The other repository `unrestored` pushes cover unlisted descendants, unread snapshots,
created non-files, failed read-back and surviving links. No second path can emit the R95
note, and no R90 path bypasses `unrestored`.

### 6. Regressions on QA-130/149 rows and full suite: PASS

The tcm baseline contains QA 130's full row file and all QA-149 row files byte-exact.
Compared with QA 149's recorded baseline:

- A12-1's five original failing rows are healed.
- The 14 historical carried reds are unchanged.
- CA-9 remains T-182.
- O-1's two rows remain red and are explicitly outside A13.
- No additional predecessor row is red.

The one local full suite used the driver's original default temp,
`C:\Users\AARONM~1\AppData\Local\Temp`, not `C:\qa-tmp`: 8 failed, 1441 passed,
153 skipped (1602). The eight are QA 149's seven known win32 carried reds plus O-1's
wrapped row. All A13 and QA-174 rows passed.

`git merge-tree --write-tree origin/master 4b43410` exited 0 and produced tree
`f4719339d0ad44c80da1f307b8b03355d51ba357`.

### 7. Own mutants, at least one per ruling: PASS

Each mutant is one source edit on the probe branch, typechecked, built and run on tcm.
Failures below are additions relative to the 17-red baseline.

| Ruling/protection | Branch / SHA | Run | Mutation | Added failures |
|---|---|---|---|---|
| R95 | `qa/loop-15-slice-3-a13-spot-m-r95-drop` / `d060d88` | [36306517046](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36306517046) | drop `unrestored.push(leftInPlace)` | **9**: all four A13 rows, Q130 subdir, QA-149's two real and two wrapped rows |
| R96 | `…-m-r96-kind` / `62c69ea` | [36306550612](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36306550612) | store `kind: "modified"` | **4** A13 rows |
| R97 | `…-m-r97-stop` / `e76d453` | [36306581483](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36306581483) | make the R77 stop ignore `unrestored` | **16**, including all four A13 rows and the original QA-130/149 stop rows |
| note text | `…-m-note-text` / `d0c2cc8` | [36306609462](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36306609462) | `not removed` to `left in place` | **4** A13 rows |

Totals were respectively 26/1571/5, 21/1576/5, 33/1564/5 and 21/1576/5
(failed/passed/skipped, 1602). The inverse and the note mutation both go red.

## CI and full-suite accounting

- tcm CI used **5 of 8** allowed runs; `windows` was never enabled.
- The `test-windows` job is skipped on every run.
- Baseline and all mutants passed install and typecheck.
- Developer evidence was independently re-read per test:
  - red `36294235947`: all four rows show `kind: modified`, a false restore claim,
    empty `unrestored` and six git calls;
  - green `36294470032`: all four show `kind: unobservable`, exact note, no restore
    claim and no git calls;
  - drop-push `36294505899`: all four go red with six git calls;
  - kind mutant `36294528231`: all four go red while the stop still holds.

## What could not be verified

- A real win32 ACL denial. This elevated process has `SeBackupPrivilege`; wrapped
  `lstat` is the valid win32 seam, while tcm supplied real chmod/EACCES.
- GitNexus impact/detect tools. This checkout has no `.gitnexus`, runner, CLI or MCP
  namespace. I manually traced `closeAndRestore` to its sole production caller
  (`runLoop`) and searched consumers. The pre-commit sync also reports the index check
  skipped, not passed.
- O-1 is not retested as an A13 fix because rulings 21 explicitly exclude it. Its two
  tcm rows and one win32 row remain red as expected.

## Defects

None in A13's scored scope.

## Disagreements

None. The handoff's claims, source, developer CI and this independent run agree.

## Error entries

1. The first guarded push invocation used the script path relative to the candidate
   worktree, where the newer `qa-174` directory does not exist. Node returned
   `MODULE_NOT_FOUND`. I reran the same guarded script by absolute path from the QA tree;
   it pushed and read back the allowed branch.
2. On the first mutant, `npx tsc --noEmit` was mistakenly run from the repository root,
   causing `npx` to fetch the unrelated deprecated `tsc@2.0.4` and exit 1. The immediately
   following repository build used `open-brain`'s installed TypeScript and passed. Every
   later mutant used `npm --prefix open-brain run typecheck`.
3. `/sync` consistently reports two pre-existing issues (retired names in
   `ENTITIES.md`, greeting over 40,000 characters), three warnings, and the expected
   GitNexus skip. No QA file caused them.
4. My first report-worktree sync used the candidate worktree's older built CLI, which
   expected state schema v2 and falsely called the current schema-v3 state invalid. I
   built the report branch's own CLI and reran sync: state schema v3 passes; the
   pre-existing results are those in item 3.

No command was denied and no permission refusal occurred.

## Reproduction

- Probe branch: `qa/loop-15-slice-3-a13-spot-probe` at `b7c866c`.
- It contains the 18 byte-exact predecessor probe files plus
  `qa174-a13-note-controls.test.ts`.
- All pushes used `docs/loops/qa-174/push-qa.mjs`; no direct `git push`, PR, tag,
  merge or state write was attempted.
- Mutant branches and runs are listed above. Each differs from the probe by its one
  source hunk.

## Open for the planner

None. Recommendation: accept A13. O-1 remains the already-ruled, separate A10-family
observation.

QA-174: REPORT COMPLETE
