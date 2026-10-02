# Builder roll handoff, addendum (2026-10-02, after the GREEN restart)

**Adds to** `docs/loops/builder-roll-handoff-2026-10-02.md` (merged as #318). **Where the table there disagrees with this file, this file wins.** Written by Forge (builder, sia-builder), record session 157, with `origin/master` at `117dc4e3`. Everything of mine is pushed; the working tree is clean.

## What changed since the roll handoff

| PR | task | code SHA (freeze) | state | note |
|---|---|---|---|---|
| #287, #291, #297, #312 | T-209/T-210, T-183, T-226, T-148 | (as in the roll handoff) | **MERGED** (QA 255 accepted B1) | nothing owed |
| #304 | backlog audit | `fb65f77f` | **MERGED** | |
| #292 | T-224 placeholder reason | **`c77dce55677a71a4ede59bbab933adf3270f2c22`** (was `4c2129d3`) | open, CI green, batch B5 | the `\s` fix from the roll handoff's open item 1 is DONE: `PLACEHOLDER` is `/<[^<>\s]+>/`; row SR-8d, red on `4c2129d3`, green after |
| #293 | T-223 pin the PR concurrency group | **`58e0ce15eb5871c50eb01794c007a9a842fc5acb`** (was `c2d52d8a`) | open, CI green, batch B5 | **re-pinned, not closed**: #310 (T-227) rewrote the groups to `ci-pr-<number>`, `ci-push-<sha>`, `ci-dispatch-<run id>`; branch reset to master and one new row asserts those exact strings and the cross-kind collisions; `ci.yml` unchanged |
| #299, #302 | T-050, T-048 | `ddea392b`, `b47eb897` | open, batch B4 per Atlas | unchanged |
| #313, #314 | T-065, T-042 | `3b3b6c2a`, `41c87b16` | open, CI green | unchanged |
| **#320** | **T-228** hub-talk exit codes 0-3 | **`e1ffa274a64cc46db791845c7d16fb8d9cf6589e`** (tip `c9b5e757`) | open, CI green, batch B5 | three Cursor copies of the wait rule + two `cursor_only` table entries + `hub-talk-exit-codes.test.ts`; **not docs-only** (it adds a test file); handoff `docs/loops/t228-developer-handoff.md` |

## Open items now
1. Nothing is owed from the `\s` defect: it was the roll handoff's item 1 and is closed in #292.
2. Backlog gate: clark's rule is no new CODE PR while 6 or more SIA code PRs await QA. Mine awaiting QA: #292, #293, #299, #302, #313, #314, #320.
3. If QA rejects one of these, Atlas sends the round. The T-209-class lesson stands: edit code containing `\` with the Edit/Write tools, never through a shell-quoted `node -e` or sed, and run the file that pins the behaviour before calling a branch done.
4. The rest of the roll handoff (next-work list, environment facts, standing rules) is unchanged.
