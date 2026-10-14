# T-288 amendment 1: row S8 kills M4 (a 3rd commit in the r1 clone), then push

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, **in the r1 clone `C:\Users\Aaron Melven\Worktrees\oneoff-t288`** (branch
`fix/t288-trigger-parser-gaps` at `b4ffeb57b0785f5a23d872e28f8f717a493ae2c9`, pushed, PR #728). No hub key. Ends at
READY with PR #728 updated, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t288-r2-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-288. **Tag:** `T-288`. **Size:** TINY.
**The brief stands** (`docs/loops/t288-trigger-parser-gaps-brief.md`) with the change below.

```text
IMPACT-TARGETS: none: test code only (tests/trigger/t288-parser-gaps.test.ts, row S8); no src symbol changes
```

## Why

r1 is READY and its src is the ruling verbatim (planner-read). Two of the brief's mutant predictions were wrong, and the
builder said so with evidence (`~/Worktrees/t288-reply.md`, outside the repo):
- **M4** (`INNER_SHELL_C`'s `\s*$` unanchored) turned nothing red: no row put a single-quoted argument AFTER the
  inner shell's `-c` script. The builder's probe `bash -c 'true' 'npm test | tail -5; echo $?'` (the second argument
  is `$0`, not a script) is SAFE at HEAD and UNSAFE under M4. The planner re-checked it against a patched copy of
  query.ts: fixed → safe, query `""`; M4 → unsafe, query `"tail" "exit" "code"`.
- **M5** (`stages.length > 1 &&` deleted) is equivalent, as the builder showed: with one stage, a whitespace-only
  current stage means the statement is empty, so the original `flush()` pushes nothing and M5's `add(" ")` is trimmed
  away. Ruled equivalent; no row.

## Ruling

1. **Commit 3, `T-288 r2: row S8 kills M4 (a quoted argument after the -c script is $0, not a script)`**,
   `open-brain/tests/trigger/t288-parser-gaps.test.ts` only: add one entry to the SAFE table, after S7:
   `"bash -c 'true' 'npm test | tail -5; echo $?'"` labelled S8 (match the table's labelling style). Change nothing
   else. End the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t288-r2-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. `Set-Location 'C:\Users\Aaron Melven\Worktrees\oneoff-t288'`. `git rev-parse HEAD` must print
   `b4ffeb57b0785f5a23d872e28f8f717a493ae2c9` and porcelain must be empty, else BLOCKED. **Forbidden:** stash,
   `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout, any edit outside the one test file.
3. Commit 3. In `open-brain`: `npx vitest run tests/trigger/t288-parser-gaps.test.ts --no-file-parallelism` (16 rows,
   all green). Then **M4** (unanchor `\s*$` → `\s*` in `INNER_SHELL_C`; run the t288 file; S8 must go red; paste;
   `git checkout -- open-brain/src/trigger/query.ts`; porcelain empty). Paste both.
4. `git log --oneline fc1fd551..HEAD` shows 3 lines; `git diff --name-only fc1fd551..HEAD` shows the same two files
   as r1 (fc1fd551 is r1's base, the dispatch SHA).
5. `git push origin fix/t288-trigger-parser-gaps` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr checks 728 --watch --interval 30` (cap 20 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T-288 <sha40> PR #728` or `BLOCKED T-288 <reason>`. Then each command with its output. Do
  not merge.
