# T-159: a not-asked recall-trigger fire costs only the interpreter: no store, no zod; reconciled at SessionEnd and ob_end

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t159-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 168. **Task:** T-159 (P1). **Tag:** `T-159`. **Size:** MEDIUM.
**Base:** `1395fd7559867169b535d1e216a016977f125fa9` (origin/master; its code equals 399121cd). If clark re-pins it at
launch, that SHA wins. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: cli-recall-trigger main runTrigger recordFire handleEnd cli-session-end (covered by tests/trigger/*.test.ts, tests/t235-p2-5-cursor-recall.test.ts, tests/audit-fix-a1-r5*.test.ts, tests/t048-*.test.ts, tests/t003-session-proof.test.ts, tests/server.test.ts)
```

## Why

T-159 (read its note): the PostToolUse recall-trigger hook runs after EVERY Bash/Shell call. 53% of its fires are
not-asked (`deriveQuery` returns `""`): live, 17,564 not-asked of 33,152 fires since 09-21, about 1,160 a day recently.
Each still pays the full load, because `open-brain/src/cli-recall-trigger.ts:42-45` imports better-sqlite3, db-v2, the
policy loader (which pulls in **zod**) and run.js statically, then opens two DB handles just to INSERT one not-asked row.
Planner-researched cost per call (in-process import timing, 6 samples): zod 110-150 ms, policy.js 121-143 ms (with zod),
db-v2 43-61 ms, the better-sqlite3 wrapper 33-46 ms; zod is the largest single cost, not the native binding. The named
fix: write not-asked fires to a cheap append-only file and reconcile them into `trigger_fires` later, so the common case
pays only the interpreter and the three counts stay whole.

## Ruling (exact names; paths under `open-brain/`)

1. **`src/trigger/pending-fires.ts`** (new; imports ONLY `node:fs`, `node:path` and `./command-log.js`):
   `export const PENDING_FIRES_FILE = "recall-trigger-pending.jsonl"`; `export function pendingFiresPath(dbPath: string)`
   = `join(dirname(dbPath), PENDING_FIRES_FILE)` (the hook and the reconcilers derive it this one way; no new env var);
   `export function appendPendingNotAsked(path, { sessionUuid, command }, now: Date)` appends
   `{"session_uuid":…,"created_at":"<toISOString>","command":"<formatCommandFireLog(command)>","state":"not-asked"}\n`
   (the RAW command is never written: AUDIT-FIX A1 r5); `export function parsePendingFireLine(line)`.
2. **The hook** (`src/cli-recall-trigger.ts`): its static imports become node builtins, `deriveQuery` (`trigger/query.ts`
   imports better-sqlite3 as a type only) and `pending-fires.ts`. After the existing session check, and only then:
   `if (deriveQuery(command) === "") { try { appendPendingNotAsked(…) } catch (e) { logFailure("not-asked fire not recorded", e) } return; }`.
   The asked path loads better-sqlite3, db-v2, the policy and run.js with `await import(…)` inside the existing try, and
   the deadline clock (`started`) starts AFTER those imports (today's semantics). The human-facing failure log
   (`recall-trigger.log`) is unchanged and never receives fire lines. `run.ts` keeps its not-asked branch (other callers
   and tests use it); correct its header comment.
3. **`reconcilePendingFires(db, path, opts)`** in `src/trigger/fires.ts` (still the only writer of `trigger_fires`):
   claim the file with `renameSync(path, \`${path}.claim-${process.pid}-${Date.now()}\`)` (the `claimMarker` shape,
   `shared/end-record-guard.ts`); validate each line (exactly the four keys; an ISO time with milliseconds; a canonical
   command per `command-log.ts`; state `not-asked`); insert in ONE `.immediate()` transaction with
   `INSERT … SELECT ?, ?, '', 'not-asked', '[]', ? WHERE NOT EXISTS (same session_uuid, created_at, command, state)`;
   remove a claim file only on a LATER run once it is at least `STALE_CLAIM_MS = 10 * 60 * 1000` old, after a
   de-duplicated re-read (catches a hook that opened the file before the rename); on a DB error append the claimed text
   back (nothing was committed). It reconciles EVERY session's lines (each line carries its own session and time).
   Returns `{ inserted, duplicate, unreadable }`.
4. **Where it runs:**
   - `src/cli-session-end.ts`: a block after the T-003 step and BEFORE the vault exit, guarded by `existsSync(V2_DB)`,
     opening `new Database(V2_DB, { fileMustExist: true })` and running `initTriggerFires` (never `openV2Database`, which
     creates the store). Lines: `[session-end] trigger fires: <n> not-asked fire(s) reconciled (<d> already recorded, <r> unreadable line(s) not reconciled)`,
     `[session-end] trigger fires: nothing pending`, `[session-end] trigger fires NOT RECONCILED: <reason>`.
   - `handleEnd` (`src/server.ts:~361`, `ob_end`), so a Cursor seat (no SessionEnd hook) reconciles at its `/end`: the
     same call, one line in ob_end's output, and a failure there never fails `ob_end`.
5. **Out of scope:** `ob_stats`'s census lag until the next reconcile (say so in the reply), the asked path still paying
   for zod (a follow-up), a schema column for an exact fire key.

## Existing tests (planner-researched; verdicts)

- **Red by design, replace:** `tests/trigger/hook.test.ts:222-232` expects at least 3 not-asked DB rows after hook calls:
  rewrite it as row N3 below (no not-asked DB rows; 3 pending lines).
- Green only if built as ruled: `tests/t235-p2-5-cursor-recall.test.ts:74,84,94` (the session check stays BEFORE the fast
  path); `tests/trigger/fires.test.ts:52,173` and `tests/trigger/no-network.test.ts:133` (`run.ts` keeps its not-asked
  branch); `tests/t003-session-proof.test.ts:305` (the reconcile never creates a store in an absent directory);
  `tests/t048-dropped-counts.test.ts:57` (guard any new field `formatSessionEndLines` reads).
- Stay green: the rest of `hook.test.ts` (`:153 :180 :197 :212 :236 :255 :272 :294 :312`); the secret and scrub tests
  (`audit-fix-a1-r5*`, `r7`, `r8`, `r9`, `t247-pins-scrub`); the session-end rows (`t048-r2b`, `end-fix-*`,
  `t262-part2`, `handoff-guard`, `index-v2`, `t245-idempotent-stages`); `module-boundary`.
- Any other newly failing row: STOP, `BLOCKED T-159 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t159-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t159-wt")`, `Set-Location`
   into it, `git checkout -q -b perf/t159-not-asked-fast-path 1395fd7559867169b535d1e216a016977f125fa9`. HEAD must print
   that SHA and the tree must be clean, else STOP, BLOCKED. `npm ci` in `open-brain`. **Forbidden:** `git stash`,
   `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout, and touching the real store, log or pending
   file (tests use a temp `KNOWLEDGE_V2_DB` and `RECALL_TRIGGER_LOG`).
3. **Base run** (in `open-brain`, 30-minute cap):
   `npx vitest run tests/trigger tests/t235-p2-5-cursor-recall.test.ts tests/audit-fix-a1-r5 tests/t003-session-proof.test.ts tests/t048 tests/end-fix tests/t262-part2.test.ts tests/t245 tests/server.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste the summary and every failing row.
4. **Commit 1, `T-159: tests (red)`.** New file `open-brain/tests/trigger/t159-fast-path.test.ts` (namespace imports):
   - **N1 (the fast path loads nothing):** spawn `process.execPath --require <a load-spy .cjs fixture> --import tsx/esm src/cli-recall-trigger.ts`;
     the spy wraps `process.dlopen` and `module.registerHooks({ resolve })` (Node 22) and writes what loaded on exit.
     Payload `git status --porcelain` with a session id and the store path ABSENT → exit 0, no output, no
     `better_sqlite3.node` load, no resolve of `better-sqlite3`, `zod`, `db-v2` or the policy module, one pending line, no
     store created. Positive control in the same row: G-039's command (`npx vitest run 2>&1 | tail -8; echo $?`) does
     load them. (`require.cache` cannot see ESM imports: do not use it.)
   - **N2:** the secret commands list from `tests/audit-fix-a1-r5*.test.ts` through `appendPendingNotAsked` → every line
     has the four keys, an ISO time with milliseconds, state `not-asked`, and NO secret bytes.
   - **N3 (replaces hook.test.ts:222):** three not-asked calls plus G-039's → 0 not-asked DB rows, at least 1 non-not-asked
     row, exactly 3 pending lines, an empty failure log; a payload without a session writes no line.
   - **N4 (reconcile):** session A ×2, session B ×1, one line with a raw (non-canonical) command, one torn line → 3
     inserted, 2 unreadable; each row keeps its line's `created_at`; `query` is `''`; `injected_ids` is `'[]'`.
   - **N5 (idempotent):** reconciling twice inserts 0 the second time; re-appending the same 3 lines reports 3 duplicates;
     two connections reconciling at once insert 3 in total.
   - **N6 (late writer):** an `opts.afterClaim` hook appends one line to the live file AND one to the claimed file; a
     second run with `opts.now` past `STALE_CLAIM_MS` picks up each late line exactly once and removes the stale claim.
   - **N7 (end to end):** hook calls for a Cursor `Shell` session X ×2 and a Bash session Y ×1, then `cli-session-end`
     for Y with no vault → `3 not-asked fire(s) reconciled`, X has 2 rows and Y 1; a rerun says `nothing pending`; with
     the DB absent no file is created. Plus `handleEnd` for a session with pending lines reconciles them and its output
     carries the line.
   Run the file: all red. Paste it.
5. **Commit 2, `T-159: not-asked fires skip the store and zod; reconciled at SessionEnd and ob_end`:** the ruling, plus
   the `hook.test.ts:222-232` replacement.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline 1395fd75..HEAD`
   shows 2 lines; `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), the t159 file, then step 3's command again. Paste all three. Then
   a timing line: 20 runs each of the BUILT hook (`npm run build` first) on a not-asked payload at base and at HEAD (two
   builds), p50 and p95 wall time, and the interpreter floor (`node -e ""`).
8. **Mutants** (edit, run the t159 file only, paste, `git checkout -- <file>`, clean tree; never commit):
   - M1: a static `better-sqlite3` import restored → N1 red. M2: `loadPolicy` before the not-asked branch → N1 red.
   - M3: the raw command written to the line → N2 red. M4: the fast path before the session check → N3 red.
   - M5: `NOT EXISTS` dropped → N5 red. M6: `unlink(path)` instead of the rename claim → N6 red.
   - M7: the session-end block after the vault exit → N7 red.
9. `git diff --name-only 1395fd75..HEAD` must show only `open-brain/src/cli-recall-trigger.ts`,
   `open-brain/src/trigger/pending-fires.ts`, `open-brain/src/trigger/fires.ts`, `open-brain/src/trigger/run.ts`
   (comment only), `open-brain/src/cli-session-end.ts`, `open-brain/src/server.ts`,
   `open-brain/tests/trigger/t159-fast-path.test.ts`, the load-spy fixture, `open-brain/tests/trigger/hook.test.ts`.
   Anything else: STOP, BLOCKED.
10. `git push origin perf/t159-not-asked-fast-path` (never force); `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr create --base master --head perf/t159-not-asked-fast-path --title "T-159: not-asked recall-trigger fires skip the store and zod; reconciled at SessionEnd and ob_end" --body "Brief: docs/loops/t159-not-asked-fast-path-brief.md."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-159 <sha40> PR #<n>` or `BLOCKED T-159 <reason>`. Then each command with its output: base
run, red run, tsc, the t159 run, the second run, the timing table, the mutants, the name-only diff, `ls-remote` =
`rev-parse`, the PR URL and CI, and the out-of-scope list. At most 2 attempts at a red. Mark anything not run `NOT RUN`.
If the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
