# T-265: the recall trigger's status-read element fires only on a real mistake (D-148's data-named change)

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop one-off (no hub key). It MUST run on the desktop: step 7's replay reads the live DB snapshot and the
transcripts. Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t265-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 168. **Task:** T-265 (P1). **Tag:** `T-265`. **Size:** SMALL-MEDIUM.
**Base:** `50c112d71747648c81912ffb26509b902582178a` (origin/master; its code equals 399121cd). If clark re-pins it at
launch, that SHA wins. **Evidence:** `docs/loops/t264/result.md` and `docs/loops/t264/measure.mjs` (T-264, #648).

```text
IMPACT-TARGETS: deriveQuery ELEMENTS (trigger/query.ts) (callers: queryStore → runTrigger → cli-recall-trigger PostToolUse hook; covered by tests/trigger/*.test.ts, tests/t235-p2-5-cursor-recall.test.ts)
```

## Why

D-148 (Aaron): "no new code unless the data says so". T-264 measured it on 1,025 injected fires: every one injected entry
299 (`pipe-to-tail-masks-exit-code`), and only **6.4%** landed on a real mistake. 85% landed on commands that already
read `PIPESTATUS` (171) or captured the status from a different statement (693). Where the mistake was real, the next
similar command used `PIPESTATUS` 84% of the time (26/31, against 2/7 uninjected). So the injection works when warranted
and is mostly unwarranted. The cause is in `open-brain/src/trigger/query.ts:110-117`: the status-read element fires on
`/\$\?|\$\{?PIPESTATUS/` ANYWHERE in the command, by design ("only the first is a mistake, and the entry that explains
the difference is the one worth surfacing for either"). The data now overrules that comment.

## Ruling (exact; paths under `open-brain/`)

1. **`src/trigger/query.ts`, the status-read element only.** Its `what` becomes `"a $? read of a pipeline whose last stage
   is a trimmer"`, its `terms` stay `["exit", "code"]`, and its `test` becomes `isUnsafeStatusRead(command)`, a new exported
   pure function in the same file. It is true exactly when the command reads `$?` (or `${?}`) as the status of a
   pipeline whose last stage is a trimmer (`TRIMMERS`: tail, head, grep): the statement that `$?` follows (after `;`,
   `&&`, `||` or a newline) is such a pipeline, and `set -o pipefail` is not in effect earlier in the command.
   - **Never** on a `PIPESTATUS` read, on `$?` after a non-pipeline statement (`tail -f x; echo $?`), or on `$?` captured
     from a different statement (`node b.js; rc=$?; git log | head -3`).
   - **Inert text:** the body of a heredoc (`<<EOF … EOF`, `<<'EOF'`, `<<-EOF`) and a single-quoted string are not
     shell to this test. ONE exception: the single-quoted argument of `ssh <host> '…'` IS the remote shell, so it is
     tested as a command (`ssh h 'npm test | tail -5; echo rc=$?'` is unsafe).
   - Port the semantics of T-264's VIOLATING classifier (`docs/loops/t264/measure.mjs`, its self-check's 13 cases), so
     the trigger and the measurement agree. Do not import from `docs/`.
2. **The trimmer element and everything else stay as they are.** `deriveQuery` still ANDs the terms of every element
   that matches; `queryStore`, the floor and the policy do not change.
3. Rewrite the comment above the element to cite T-264's numbers and this ruling.

## Existing tests (planner-read; verdicts)

- `tests/trigger/negatives.test.ts:69` (inside "[mine] a trimmer that is NOT a pipeline stage does not make the shape"):
  `deriveQuery('tail -f build.log; echo $?')` is pinned to `'"exit" "code"'`. Under the ruling the status is the
  command's own (no pipeline), so it becomes `''`. **Update that one expectation and its comment.**
- Stay green: `negatives.test.ts:70` (`tail -f build.log` → `''`), `:74` (`npm run build 2>&1 | tail -5; echo $?` →
  `'"tail" "exit" "code"'`), `:52-59`, `:77-95`; `no-network.test.ts:143` (G-039's command → `'"tail" "exit" "code"'`);
  `query.test.ts` (fixture command G-039's); `hook.test.ts`, `fires.test.ts`, `floor.test.ts`,
  `t235-p2-5-cursor-recall.test.ts` (their commands are the G-039 shape; confirm each in step 3's run).
- Any other newly failing row: STOP, `BLOCKED T-265 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t265-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t265-wt")`, `Set-Location`
   into it, `git checkout -q -b fix/t265-trigger-precision 50c112d71747648c81912ffb26509b902582178a`. HEAD must print that
   SHA and the tree must be clean, else STOP, BLOCKED. `npm ci` in `open-brain`. **Forbidden:** `git stash`,
   `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout, writing the live DB.
3. **Base run** (in `open-brain`): `npx vitest run tests/trigger tests/t235-p2-5-cursor-recall.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste the summary and every failing row.
4. **Commit 1, `T-265: tests (red)`.** New file `open-brain/tests/trigger/t265-status-read.test.ts` (namespace import of
   `query.js`). One table row per case, each asserting `isUnsafeStatusRead` AND the resulting `deriveQuery`:
   - unsafe (`'"tail" "exit" "code"'` or `'"exit" "code"'` as the trimmer element decides): `npm run build 2>&1 | tail -5; echo $?`;
     `npx vitest run | tail -8 && echo $?`; `cmd | grep x` + newline + `echo $?`; `ssh h 'npm test | tail -5; echo rc=$?'`;
     `(make | tail -3); echo $?`.
   - safe (the status element does not fire): `npm test | tail -5; echo "${PIPESTATUS[0]}"`;
     `ssh h 'npm test | tail -5; echo ${PIPESTATUS[0]}'`; `node b.js; rc=$?; git log | head -3`;
     `set -o pipefail; npm test | tail -5; echo $?`; `tail -f build.log; echo $?`; `echo '$?' | tail -1`;
     `grep 'a|b' f; echo $?`; a heredoc whose BODY holds `x | tail -1; echo $?` (`cat > f <<'EOF'` … `EOF`).
   Run the file: the safe rows that fire today are red; paste it.
5. **Commit 2, `T-265: the trigger's status-read element fires only on a $? read of a trimmed pipeline`:** the ruling,
   plus the one `negatives.test.ts:69` expectation.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline 50c112d7..HEAD`
   shows 2 lines; `git status --porcelain` is empty.
7. **Replay on the real data (read-only; aggregates only in the reply; nothing committed from it).** Snapshot the live
   DB exactly as T-264 did (`readonly`, `fileMustExist`, `db.backup` into `%TEMP%\t265-replay\`). Reuse T-264's anchor
   extraction (`docs/loops/t264/measure.mjs`, run from this clone) to list, for every INJECTED fire in the snapshot, its
   anchor command and T-264's class (COMPLIANT / VIOLATING / NOT_APPLICABLE). For each anchor, run
   `queryStore({ db: <snapshot>, command, floor: <the shipped policy floor>, limit: <shipped max> })` with the OLD and the
   NEW `deriveQuery` (old = base build, new = this branch) and report a table: per class, how many would inject under old
   and under new. **Acceptance:** every VIOLATING anchor still injects under new (list any that does not, with its class
   reason); COMPLIANT injections fall by at least 80%. Report precision (VIOLATING / injected) old vs new with Wilson 95%
   intervals. Print commands nowhere: counts only.
8. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), the t265 file, then step 3's command again. Paste all three.
9. **Mutants** (edit, run the t265 file only, paste, `git checkout -- <file>`, clean tree; never commit):
   - M1: the old regex back in the test → the safe rows red.
   - M2: heredoc bodies not stripped → the heredoc row red.
   - M3: the ssh exception removed → the ssh unsafe row red.
   - M4: `pipefail` ignored → the pipefail row red.
10. `git diff --name-only 50c112d7..HEAD` must show only `open-brain/src/trigger/query.ts`,
    `open-brain/tests/trigger/t265-status-read.test.ts`, `open-brain/tests/trigger/negatives.test.ts`. Anything else:
    STOP, BLOCKED.
11. `git push origin fix/t265-trigger-precision` (never force); `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr create --base master --head fix/t265-trigger-precision --title "T-265: the recall trigger's status-read element fires only on a \$? read of a trimmed pipeline" --body "Brief: docs/loops/t265-trigger-precision-brief.md. Evidence: docs/loops/t264/result.md."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-265 <sha40> PR #<n>` or `BLOCKED T-265 <reason>`. Then each command with its output: base
run, red run, tsc, the t265 run, the second run, the replay table with the acceptance verdict, the mutants, the
name-only diff, `ls-remote` = `rev-parse`, the PR URL and CI. At most 2 attempts at a red. Mark anything not run
`NOT RUN`. If the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not
merge.
