# T-258: doubled-hook residuals — work-after-end dedupe, atomic notice takes, a lock on the invocation log

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key). Code only. Overnight-safe: ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t258-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-12, session 168. **Task:** T-258 (P3). **Tag:** `T-258`. **Size:** SMALL.
**Base:** `10034c5a0328c6a2e44057290ff66ea0edcd4121` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: recordWorkAfterEnd takeRecordOkNotices takeSkillsAuditNotices takeWorkAfterEndNotices takeMissingHandoffNotices logInvocations
```

The SessionStart/SessionEnd hook paths call these, so expect HIGH impact. The reply names each HIGH/CRITICAL target
and the test file below that covers its callers.

## Why (from grok-sia-review's idempotency audit, planner-checked at base)

- **F1** `open-brain/src/shared/end-record-guard.ts:586` `recordWorkAfterEnd` appends with no read first. A doubled
  SessionEnd that reaches it writes two identical lines, and the next greeting shows `WORK AFTER /end` twice.
  `recordSkillsAuditNotice` (same file, line ~531) already reads before it appends; F1 copies that.
- **F5** `takeRecordOkNotices` (:504), `takeSkillsAuditNotices` (:550), `takeWorkAfterEndNotices` (:604) and
  `takeMissingHandoffNotices` (`open-brain/src/shared/handoff-guard.ts:233`) each read, then unlink. Two overlapping
  SessionStarts can both read before either unlinks, so both greetings print the same notices.
- **F6** `logInvocations` (`open-brain/src/pipelines/session-end/invocation-logger.ts:105`) dedupes by reading the log
  and then appending. Two overlapping SessionEnds both read before either appends, and the rows are written twice.

## Ruling (exact code)

**F1.** In `recordWorkAfterEnd`, after `const path = …` and before `appendFileSync`, add a read: if `existsSync(path)`,
for each non-blank line, `JSON.parse` it inside a try (an unreadable line names nothing); if its `session === sessionId`
AND its `message === message`, `return`. Keyed on BOTH: the same session closing again later with more work writes a new
message and must still be recorded. Comment: `// T-258 F1: a doubled SessionEnd writes the same line once.`

**F5.** In `end-record-guard.ts`, export a helper (add `renameSync` to the `node:fs` import):

```ts
/**
 * T-258 F5: take a marker file atomically. The rename succeeds for exactly one caller; an overlapping
 * SessionStart gets null and prints nothing. The caller reads and unlinks the returned path.
 */
export function claimMarker(path: string): string | null {
  const claimed = `${path}.claim-${process.pid}-${Date.now()}`;
  try {
    renameSync(path, claimed);
    return claimed;
  } catch {
    return null;
  }
}
```

In each of the three `take*Notices` in `end-record-guard.ts`: replace `if (!existsSync(path)) return [];` with
`const claimed = claimMarker(path); if (claimed === null) return [];`, read `claimed` instead of `path`, and
`unlinkSync(claimed)` instead of `unlinkSync(path)`. Everything else (the parse loop, the unreadable-line text,
`appendEndRecordShownCapped`) stays. In `takeMissingHandoffNotices`, import `claimMarker` from `./end-record-guard.js`
(the file already imports from there) and do the same for `legacyPath` and for `storePath`, each on its own.

**F6.** In `invocation-logger.ts`:
- add `lockedOut?: true;` to `InvocationLogResult` with the doc line
  `/** T-258 F6: another SessionEnd held the log lock; nothing was read or written. */`;
- add `const LOCK_STALE_MS = 10 * 60_000;` near the top;
- in `logInvocations`, after the `existsSync(sessionsDbDir)` early return, acquire `const lockPath = `${logPath}.lock`;`
  with `openSync(lockPath, "wx")`. On an error whose `code` is `EEXIST`: if
  `Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS`, `unlinkSync(lockPath)` and try `openSync(lockPath, "wx")`
  ONCE more; otherwise (or if the retry also fails with EEXIST) return
  `{ logged: 0, skippedSessions: 0, unreadableSessions: 0, appendFailures: 0, lockedOut: true }`. On ANY OTHER open error
  proceed WITHOUT a lock (the T-048 row passes a log path in a missing directory and expects the append failures to be
  counted, not a lock-out). Wrap the rest of the function in `try { … } finally { … }` where the finally, only if a lock
  fd was taken, calls `closeSync(fd)` and `unlinkSync(lockPath)` (each in its own try/catch).
- `src/pipelines/session-end/index-v2.ts` is NOT edited.

## Existing tests that pin this behaviour (planner-read, with verdicts)

- `tests/end-fix-q4.test.ts`, `tests/end-fix-q6.test.ts`, `tests/end-fix-q12.test.ts`: write and take the
  work-after-end and record-ok markers through the real hook. **Green, unedited**; a take still empties the marker and
  still appends to the `.shown` store.
