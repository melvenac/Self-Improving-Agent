# QA 259, batch B5: placeholder reason, CI group pin, hub-talk exit codes (#292, #293, #320)

**By:** Atlas (planner), 2026-10-02, record session 157, under Aaron's batch-QA rule.

**Merge authority:** B5 is **NOT** covered by Aaron's overnight pre-approval, which covers QA 255 to QA 257 only. An
ACCEPT here waits for his word.

**QA runs on Opus. Job class: LIGHT.** That means touched test files, **one test file per vitest invocation**, mutants
on touched files only, and `gh` reads. No full suite. **Make no live Jev call.**

**Pinned heads, all based on master:**

| PR | Task | Head | Code SHA | Dev handoff |
|---|---|---|---|---|
| #292 | T-224: an unfilled `<placeholder>` is named as such; PLACEHOLDER regex `\s` fix | `c77dce55677a71a4ede59bbab933adf3270f2c22` | same | sia-builder's message plus `docs/loops/session-157-builder-2-handoff.md` (T-224 section) |
| #293 | T-223: exact CI concurrency-group strings, re-pinned to #310's `ci.yml` | `58e0ce15eb5871c50eb01794c007a9a842fc5acb` | same | as for #292 |
| #320 | T-228: Cursor `/start` and hub-room rules handle hub-talk exit codes 0 to 3 (A2A Loop 13) | `c9b5e7571d0b02c822372d78ed102281e7415c8e` | `e1ffa274` | `docs/loops/t228-developer-handoff.md` |

## Rows for each PR

1. **Confined.** List the files each PR's own commits touch beyond master.
2. **Red then green.** Run the new or changed test files against master's source (they fail) and against the head
   (they pass). Quote the counts.
3. **One mutant of your own**, plus one of the developer's.
4. **CI on the head (read only).** Run `gh pr checks <n>` and quote the `test` result and the run id.

## Rows specific to B5

5. **#292.**
   - At the head, read `cat -A` of PLACEHOLDER in `agent-identity.ts`. It must read `/<[^<>\s]+>/`.
   - These values count as placeholders: `<status>`, `<seat>`, `<sia-status-recipient>`.
   - The prose `a < b > c` does not count as a placeholder.
   - An absent key still says "missing".
   - The template example, read at test time, gives `status_to is an unfilled placeholder (<agent-name>)`.
6. **#293.**
   - On master, `ci.yml`'s groups are `ci-pr-<number>`, `ci-push-<sha>` and `ci-dispatch-<run_id>`. Show that the new
     row asserts exactly these strings.
   - The same digits used as a PR number, a SHA and a run id give three distinct groups.
   - Apply each mutant to `ci.yml` in your tree only, then restore it. Mutant M1: the PR group loses `pr-`. Mutant M2:
     the push group gains `pr-`. Each must turn the new row red while #310's own T-227 row stays green.
7. **#320.**
   - Every copy that carries the hub-talk wait sentence states rc 0 to 3 as relay's table gives them. Find the copies
     with `git grep -n "wait-timeout 3500"`.
   - rc 3's text includes the stderr line `[hub-talk] retry status=<code|network> retry-after=<seconds|unknown>`, the
     retry-after wait, the 5 s doubling to 60 s backoff, and the stop after 5 consecutive rc 3 over 2 minutes with no
     retry-after.
   - The two `hub-room.mdc` files are byte-identical.
   - `start-parity`, `command-parity`, `mirror-parity` and `hub-seats` pass.
   - The `cursor-start-differences.json` change only replaces the hub-room entry.
8. **Batch merge order.** On a scratch branch from `origin/master`, merge in this order: #293, #292, #320.
   - Report any conflict.
   - Run the touched test files one per invocation, and run `tsc --noEmit`.

## Rules (headless Claude Code)

- You are **QA 259**, and your prefix is `b5-misc`. Push ONLY `qa/b5-misc-*` branches, and only through
  `node docs/loops/qa-259/push-qa.mjs <branch>`, run from your `qa259-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config files (`~/.claude.json`, `settings.json`, `.mcp.json`, env), report **only counts, key names, server
  names and command paths, never values.** Before every commit, scan for key and token patterns.
- Commit `docs/loops/b5-misc-qa-report.md`, with its `.E_t.json`, on `qa/b5-misc-report`.
- Give one verdict line per PR and a batch verdict.
- The last line is exactly `QA-259: REPORT COMPLETE`.
