# T-285 amendment 1: re-run M1 and M2 and paste their output (no commit)

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, **in the r1 clone `C:\Users\Aaron Melven\Worktrees\oneoff-t285`** (branch
`fix/t285-chunk-key-refusal` at `2bba8db753223281d8f2b638c9be44266c88ad97`, pushed, PR #727). No hub key.
**Read-only for git: no commit, no push.** Ends at a REPORT.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t285-r2-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-285. **Tag:** `T-285`. **Size:** TINY.

## Why

r1 is READY and its src is the ruling verbatim (planner-read). But in its reply (`~/Worktrees/t285-reply.md`, outside
the repo) the result blocks for mutants **M1** and **M2** are EMPTY (an empty code fence under each), so there is no
evidence either was killed. A blank where output should be reads as "nothing there"; the planner cannot count it.
M3's block is present and correct.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t285-r2-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. `Set-Location 'C:\Users\Aaron Melven\Worktrees\oneoff-t285'`. `git rev-parse HEAD` must print
   `2bba8db753223281d8f2b638c9be44266c88ad97` and porcelain must be empty, else BLOCKED.
3. For each mutant: edit `open-brain/src/server.ts`, run
   `npx vitest run tests/t285-chunk-key.test.ts --no-file-parallelism` in `open-brain`, write the run's FULL output to a
   file (`... *> "$env:TEMP\t285-mN.txt"`), then paste that file's `Tests` summary line and every `x`/`FAIL` row line
   into the reply as plain text (no ANSI colour: set `$env:NO_COLOR = '1'` first). Then
   `git checkout -- open-brain/src/server.ts` and paste `git status --porcelain` (empty).
   - **M1:** delete the whole `if (heldKey) { ... }` block. The brief predicted K1 and K2 red; r1's note says K2 is then
     caught by the path guard instead. Paste what actually goes red.
   - **M2:** `if (heldPath || existsSync(vaultPath))` → `if (heldPath)`. Expect K3 red.
4. Paste `git rev-parse HEAD` (still `2bba8db7…`) and porcelain (empty) at the end.

## Reply

- **First line:** `REPORT T-285 M1=<rows red> M2=<rows red>` or `BLOCKED T-285 <reason>`. Then each command with its
  output.
