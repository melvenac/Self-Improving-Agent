# T-170 part (ii) research — amendment 1: no input file

**By:** Atlas (planner), 2026-10-15, session 172. **Amends:** `docs/loops/t170-ii-research-brief.md`. Everything there
holds except what this file changes. **Tag:** `T-170-II`. **Base:** the dispatch SHA clark names (a master that
contains this amendment).

## Why

The brief's INPUT, `t170ii-keys.json`, is an export of the live knowledge DB. Copying it to the QA PC was refused by
clark's classifier (sensitive-source provenance) and waits for Aaron. This variant needs no data from the desktop:
the key-specific parts move to a script the run writes and proves on synthetic keys, and the planner runs it on the
real keys after Aaron rules on the transfer.

## Changes

1. **INPUT: none.** Delete the INPUT paragraph. The run reads no file it did not create, apart from the clone and the
   QA PC's own transcripts as in A3. The public-repo rule stays in force for anything the run writes.
2. **A2 is dropped.** The planner classifies the real keys.
3. **A3 becomes key-free plus a script.**
   - (a) From the newest 60 `.jsonl` transcripts under the QA PC's `~/.claude/projects/`, report the following as
     aggregates only. Print no message text, no paths and no command text.
     - Tool calls per tool name.
     - The share of Read/Edit/Write/NotebookEdit calls whose path is repo-relative, home-relative or absolute.
     - The share of Bash results carrying an error signal (non-zero exit, `is_error`, or a non-empty stderr field: say
       which fields exist).
     - p50/p95 of Bash result text length.
   - (b) Write `t170ii-overfire.mjs` (node builtins only) to the run host's %TEMP%, NOT into the clone. Its usage is
     `node t170ii-overfire.mjs <keys.json> <transcripts-dir> [--newest 60]`. It reads keys in the brief's
     `{id, key, title, match}` shape and applies rules r1 and r2 exactly as the brief defines them. It prints, for
     each rule, the fire rate over all tool calls and the five keys with the most hits, by id. It never prints key
     text or transcript text.
   - (c) Prove the script on a synthetic keys file the run writes (at least 2 path keys and 2 error keys, built from
     paths and errors the run itself produced in A1's scratch project). Show one key that fires and one that does
     not, and name the transcript and line each hit came from. Paste the script in full in the reply, under its own
     heading, so the planner can run it unchanged.
4. **A4** recommends from A1, A3(a) and the script's design. It names which numbers would change the recommendation
   once r1/r2 are measured on the real keys.
5. **Part B is unchanged.**
6. **Reply first lines.** Replace the A2 field: `A1: <one line> · A3: <aggregates> · SCRIPT: proven <yes|no> · B:
   b1/b2/b3/b4 p50 <ms>`.
