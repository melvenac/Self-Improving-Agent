# T-194 nit: the S4-9.2 platform-skip row gets its own id (S4-9.2c); and T-284's env observation from a `claude -p` run

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, NOT the desktop. No hub key. **Tests-only** (SG-1: merges on green CI after the planner's ACCEPT
naming the head). Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t194-nit-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Tasks:** T-194 (P0, a nit owed from #749), T-284 (P3, one
observation). **Tag:** `T194-NIT`. **Size:** TINY.
**Base:** the dispatch SHA clark names; if none, `origin/master` after the fetch.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: none: one test title string in open-brain/tests/harness/s4-guards.test.ts; no src
```

## Why

- #749 added the row `S4-9.2b a platform-skip allowance matches one added line exactly, and an unused one is stale`
  to `open-brain/tests/harness/s4-guards.test.ts`. An older row there already starts `S4-9.2b the allowance table: …`.
  Two rows with one id make a red line ambiguous. The newer row becomes `S4-9.2c`. Nothing in the repo refers to
  either title (planner grep: only the rendered record views mention the nit).
- **T-284** needs to know whether a non-Remote-Control `claude -p` session hands `CLAUDE_CODE_*` variables to its
  shell. This run is one.

## Ruling (exact)

In `open-brain/tests/harness/s4-guards.test.ts`, the ONE line
`  it("S4-9.2b a platform-skip allowance matches one added line exactly, and an unused one is stale", () => {`
becomes
`  it("S4-9.2c a platform-skip allowance matches one added line exactly, and an unused one is stale", () => {`.
Nothing else changes. The row `S4-9.2b the allowance table: …` stays as it is.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t194-nit-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. **T-284 observation, before anything else.** From Git Bash: `bash -lc 'env | grep ^CLAUDE_CODE_ | cut -d= -f1'`,
   and from PowerShell: `Get-ChildItem Env: | Where-Object Name -like 'CLAUDE_CODE_*' | Select-Object -ExpandProperty Name`.
   Paste both (names only; print `NONE` for an empty result).
3. Fresh clone into `(Join-Path $env:TEMP "t194-nit-wt")` unless the launcher named one;
   `git checkout -q -b fix/t194-s4-title <base>`; `rev-parse HEAD` = base; porcelain empty. `npm ci` in `open-brain`.
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout,
   `npm run test:heavy`, killing any process by name.
4. Apply the ruling. `git diff` shows exactly one `-` and one `+` line, as above; paste it.
5. `$env:NO_COLOR='1'`; in `open-brain`:
   `npx vitest run tests/harness/s4-guards.test.ts --no-file-parallelism --testTimeout=180000` (all green; paste the
   summary and the two lines whose titles start `S4-9.2b` and `S4-9.2c` from `--reporter=verbose`), then
   `npx tsc -p tsconfig.tests.json --noEmit` (exit 0).
6. Commit `T-194: the platform-skip guard row is S4-9.2c, not a second S4-9.2b`, message ending with
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline <base>..HEAD` shows 1 line;
   `git diff --name-only <base>..HEAD` shows exactly `open-brain/tests/harness/s4-guards.test.ts`; porcelain empty.
7. `git push origin fix/t194-s4-title` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr create --base master --head fix/t194-s4-title --title "T-194: the platform-skip guard row is S4-9.2c, not a second S4-9.2b" --body "Brief: docs/loops/t194-s4-title-nit-brief.md. Tests-only (SG-1): merges on green CI after the planner's ACCEPT naming the head."`;
   `gh pr checks <n> --watch --interval 30` (cap 25 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T194-NIT <sha40> PR #<n>` or `BLOCKED T194-NIT <reason>`.
- Then each command with its output. Mark anything not run `NOT RUN`. Do not merge.
