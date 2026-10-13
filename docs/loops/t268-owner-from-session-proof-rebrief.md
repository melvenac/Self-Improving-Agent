# T-268 r2: the session-proof fallback counts only proofs that pass both checks, so a stale proof never refuses a live session

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop one-off (no hub key). Windows host required. Code only. Ends at READY with PR #664 updated, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t268-r2-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 169. **Task:** T-268 (P1). **Tag:** `T-268-r2`. **Size:** SMALL.
**Start:** branch `fix/t268-owner-from-session-proof` at `445a18a46002943ebc871826d797113b7a19372d` (PR #664's head,
round 1). This round adds two commits to that branch; there is no new PR. **Round 1:**
`docs/loops/t268-owner-from-session-proof-brief.md`. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: liveOwnerProbe ownerFromSessionProof (suite-owner.ts) (covered by tests/t268-owner-session-proof.test.ts, tests/t168-owner-wired.test.ts, tests/suite-run-meta.test.ts)
```

## Why (planner, first-hand on the desktop, 2026-10-13 ~11:40 CDT; counts only)

Round 1 did what the round-1 ruling said: "exactly one matching proof is required; zero or several → no owner",
counted BEFORE the liveness and claude.exe checks. The real proof directory shows that ordering refuses live sessions:
`~/.claude/open-brain/by-pid` held 28 proofs for 24 sessions; proofs are kept for days (median age 6.3 days, oldest
15.7); **4 sessions are named by 2 proofs each, and in 2 of those 4 one pid is alive and the other is dead.** Under
round 1 both live sessions are refused from Git Bash with `2 proofs name session <id8>`, about 2 of the 11 live
sessions. A proof whose pid is dead can never be the owner, so counting it is an ordering accident in the planner's
round-1 ruling, not a safety. (How a session comes to have two proofs was not measured; a session resumed in a new
process keeps its id, which would do it. The fix does not depend on the cause.) The safety the rule was for stays:
the fallback never picks between two LIVE candidates.

## Ruling (exact; paths under `open-brain/`)

1. **`src/suite-owner.ts`, `ownerFromSessionProof` only.** Collect every proof whose `session_id` equals
   `CLAUDE_CODE_SESSION_ID` and whose `ide` is `"claude"` (unchanged). Apply both checks to EACH of them:
   (a) `processStartTime(pid)` is not null and equals the proof's `proc_start`; (b) `readRow(pid)` is not null and
   `isClaudeExeCommandLine(row.commandLine)`. A proof that passes both is a SURVIVOR. Then, in this order:
   - 0 matching proofs → unchanged: `no session proof for CLAUDE_CODE_SESSION_ID <id8>`.
   - exactly 1 survivor → `{ pid, source: "claude-session", reason: null }`, however many matching proofs failed.
   - 2 or more survivors → no owner, `<k> live proofs name session <id8>` (k = the number of survivors).
   - 0 survivors and exactly 1 matching proof → the round-1 texts, unchanged:
     `the proof for <id8> names pid <p>, which is not running (or was reused)` when (a) fails, else
     `the proof for <id8> names pid <p>, which is not claude.exe`.
   - 0 survivors and n ≥ 2 matching proofs → no owner, `<n> proofs name session <id8>, and none names a running claude.exe`.
   Every reason keeps round 1's form `${NO_OWNER_REASON}; <text>`.
2. **Nothing else changes:** the walk runs first and the fallback only when it finds no owner; `CLAUDE_PID` is never
   read; a Win32 table that fails to load still refuses before the fallback; the `proofDir` default is unchanged.
3. Rewrite the doc comment above `ownerFromSessionProof` to say "exactly one proof that passes both checks". Edit
   `docs/loops/t168-suite-meta.md` ONLY if it states the one-proof rule (round 1 changed one line there; read it).

## Existing tests (planner-read at 445a18a4; verdicts)

- `tests/t268-owner-session-proof.test.ts`:
  - S1, S2, S3, S4, S6, S7: **stay green, unedited** (S3 and S4 have exactly one matching proof, so their texts are
    unchanged).
  - **S5 turns red under this ruling and is rewritten in commit 1:** its second proof (pid 4_000_000, `proc_start`
    `"win:2"`) is dead, so P is the one survivor and the fallback now returns P. Its old setup becomes S8 below.
- `tests/t168-owner-wired.test.ts` (N1-N5, N5a with `env: {}`) and `tests/suite-run-meta.test.ts`: **stay green,
  unedited.**
- Any other newly failing row: STOP, `BLOCKED T-268-r2 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t268-r2-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. **Start state.** Work in the fresh clone the launcher named; if it named none,
   `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t268r2-wt")` and
   `Set-Location` into it. Then `git fetch -q origin fix/t268-owner-from-session-proof` and
   `git checkout -q -b fix/t268-owner-from-session-proof 445a18a46002943ebc871826d797113b7a19372d` (if the branch
   already exists locally, `git checkout -q fix/t268-owner-from-session-proof` instead). All three must hold, else STOP,
   BLOCKED: `git rev-parse HEAD` prints `445a18a46002943ebc871826d797113b7a19372d`;
   `git ls-remote origin refs/heads/fix/t268-owner-from-session-proof` prints the same SHA (the branch has not moved);
   `git status --porcelain` is empty. `npm ci` in `open-brain`. **Forbidden:** `git stash`, `reset --hard`, `--force`,
   rebase, amend, merging master into the branch, `cd` into any other checkout, running `npm run test:heavy` without
   `SUITE_DRY_RUN=1`, and `docs/loops/machine-lease.ps1`.
