# T-176: gitnexus-index measures both directions and says what each means, developer handoff

**By:** Forge (developer seat, `sia-forge`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t176-index-divergence` from `origin/master` `8b7aa952`. **Dispatch:** atlas-sia, session 157 (LIGHT). Not merged; one PR.

## What was already on master, and what this changes

Master already counted both directions (an earlier developer round, `docs/loops/t176-index-direction-developer-handoff.md`): two `rev-list --count` calls, pass only when both are 0. What differed from the ruling you gave me:

| Case | master | now |
| --- | --- | --- |
| at HEAD | pass | pass (unchanged: both counts 0) |
| behind only | warn, "N commit(s) behind HEAD" | unchanged |
| **ahead only** (HEAD is an ancestor of the index) | **issue** | **warn**, `index is N commit(s) AHEAD of HEAD` |
| **diverged** | issue naming both counts | issue naming both counts **and the merge-base** (`merge-base <sha>`, or "none (unrelated histories)") |
| **indexed sha not in the object store** | issue, "UNDEFINED, not zero" | **warn**, `not checked: indexed commit <sha> unknown ...`, still "UNDEFINED, not zero" |

Both directions now come from one call, `git rev-list --left-right --count <indexed>...HEAD`, so the two counts cannot come from different moments. A count that cannot be parsed is still an issue.

**Severity choices to confirm:** "not checked" as **warn**, not skip, so it stays visible and is never a pass, as with T-008b; it was an issue on master, so this is a weakening you asked for in words ("never a pass") but not in severity. Change one word in `checkGitNexusIndex` if you want issue.

## Rows (`tests/pipelines/sync/staleness.test.ts`, 19 tests)

At HEAD passes; behind warns with the count; **ahead** (QA's c9947c5 case: the index commit is a descendant of HEAD) warns with `index is 1 commit(s) AHEAD of HEAD` and `behind=0 ahead=1`; **diverged** is an issue with `1 commit(s) behind and 1 ahead`, `merge-base <the fixture's seed>`, and both short shas; unknown sha is `not checked: indexed commit 0000000 unknown` and warn; plus the existing rows (dead branch pin, no lastCommit, unreadable meta, no `.gitnexus/`).

## Evidence

- **Red** (the same test file against `origin/master`'s `checks.ts`): 3 failed, 16 passed: ahead (`expected 'issue' to be 'warn'`), diverged (`expected '...' to contain 'merge-base 3438b5d'`), unknown sha (`expected 'issue' to be 'warn'`). **Green:** 19 passed. `tsc --noEmit` 0.
- **Mutant** `docs/loops/t176/mutants/one-direction.diff` (the index-has-and-HEAD-lacks count is zeroed, so only the HEAD-has direction is counted): `tsc --noEmit` 0; **red on exactly `ahead` and `diverged`**, 17 others green, as ruled.
- Not run: the full suite; a real `/sync` report. This checkout has no `.gitnexus/`, so there was no real-index run (the check skips here).

## Overlap

This edits `checkGitNexusIndex` in `sync/checks.ts`, as do #295, #298 and #300 elsewhere in the file (`checkMcpCommandPaths`, `checkSkillsContract`). Different functions, so there is no textual conflict expected, but all four branches touch `checks.ts`; I branched from master and did not stack. If git reports a conflict at merge, it is in the import line or an adjacent hunk.
