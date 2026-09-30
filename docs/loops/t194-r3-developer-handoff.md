# T-194 r3: developer handoff

Headless developer seat (Claude Code, Sonnet 5.5) on the QA PC, D-068. Dispatch: `t194-r3-dispatch.md`.
Base: `origin/loop/t194-planner-hook` (699789e1 code) merged with `origin/master` `5ace9ff7` (merge commit, no rebase).
Code commit: `c1c907da`. Tests: `open-brain/tests/planner-hook/r3.test.ts` (40 tests). This is NOT Aaron's word on a merge (D-032).

## Local runs (TEMP/TMP = scratch dir, via a node wrapper)

| Command | Exit | Summary |
| --- | --- | --- |
| `npm ci` | 0 | added 185 packages |
| `npm run build` | 0 | `build stamped c1c907d` |
| `npx tsc --noEmit` | 0 | no output |
| `npx vitest run tests/planner-hook` | 0 | 3 files, **105 passed (105)** |

The full vitest suite was not run (memory is short on this machine, per the dispatch). No CI was run (D-061). The hook is not registered in any settings file.
`/sync` and gitnexus `detect_changes` were not run: this headless seat has no index and `/sync` needs the main tree. Run them at merge time.

## Rows: test, red, green

Red = `r3.test.ts` against the pre-change `src/` (699789e1 code + master): **35 failed | 5 passed (40)**. The 5 that pass are positive controls.
Green = the same file after the change: 40 passed.

| Dispatch item | Change | Tests (r3.test.ts) |
| --- | --- | --- |
| 1 D1 PH-1 (P9, P10, P13) | `toRepoRelative` in `paths.ts`; `checkFileTool` resolves against `resolveHookProjectDir` first | "D1 / PH-1", both slash forms, plus the real CLI exiting 2 |
| 1 D1 PH-2 (P11) | same | "D1 / PH-2": `.agents/state.json`, INBOX.md, both slash forms |
| 1 D1 PH-6 (P15) | `detectBashWriteTargets(command, repoRoot)` resolves redirect, `sed -i`, `tee`, `cp`, `mv` targets; quoted targets with spaces now parse | "D1 / PH-6", including quoted paths |
| 1 outside repo | absolute outside the root, or `../` out of it: deny naming the cause (also for Bash targets; `/dev/*` exempt) | "outside the repo" block, `toRepoRelative` unit rows, Git Bash `/c/` form |
| 2 D2 (P3, P4) | `isSingleInvocation` in `git.ts`; a no-grant docs merge needs one `gh pr merge` invocation, else grant path, no fetch | "D2" block: P3, P4, `\|\|`, `;`, `\|`, newline, `$()`, backtick, subshell, `&`, prefix; positive control still allows |
| 3 grant prefix | `grantMatchesCommand` applies `isSingleInvocation` to the prefix form | "grant prefix" block; the refused line leaves the grant unconsumed |
| 4 `--repo` | `ghRepoFlag`: `--repo`, `--repo=`, `-R` deny naming `--repo`, and read nothing | "--repo" block, asserts zero fetch calls |
| 5 D-066 (P6) | `.agents/assignments.json` in `DOCS_MERGE_ALLOWLIST_EXACT` | "D-066" block |

Behaviour to know: Bash writes to any absolute path outside the repo (for example `> /tmp/x`) are now denied, because item 1 says to deny any absolute path that resolves outside the repo. If the planner needs that, say so and it becomes a decision.

## Mutants (local only, T-207; nothing pushed except the candidate branch)

Each was applied to the code commit, checked with `tsc --noEmit`, run against `tests/planner-hook`, then restored. Diffs: `docs/loops/t194-r3/mutants/<id>.diff`. Runner outputs: `results.json` and `results-rerun.json` in the same directory.
The first `d1-file` and `d1-bash` forms failed tsc (TS2339, `never` narrowing). Those two rows in `results.json` are stale; the retyped forms are in `results-rerun.json`.

| Mutant | Change | tsc | vitest |
| --- | --- | --- | --- |
| ph1-tc | PH-1 check made unreachable (`relPath === "\u0000" &&`) | 0 | red, 8 failed |
| ph2-tc | PH-2 check made unreachable | 0 | red, 8 failed |
| ph3-tc | restricted-outward check bypassed | 0 | red, 43 failed |
| d1-file | drop root resolution for file tools | 0 | red, 9 failed |
| d1-bash | drop root resolution for Bash targets | 0 | red, 8 failed |
| d2-compound | allow compound after a docs merge | 0 | red, 11 failed |
| grant-prefix | grant prefix ignores single-invocation | 0 | red, 2 failed |
| repo-flag | `--repo` check disabled | 0 | red, 3 failed |
| d066 | assignments.json removed from allowlist | 0 | red, 1 failed |

9 of 9 red. The r1 ph4 to ph8 mutants and QA 233's q1 to q4 and m1 to m5 were not re-run this round; r3 does not touch those paths.

## Not covered

- No live check: the hook is unregistered, so PH-8's live half stays `not_evaluated`. The CLI test drives it with fixture input.
- Case-insensitive matching applies only when the repo root is a Windows drive path; there is no `realpath`, so a symlink or junction into the repo is not followed.
- Bash detection is still static and first-match (one `sed`/`tee`/`cp`/`mv` per line); that limit is stated in the deny text.