3. **Base run** (in `open-brain`): `npx vitest run tests/t268-owner-session-proof.test.ts tests/t168-owner-wired.test.ts tests/suite-run-meta.test.ts --no-file-parallelism --testTimeout=180000`
   (expected: 3 files, 36 tests, all green). Paste the summary and any failing row.
4. **Commit 1, `T-268 r2: tests (red)`**, in `open-brain/tests/t268-owner-session-proof.test.ts` only. Add a second
   live pid, `const Q = process.ppid;`, and in `beforeAll` `qStart = ps.processStartTime(Q)` (throw if null, as for P).
   Every row below uses the file's `BROKEN` chain, `tableOf`, `proofDir` and `U`, and env `{ CLAUDE_CODE_SESSION_ID: U }`:
   - **S5 (rewritten), two live claude.exe proofs:** proofs P (`start`) and Q (`qStart`); table rows P and Q both
     `CLAUDE_EXE` → pid null, source `none`, reason contains `2 live proofs name session ${U.slice(0, 8)}`.
   - **S8, a dead proof beside the live one (the data case; round 1's S5 setup):** proofs P (`start`) and 4_000_000
     (`"win:2"`); table row P `CLAUDE_EXE` → `{ pid: P, source: "claude-session", reason: null }`.
   - **S9, two dead proofs:** proofs 4_000_000 (`"win:2"`) and 4_000_001 (`"win:3"`); no table rows for them → pid null,
     reason ends `2 proofs name session ${U.slice(0, 8)}, and none names a running claude.exe`.
   - **S10, live but not claude.exe beside a live claude.exe:** proofs P (`start`) and Q (`qStart`); table row P
     `CLAUDE_EXE`, row Q `"node.exe vitest"` → `{ pid: P, source: "claude-session", reason: null }`.
   Run the t268 file: S5, S8, S9 and S10 red; S1-S4, S6, S7 green. Paste it.
5. **Commit 2, `T-268 r2: the session-proof fallback counts only proofs that pass both checks`:** the ruling.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline 445a18a4..HEAD` shows 2 lines; `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0); the t268 file (10 passed); step 3's command again (3 files,
   39 tests, all green). Paste all three. Then the **live check from this run's Bash tool (Git Bash)**:
   `SUITE_DRY_RUN=1 npx tsx src/cli-suite-run.ts --meta "$TEMP/t268r2-meta.json"`; the meta must show `owner_source`
   `claude-session` and `owner_pid` equal to the pid in this session's own proof file (read it, never write it). The
   refusal at the missing lease helper is expected and takes nothing.
8. **Mutants** (edit `open-brain/src/suite-owner.ts`, run the t268 file only, paste, `git checkout -- open-brain/src/suite-owner.ts`,
   `git status --porcelain` empty; never commit):
   - M1: round 1's rule back (refuse with round 1's `<n> proofs name session <id8>` when more than one proof MATCHES,
     before the checks) → S8 and S10 red, and S5 and S9 red by their texts.
   - M2: take the first survivor when there are several → S5 red.
   - M3: drop check (a), the start-time comparison → S3 red.
   - M4: drop check (b), the claude.exe test → S4 and S10 red.
9. `git diff --name-only 445a18a4..HEAD` must show only `open-brain/src/suite-owner.ts` and
   `open-brain/tests/t268-owner-session-proof.test.ts`, plus `docs/loops/t168-suite-meta.md` only under Ruling 3.
   Anything else: STOP, BLOCKED.
10. `git push origin fix/t268-owner-from-session-proof` (never force; it fast-forwards 445a18a4).
    `git ls-remote origin refs/heads/fix/t268-owner-from-session-proof` must equal `git rev-parse HEAD`. Do not open a
    PR: #664 updates. Wait for CI on the new head (`gh pr checks 664 --watch --interval 30`, cap 20 min) and paste the
    `test` conclusion. If GitHub shows #664 BEHIND master, leave it: the planner refreshes it before the merge.

## Reply

The first line is `READY T-268-r2 <sha40> PR #664` or `BLOCKED T-268-r2 <reason>`. Then each command with its output:
the start-state checks, base run, red run, tsc, the t268 run, the second run, the live check's meta, the mutants, the
name-only diff, `ls-remote` = `rev-parse`, and CI. At most 2 attempts at a red. Mark anything not run `NOT RUN`. If the
code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
