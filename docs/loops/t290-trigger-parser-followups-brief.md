# T-290: the trigger parser reads a backslash continuation, a redirected `{ }` group, split shell flags, `$(sh -c …)` and ksh

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t290-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-290 (P3). **Tag:** `T-290`. **Size:** SMALL.
**Base:** the dispatch SHA clark names, which MUST contain T-288's merge (PR #728; not merged when this was written:
check `git log --oneline -1 -- open-brain/tests/trigger/t288-parser-gaps.test.ts` is non-empty at the base, else
STOP, `BLOCKED T-290 base lacks T-288`). **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: splitStatements scriptHasUnsafeRead isUnsafeStatusRead (open-brain/src/trigger/query.ts; the live PostToolUse recall trigger; covered by tests/trigger/*.test.ts)
```

## Why

T-288's Opus second review (ACCEPT at 94e53055, `~/Worktrees/t288-review-reply.md`, outside the repo):
- **F1 (common):** a backslash continuation after `|` (`npm test 2>&1 | \` then `tail -5` on the next line) is still
  missed. The `esc` branch keeps `\` and the newline in the stage text, so the stage's program reads as `\`, not `tail`.
  sh removes backslash-newline before tokenising.
- **F5:** `{ …; } 2>&1; echo $?` (the close is `} 2>&1`, not a lone `}`); `bash -e -c '…'` and `bash --norc -c '…'`
  (flags not joined into one cluster); `x=$(bash -c '…')` (the shell follows `(`); and `ksh -c '…'`.
- Not in this task (recorded on T-288): F2 (a function definition followed by `$?`), F3 (`echo sh -c '…'`), F4 (a
  comment ending in `|`), the double-quoted `bash -c "… \$?"` form. All are rare; F2-F4 are false positives that
  predate or ride T-288's rules.

**Planner pre-check** (scratch copies of query.ts, base = T-288's 94e53055 with these rulings applied, run through the
repo's tsx): U9-U15 read safe at T-288 and unsafe with the rulings; S9-S12 and all of T-288's U1-U8/S1-S8 keep their
verdicts; and each mutant below flips exactly its own rows (M1→U9, M2→U10/U11, M3→U12/U13, M4→U14, M5→U15).

## Ruling (exact; `open-brain/src/trigger/query.ts` only for src)

1. **Backslash-newline is removed.** In `splitStatements`, replace `if (esc) { add(c); esc = false; continue; }` with:
   ```ts
       if (esc) {
         esc = false;
         // T-290: a backslash-newline is removed before tokenising (sh), so `cmd | \⏎ tail` is one pipeline.
         if (c === "\n") { stages[stages.length - 1] = stages[stages.length - 1].slice(0, -1); masked = masked.slice(0, -1); continue; }
         add(c);
         continue;
       }
   ```
   (The `\` was already added by the `if (c === "\\") { add(c); esc = true; continue; }` line; this removes it.)
2. **A `}` followed only by redirections still closes the group.** Directly above `scriptHasUnsafeRead`, add:
   ```ts
   /** T-290: a group's close, alone or followed only by redirections (`} 2>&1`, `} > log`, `} &>/dev/null`). */
   const GROUP_CLOSE = /^\s*\}(\s*[0-9]*(?:[<>]{1,2}|&>)&?\s*[^\s;|&<>]+)*\s*$/;
   ```
   and in `scriptHasUnsafeRead` replace `all.filter((s) => s.masked.trim() !== "}")` with
   `all.filter((s) => !GROUP_CLOSE.test(s.masked))`. Update the comment above it to say "a statement that is only `}`,
   or `}` with redirections (T-290), closes a `{ ...; }` group".
3. **`INNER_SHELL_C`** becomes:
   ```ts
   const INNER_SHELL_C = /(^|[\s/\\(])(bash|sh|zsh|dash|ksh)(\.exe)?(\s+--?[A-Za-z][\w-]*)*?\s+-[A-Za-z]*c[A-Za-z]*\s*$/i;
   ```
   and its doc comment adds: "separate flags before `-c` (`bash -e -c`, `bash --norc -c`), a shell after `(`
   (`$(bash -c …)`), and ksh (T-290)".
4. Nothing else changes. Ruling 5 (floor.test.ts) still holds: the added code holds no `8` outside comments.

## New rows (commit 1; new file `open-brain/tests/trigger/t290-parser-followups.test.ts`)

The same two-table shape as `t288-parser-gaps.test.ts` (import `isUnsafeStatusRead`, `deriveQuery`):

- **UNSAFE** (`isUnsafeStatusRead` true and `deriveQuery` = `'"tail" "exit" "code"'`):
  - U9 `"npm test 2>&1 | \\\n  tail -5\necho $?"`
  - U10 `"{ npm test | tail -5; } 2>&1; echo $?"`
  - U11 `"{ npm test | tail -5; } > log.txt; echo $?"`
  - U12 `"bash -e -c 'npm test | tail -5; echo $?'"`
  - U13 `"bash --norc -c 'npm test | tail -5; echo $?'"`
  - U14 `"x=$(bash -c 'npm test | tail -5; echo $?')"`
  - U15 `"ksh -c 'npm test | tail -5; echo $?'"`
- **SAFE** (`isUnsafeStatusRead` false and `deriveQuery` = `""`):
  - S9 `"npm test | \\\n  wc -l\necho $?"` (continuation, no trimmer)
  - S10 `"{ npm test; } 2>&1; echo $?"` (redirected group, no trimmer)
  - S11 `"bash -c 'true' -x 'npm test | tail -5; echo $?'"` (a quoted argument after the script and a flag)
  - S12 `"echo a \\\nb; echo $?"` (a continuation that is not a pipeline)

**Expected at commit 1 (the base, with T-288):** U9-U15 RED; S9-S12 GREEN; every existing row green.

## Existing tests (verdicts)

- `tests/trigger/t288-parser-gaps.test.ts` (U1-U8, S1-S8): **stay green** (pre-checked).
- `tests/trigger/t265-status-read.test.ts`, `t286-status-required.test.ts`, `negatives.test.ts`, `query.test.ts`,
  `floor.test.ts`, `t159-fast-path.test.ts`, `fires.test.ts`, `hook.test.ts`, `no-network.test.ts`,
  `tests/t235-p2-5-cursor-recall.test.ts`, `tests/pipelines/sync/retirements-live.test.ts`,
  `tests/harness/s4-guards.test.ts`: **stay green**. A SAFE row elsewhere that turns UNSAFE: STOP,
  `BLOCKED T-290 <row>` with the command text.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t290-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. Fresh clone into `(Join-Path $env:TEMP "t290-wt")` unless the launcher named one;
   `git checkout -q -b fix/t290-trigger-parser-followups <base>`; `rev-parse HEAD` = base; porcelain empty; the T-288
   check above. `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"` (else `npm rebuild better-sqlite3`).
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
   `npm run test:heavy`, killing any process by name.
3. **Commit 1, `T-290: rows for five more shapes of the $? mistake`:** the new file. `$env:NO_COLOR='1'`; in
   `open-brain`: `npx vitest run tests/trigger/t290-parser-followups.test.ts --no-file-parallelism`. Exactly U9-U15
   red. Paste the summary and the `x` rows as plain text.
4. **Commit 2, `T-290: backslash-newline, a redirected group close, split shell flags, $(sh -c), ksh`:** rulings 1-3.
   Run `npx vitest run tests/trigger tests/t235-p2-5-cursor-recall.test.ts tests/pipelines/sync/retirements-live.test.ts tests/harness/s4-guards.test.ts --no-file-parallelism --testTimeout=180000`
   (all green) and `npx tsc --noEmit` (exit 0). Paste both.
5. End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline <base>..HEAD`
   shows 2 lines; porcelain empty.
6. **Mutants** (query.ts; edit, run the t290 file only, paste the summary and `x` rows, `git checkout -- <file>`,
   porcelain empty; never commit one):
   - **M1:** delete ruling 1's `if (c === "\n") { … continue; }` line. Expect U9 red.
   - **M2:** `!GROUP_CLOSE.test(s.masked)` → `s.masked.trim() !== "}"`. Expect U10, U11 red.
   - **M3:** delete `(\s+--?[A-Za-z][\w-]*)*?` from `INNER_SHELL_C`. Expect U12, U13 red.
   - **M4:** `[\s/\\(]` → `[\s/\\]`. Expect U14 red.
   - **M5:** `(bash|sh|zsh|dash|ksh)` → `(bash|sh|zsh|dash)`. Expect U15 red.
7. `git diff --name-only <base>..HEAD` shows exactly `open-brain/src/trigger/query.ts` and
   `open-brain/tests/trigger/t290-parser-followups.test.ts`.
8. `git push origin fix/t290-trigger-parser-followups` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr create --base master --head fix/t290-trigger-parser-followups --title "T-290: the trigger parser reads five more shapes of the \$? mistake" --body "Brief: docs/loops/t290-trigger-parser-followups-brief.md. Code PR (src): needs a QA ACCEPT and Aaron's word naming it."`;
   `gh pr checks <n> --watch --interval 30` (cap 20 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T-290 <sha40> PR #<n>` or `BLOCKED T-290 <reason>`.
- Then each command with its output. If the code differs from a line this brief quotes, follow the ruling's intent and
  say what differed. Mark anything not run `NOT RUN`. Do not merge.
