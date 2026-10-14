# T-288: the recall trigger's parser reads three more shapes of the `$?` mistake

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t288-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-288 (P3). **Tag:** `T-288`. **Size:** SMALL-MEDIUM.
**Base:** the dispatch SHA clark names; it must contain #712's merge `8618099e` (T-286; check with
`git merge-base --is-ancestor 8618099e <base>`, else BLOCKED). If clark names none, `origin/master` after the fetch.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: splitStatements scriptHasUnsafeRead isUnsafeStatusRead deriveQuery (open-brain/src/trigger/query.ts; the live PostToolUse recall trigger; covered by tests/trigger/*.test.ts)
```

## Why

T-286's Opus second review (ACCEPT at 5f1c5412, `~/Worktrees/t286-review-reply.md`, outside the repo), F2. Since T-286,
the trigger asks only when `isUnsafeStatusRead` holds, and three literal `$?`-after-a-trimmer shapes are missed by
parser gaps in `open-brain/src/trigger/query.ts`, so they now ask NOTHING:
1. **A trailing `|` continues the line:** `npm test 2>&1 |\n  tail -5\necho $?`. `splitStatements` flushes on every
   newline, even right after a `|`, so `tail -5` becomes a one-stage statement and the `$?` follows a non-pipeline.
2. **A `{ ...; }` group:** `{ npm test | tail -5; }; echo $?`. The `}` is flushed as its own statement between the
   pipeline and the `$?`. A group's status IS its last command's status, so the `}` should be transparent, as `( ... )`
   already is.
3. **An inner shell's script:** `bash -c 'npm test | tail -5; echo $?'` (also `bash -lc`, `wsl bash -c`,
   `docker exec app sh -c`). Only `ssh`'s single-quoted argument is read as a script; every other single-quoted string
   is inert.

Out of scope, and named so: `cmd | tail -5 && echo ok` and `if cmd | tail -5; then` (the status is masked with no `$?`
text: outside T-264's class by definition); PowerShell `$?`/`$LASTEXITCODE`; and `docs/loops/t264/measure.mjs`'s own
classifier (a later re-measure updates it, as T-286's note says of floor.mjs).

## Ruling (exact; `open-brain/src/trigger/query.ts` only for src)

1. **The newline after a dangling `|` is whitespace.** In `splitStatements`'s loop, directly BEFORE the line
   `if (c === ";" || c === "\n") { flush(); continue; }`, add:
   ```ts
       // T-288: a newline right after an unquoted `|` continues the pipeline (sh reads `cmd |\n tail` as one pipeline).
       if (c === "\n" && stages.length > 1 && stages[stages.length - 1].trim() === "") { add(" "); continue; }
   ```
2. **A lone `}` is transparent.** Replace `scriptHasUnsafeRead` with:
   ```ts
   // T-288: a statement that is only `}` closes a `{ ...; }` group, whose status is its last command's: skip it, as a
   // `( ... )` subshell is already transparent.
   const scriptHasUnsafeRead = (all: readonly Statement[]): boolean => {
     const stmts = all.filter((s) => s.masked.trim() !== "}");
     return stmts.some(
       (s, i) =>
         i > 0 &&
         /\$\?|\$\{\?\}/.test(s.masked) &&
         isTrimmerPipeline(stmts[i - 1]) &&
         !stmts.slice(0, i).some((p) => /\bpipefail\b/.test(p.masked)),
     );
   };
   ```
3. **`bash`/`sh`/`zsh`/`dash` `-c '...'` is a script, like `ssh '...'`.**
   - Add, above `splitStatements`:
     ```ts
     /** T-288: the text before a single quote ends in an inner shell's `-c` (bash -c, bash -lc, wsl bash -c, docker exec app sh -c). */
     const INNER_SHELL_C = /(^|[\s/\\])(bash|sh|zsh|dash)(\.exe)?\s+-[A-Za-z]*c[A-Za-z]*\s*$/i;
     ```
   - In `splitStatements`, declare `let sqStart = 0;` beside `sqBuf`. Where a single quote OPENS
     (`if (c === "'") { sq = true; sqBuf = ""; add(c); continue; }`), set `sqStart = stages[stages.length - 1].length;`
     BEFORE `add(c)`.
   - Where it CLOSES, replace
     `if (stageProgram(stages[stages.length - 1]) === "ssh") remote.push(sqBuf);` with:
     ```ts
         const stage = stages[stages.length - 1];
         if (stageProgram(stage) === "ssh" || INNER_SHELL_C.test(stage.slice(0, sqStart))) remote.push(sqBuf);
     ```
   - Update `splitStatements`' doc comment: "The single-quoted argument of `ssh`, or of an inner shell's `-c`
     (T-288), is returned in `remote`". Update `isUnsafeStatusRead`'s doc comment the same way ("except the
     single-quoted argument of `ssh` or of `bash/sh -c`").
4. Nothing else changes: `deriveQuery`, `ELEMENTS`, the policy file, the floor. **Ruling 5 (floor.test.ts) still
   holds:** the code you add must contain no `8` outside comments (the added regex and code have none).

## New rows (commit 1; new file `open-brain/tests/trigger/t288-parser-gaps.test.ts`)

Import `isUnsafeStatusRead` and `deriveQuery` from `../../src/trigger/query.js`. Two `it.each` tables:

- **UNSAFE** (each: `isUnsafeStatusRead(cmd)` is `true` and `deriveQuery(cmd)` is `'"tail" "exit" "code"'`):
  - `"npm test 2>&1 |\n  tail -5\necho $?"` (U1)
  - `"npm test |\ntail -5; echo $?"` (U2)
  - `"{ npm test | tail -5; }; echo $?"` (U3)
  - `"{ npm test | tail -5; } && echo \"rc=$?\""` (U4)
  - `"bash -c 'npm test | tail -5; echo $?'"` (U5)
  - `"bash -lc 'npm test | tail -5; echo $?'"` (U6)
  - `"wsl bash -c 'npm test | tail -5; echo $?'"` (U7)
  - `"docker exec app sh -c 'npm test | tail -5; echo $?'"` (U8)
- **SAFE** (each: `isUnsafeStatusRead(cmd)` is `false` and `deriveQuery(cmd)` is `""`):
  - `"npm test |\ntail -5"` (S1: no `$?`)
  - `"{ npm test; }; echo $?"` (S2: no trimmer)
  - `"bash -c 'npm test; echo $?'"` (S3: no trimmer)
  - `"echo 'npm test | tail -5; echo $?'"` (S4: a plain quoted string stays inert)
  - `"bash -c 'set -o pipefail; npm test | tail -5; echo $?'"` (S5: pipefail inside the inner script)
  - `"grep -c 'x | tail; echo $?' f.txt"` (S6: `grep -c` is not an inner shell)
  - `"printf '%s\\n' a |\n  wc -l"` (S7: continuation without a trimmer)

**Expected at commit 1 (the base src):** U1-U8 RED. S1-S7 GREEN. Every existing row green. Any other outcome: STOP,
BLOCKED, pasting the rows.

## Existing tests (verdicts)

- `tests/trigger/t265-status-read.test.ts`, `t286-status-required.test.ts`, `negatives.test.ts`, `query.test.ts`,
  `floor.test.ts`, `t159-fast-path.test.ts`, `fires.test.ts`, `hook.test.ts`, `no-network.test.ts`: **stay green**.
  A SAFE row elsewhere that turns UNSAFE under rulings 1-3 is a real conflict: STOP, `BLOCKED T-288 <row>` with the
  command text; the planner rules on it.
- `tests/t235-p2-5-cursor-recall.test.ts`, `tests/pipelines/sync/retirements-live.test.ts`,
  `tests/harness/s4-guards.test.ts`: **stay green**.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t288-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. **Start state.** Fresh clone into `(Join-Path $env:TEMP "t288-wt")` unless the launcher named one;
   `git checkout -q -b fix/t288-trigger-parser-gaps <base>`; `rev-parse HEAD` = base; porcelain empty; the ancestor
   check. `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"` (else `npm rebuild better-sqlite3`).
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
   `npm run test:heavy`, killing any process by name.
3. **Commit 1, `T-288: rows for three missed shapes of the $? mistake`:** the new file. In `open-brain`:
   `npx vitest run tests/trigger/t288-parser-gaps.test.ts --no-file-parallelism --testTimeout=180000`. Exactly U1-U8
   red. Paste.
4. **Commit 2, `T-288: a dangling | continues, a lone } is transparent, bash/sh -c is a script`:** rulings 1-3. Run
   `npx vitest run tests/trigger tests/t235-p2-5-cursor-recall.test.ts tests/pipelines/sync/retirements-live.test.ts tests/harness/s4-guards.test.ts --no-file-parallelism --testTimeout=180000`
   (all green) and `npx tsc --noEmit` (exit 0). Paste both.
5. End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline <base>..HEAD`
   shows 2 lines; porcelain empty.
6. **Mutants** (query.ts; edit, run the t288 file only, paste failing rows, `git checkout -- <file>`, porcelain empty):
   - **M1:** delete ruling 1's line. Expect U1, U2 red.
   - **M2:** in `scriptHasUnsafeRead`, `all.filter((s) => s.masked.trim() !== "}")` → `all`. Expect U3, U4 red.
   - **M3:** `|| INNER_SHELL_C.test(stage.slice(0, sqStart))` deleted. Expect U5-U8 red.
   - **M4:** `INNER_SHELL_C`'s `\s*$` → `\s*` (unanchored). Paste what goes red (S6 or S4 is expected to).
   - **M5:** ruling 1's `stages.length > 1 &&` deleted. Expect S7 or another SAFE row to stay green; paste the result
     and say whether any row goes red (a newline after an empty first stage must still end a statement).
7. `git diff --name-only <base>..HEAD` shows exactly `open-brain/src/trigger/query.ts` and
   `open-brain/tests/trigger/t288-parser-gaps.test.ts`.
8. `git push origin fix/t288-trigger-parser-gaps` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr create --base master --head fix/t288-trigger-parser-gaps --title "T-288: the recall trigger reads three more shapes of the \$? mistake" --body "Brief: docs/loops/t288-trigger-parser-gaps-brief.md. Code PR (src): needs a QA ACCEPT and Aaron's word naming it."`;
   `gh pr checks <n> --watch --interval 30` (cap 20 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T-288 <sha40> PR #<n>` or `BLOCKED T-288 <reason>`.
- Then each command with its output. If the code differs from a line this brief quotes, follow the ruling's intent and
  say what differed. Mark anything not run `NOT RUN`. Do not merge.
