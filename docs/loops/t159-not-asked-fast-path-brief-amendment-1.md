# T-159 amendment 1: the safety paths get their tests, and only ENOENT means nothing pending

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code only. Ends at READY with PR #678 updated, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t159-r2-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-159 (P1). **Tag:** `T-159`. **Size:** SMALL.
**Branch:** `perf/t159-not-asked-fast-path` at `689df661d11a6f5269cabd041b2d5828f9e426d0` (PR #678). If clark re-pins it
at launch, that SHA wins. **The brief's rulings stand:** `docs/loops/t159-not-asked-fast-path-brief.md`.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: reconcilePendingFires parsePendingFireLine (open-brain/src/trigger/fires.ts, open-brain/src/trigger/pending-fires.ts; callers: cli-session-end.ts, handleEnd in server.ts; covered by tests/trigger/t159-fast-path.test.ts, tests/trigger/hook.test.ts, tests/t048-dropped-counts.test.ts)
```

## Why

The Opus second review of round 1 (`t159-review-reply.md`, VERDICT ACCEPT, at 689df661) found no defect against the
ruling. It did find that the mechanisms which keep a not-asked fire from being lost or consumed early are untested:
seven mutants of the changed src survive the t159 file (S1-S7). **S1 removes the 10-minute staleness gate**, and the
next reconcile (ob_end, then SessionEnd seconds later) unlinks a claim a late hook may still append to. N6's second run
passes a `now` that is already past the stale age, so nothing runs the real clock against a fresh claim (planner-read
at 689df661). S5 lets a dry-run `ob_end` consume the pending file. F3: every `renameSync` error, including EPERM and
EBUSY, prints "nothing pending" while lines wait (the reviewer showed it live with a handle that lacks FILE_SHARE_DELETE).
The hook runs after every Bash call in every seat, so these get tests before the merge. F1 (two fires of the same
program in the same millisecond become one row) is the ruled cost of the de-dup key and stays as it is.

## Ruling (exact; paths under `open-brain/`)

1. **`src/trigger/fires.ts`, `reconcilePendingFires`:**
   a. The claim's `renameSync` failure means "nothing pending" ONLY when its code is `ENOENT`. Any other error is
      rethrown, so SessionEnd and `ob_end` print their existing `trigger fires NOT RECONCILED: <message>` line. Correct
      the comment beside it.
   b. Add `rename?: (from: string, to: string) => void` to `ReconcileOptions` (a test seam beside `afterClaim`,
      defaulting to `renameSync`), used for the claim only.
2. **`src/cli-recall-trigger.ts`:** comment only. The deadline-clock comment says the clock now also leaves out the
   stdin read, the payload parse and `loadPolicy` (the review's item 8). No code change.
3. **`tests/trigger/t159-fast-path.test.ts`**, new rows (namespace imports, as in round 1):
   - **N6b (kills S1):** right after a first reconcile that keeps a claim, a second reconcile with NO `now` keeps the
     claim file (`existsSync(claimedPath)` is true) and inserts 0.
   - **N6c (kills S2):** N6's stale re-read reports `duplicate: 0` and `unreadable: 0` beside its inserts.
   - **N8 (kills S4):** a store whose `trigger_fires` has
     `CREATE TRIGGER t159_abort BEFORE INSERT ON trigger_fires BEGIN SELECT RAISE(ABORT, 'induced'); END;`.
     The reconcile throws; the live file holds the claimed lines again; the claim file is kept; no row is written.
   - **N9 (kills S5):** `handleEnd` with `dry_run: true` and pending lines: the pending file is byte for byte
     unchanged, no not-asked row is written, and the output carries `trigger fires: not reconciled (dry run)`.
   - **N10 (kills S6 and S7):** `parsePendingFireLine` returns null for a time without milliseconds
     (`2026-10-13T12:00:00Z`) and for an otherwise valid line with a fifth key.
   - **N11 (kills F3's old catch-all):** with `opts.rename` throwing an error whose `code` is `EPERM`, the reconcile
     throws, and the live file is unchanged. With `code` `ENOENT`, it returns all zeros.
   - **N7c (the SessionEnd catch):** N7's setup with the store carrying N8's trigger: SessionEnd exits 0, prints
     `[session-end] trigger fires NOT RECONCILED: ` and still prints the SessionEnd line that follows the block in N7's
     no-vault run (name it in the reply).
   - **N1b:** in N1's not-asked run, every specifier the spy recorded resolves to a `node:` builtin or to one of
     `cli-recall-trigger.ts`, `trigger/query.ts`, `trigger/pending-fires.ts` and `trigger/command-log.ts` (the
     review's item 1a). The positive control stays.
4. **Out of scope, unchanged:** F1 and the de-dup key; `formatReconcileLine`'s wording; the asked path's zod cost.

## Existing tests (planner-read at 689df661; verdicts)

- The 8 round-1 rows of `t159-fast-path.test.ts` and `hook.test.ts` (12 rows): **stay green.**
- `tests/t048-dropped-counts.test.ts:58,60` match ob_end's text with `toContain`: **stay green.**
- No file this amendment touches appears in `.agents/retirements.json`; keep `retirements-live.test.ts` in the runs
  anyway (it caught T-243 and T-022 in CI).
- Any other newly failing row: STOP, `BLOCKED T-159 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t159-r2-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.** Work in the fresh clone the launcher named. If it named none, run
   `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t159-r2-wt")` and
   `Set-Location` into it. Then `git checkout -q -b perf/t159-not-asked-fast-path origin/perf/t159-not-asked-fast-path`.
   `git rev-parse HEAD` must print `689df661d11a6f5269cabd041b2d5828f9e426d0` and `git status --porcelain` must be
   empty, else STOP, BLOCKED. Run `npm ci` in `open-brain`. Every test run uses a temp HOME, USERPROFILE,
   KNOWLEDGE_V2_DB and RECALL_TRIGGER_LOG. **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, merge,
   `cd` into any other checkout, `npm run test:heavy`, and touching the real store, log or pending file.
3. **Commit 1, `T-159 r2: tests (red)`:** the rows of ruling 3. Run the t159 file: N6b, N8, N11 (EPERM half) and N7c
   red (and N11's seam row may fail to compile its option until commit 2: say so); N6c, N9, N10 and N1b green (they
   pin today's correct behaviour against the mutants in step 7). Paste it.
4. **Commit 2, `T-159 r2: only ENOENT means nothing pending; the reconcile takes a rename seam`:** rulings 1 and 2.
5. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline 689df661..HEAD` shows 2 lines; `git status --porcelain` is empty.
6. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0); the t159 file (all green); then
   `npx vitest run tests/trigger tests/t235-p2-5-cursor-recall.test.ts tests/t048 tests/server.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste all three.
7. **Mutants** (edit, run the t159 file only, paste, `git checkout -- <file>`, clean tree; never commit). Each must
   turn the named row red:
   - S1 `fires.ts`: the staleness condition dropped (`if (!m) continue;`) → N6b.
   - S2 `apply(s.text, false)` → `apply(s.text, true)` → N6c.
   - S4 the append-back in the catch replaced by `void 0;` → N8.
   - S5 `server.ts`: `if (args.dry_run) {` → `if (false) {` → N9.
   - S6 the `ISO_MS_RE` test dropped → N10. S7 the exact-keys check dropped → N10.
   - S8 the ENOENT check dropped (every rename error is "nothing pending" again) → N11.
   - S9 a static `import "../db-v2.js"` added to `pending-fires.ts` → N1b (and N1).
8. `git diff --name-only 689df661..HEAD` must show only `open-brain/src/trigger/fires.ts`,
   `open-brain/src/cli-recall-trigger.ts` and `open-brain/tests/trigger/t159-fast-path.test.ts`. Anything else: STOP,
   BLOCKED.
9. `git push origin perf/t159-not-asked-fast-path` (never force). `ls-remote` must equal `rev-parse HEAD`. Wait for CI
   (`gh pr checks 678 --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-159 <sha40> PR #678` or `BLOCKED T-159 <reason>`. Then each command with its output: the red
run, tsc, the t159 run, step 6's run, the mutants, the name-only diff, `ls-remote` = `rev-parse`, and CI. **Paste test
output with `grep -a`, or without grep** (T-270's reply lost its mutant evidence to "Binary file matches"). At most 2
attempts at a red. Mark anything not run `NOT RUN`. If the code differs from a line this amendment quotes, follow the
ruling's intent and say what differed. Do not merge.