- `tests/shared/handoff-guard.test.ts`: takes missing-handoff notices from the store and the legacy path. **Green, unedited.**
- `tests/t262-part2.test.ts`: `takeSkillsAuditNotices` rows. **Green, unedited.**
- `tests/t048-dropped-counts.test.ts`: `logInvocations(dir, log)` counts, and a log path under `no-such-dir` counts
  append failures. **Green, unedited** (the non-EEXIST branch above exists for it).

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t258-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. Fresh clone `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t258-wt")`,
   `Set-Location` into it, `git checkout -q -b fix/t258-notice-races 10034c5a0328c6a2e44057290ff66ea0edcd4121`.
   `git rev-parse HEAD` must print that SHA, `git status --porcelain` empty, else STOP, BLOCKED. `npm ci` in `open-brain`.
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout.
3. **Commit 1, `T-258: tests (red)`.** A new file `open-brain/tests/t258-notice-races.test.ts`. `beforeEach`: a temp
   project dir and `process.env.KNOWLEDGE_V2_DB = join(<temp>, "knowledge-v2.db")` (restore the old value in
   `afterEach`), so nothing touches the real `~/.claude`. The marker paths are
   `join(endRecordProjectDir(proj), "<name>")` (import `endRecordProjectDir` from `../src/shared/end-record-store.js`).
   - **R1 (F1):** `recordWorkAfterEnd(proj, "s1", "m", work)` twice (with `const work: SessionWorkScan = { status: "ok", since: null, branches: [], commits: 1, commitShas: [], tags: [], versionBump: false, unattributed: 0 }`;
     if tsc reports a missing field, add it with an empty value and say so) → `.work-after-end.jsonl` has exactly 1 non-blank line.
   - **R2 (F1):** `recordWorkAfterEnd(proj, "s1", "m1", work)` then `(…, "s1", "m2", work)` → 2 lines.
   - **R3 (F5):** write `.work-after-end.jsonl` with one valid line; `claimMarker(path)` returns a string and `path` no
     longer exists; a second `claimMarker(path)` returns `null`.
   - **R4 (F5):** with one marker line in each of `.record-ok.jsonl`, `.skills-audit-unaudited.jsonl` and
     `.work-after-end.jsonl`, the first `take…` of each returns 1 message, the second returns `[]`, and no file whose
     name contains `.claim-` is left in the store directory.
   - **R5 (F6):** an EMPTY existing sessions dir (`mkdtempSync`) and a log path `join(tmp, "inv.jsonl")`. Create `inv.jsonl.lock` (fresh) → `logInvocations(dir, log).lockedOut`
     is `true` and the lock file still exists.
   - **R6 (F6):** the same lock file with `utimesSync` set 11 minutes in the past → `lockedOut` is `undefined` and the
     lock file is gone afterwards.
   - **R7 (F6):** no lock file → `lockedOut` is `undefined` and no `inv.jsonl.lock` remains.
   `claimMarker` does not exist before commit 2, and a missing named import fails the WHOLE file. So import the module
   as a namespace (`import * as guard from "../src/shared/end-record-guard.js"`) and call
   `(guard as unknown as { claimMarker: (p: string) => string | null }).claimMarker(path)` in R3. Run the file:
   R1, R3, R5 and R6 are red; R2, R4 and R7 may be green. Paste it.
4. **Commit 2, `T-258: work-after-end writes once per session and message; notice takes claim atomically; the invocation log is locked`:**
   the ruling.
5. End both messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Afterwards
   `git log --oneline 10034c5a..HEAD` shows 2 lines and `git status --porcelain` is empty.
6. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), then
   `npx vitest run tests/t258-notice-races.test.ts tests/end-fix-q4.test.ts tests/end-fix-q6.test.ts tests/end-fix-q12.test.ts tests/shared/handoff-guard.test.ts tests/t262-part2.test.ts tests/t048-dropped-counts.test.ts --no-file-parallelism --testTimeout=180000`
   with a 20-minute cap. All green.
7. **Mutants** (edit, rerun the t258 file only, paste, `git checkout -- <file>`, confirm a clean tree; never commit):
   - M1: remove the F1 read in `recordWorkAfterEnd` → R1 red.
   - M2: key F1 on `session` only → R2 red.
   - M3: in `claimMarker`, replace `renameSync(path, claimed)` with `copyFileSync(path, claimed)` → R3 red.
   - M4: in `logInvocations`, treat EEXIST as "proceed without lock" → R5 red.
   - M5: delete the stale-lock branch → R6 red.
8. `git diff --name-only 10034c5a..HEAD` must show exactly `open-brain/src/pipelines/session-end/invocation-logger.ts`,
   `open-brain/src/shared/end-record-guard.ts`, `open-brain/src/shared/handoff-guard.ts` and
   `open-brain/tests/t258-notice-races.test.ts`. Anything else: STOP, BLOCKED.
9. `git push origin fix/t258-notice-races` (never force). `git ls-remote origin refs/heads/fix/t258-notice-races` must
   equal `git rev-parse HEAD`. Then
   `gh pr create --base master --head fix/t258-notice-races --title "T-258: doubled-hook residuals (work-after-end dedupe, atomic takes, invocation-log lock)" --body "Brief: docs/loops/t258-notice-races-brief.md."`.
   Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Known red on the desktop

`tests/cli-flags*.test.ts` R185-8 and `tests/harness/config-channel.test.ts` CA-4c are environmental; do not run them.
Do not run the full suite. No test may sleep more than 2 s (use `utimesSync` for ages, never a real wait).

## Reply

The first line is `READY T-258 <sha40> PR #<n>` or `BLOCKED T-258 <reason>`. Then each command with its output,
including the IMPACT result per target. At most 2 attempts at a red. Mark anything not run `NOT RUN`. Do not merge.
