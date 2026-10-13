# T-268: `test:heavy` finds its owner from Git Bash too: when the Windows parent chain breaks, the session proof named by `CLAUDE_CODE_SESSION_ID` supplies it

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop one-off (no hub key). Windows host required. Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t268-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 168. **Task:** T-268 (P1). **Tag:** `T-268`. **Size:** SMALL.
**Base:** `5a858fd917876a0c90a32979a4123568aa83380b` (origin/master: T-168 #653 merged). If clark re-pins it at launch,
that SHA wins. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: liveOwnerProbe resolveOwnerWalk resolveOwner (cli-suite-run.ts) (covered by tests/t168-owner-wired.test.ts, tests/suite-run-meta.test.ts)
```

## Why (planner live check of T-168 on the desktop, 2026-10-13, first-hand)

T-168 (#653) resolves the D-119 owner by walking the Win32 parent chain to a cursor-agent host or the nearest
`claude.exe`. Live, from an interactive Claude Code session (claude.exe pid 25484):
- **From the PowerShell tool:** node → cmd → npx → powershell.exe → cmd.exe → `claude.exe` 25484. `liveOwnerProbe`
  returns `{ pid: 25484, source: "claude.exe" }`. Correct.
- **From the Bash tool (Git Bash):** node → cmd → npx → `bash.exe` 22836 → `bash.exe` 15508 → parent 29956 **NOT IN
  THE PROCESS TABLE** (the MSYS launcher already exited). The walk ends, `liveOwnerProbe` returns no owner, and
  `SUITE_DRY_RUN=1 npx tsx src/cli-suite-run.ts` exits 2 with `no cursor-agent host and no claude.exe session in the ancestor chain`.

It fails closed (and `--owner-pid` still works), but a Claude Code seat on Windows that runs the suite from Bash, the
usual case, is refused. The tool environment carries `CLAUDE_CODE_SESSION_ID`, and it equals the session proof the
SessionStart hook wrote: `~/.claude/open-brain/by-pid/25484.json` = `{"session_id":"f21ca920-…","proc_start":"win:…","ide":"claude"}`,
with the session id equal to the env value. `CLAUDE_PID` is also set, but it is NEVER used: `shared/process-session.ts:18-24`
records (measured, T-003 Step 0b) that it is inherited from an outer session in nested launches.

## Ruling (exact names; paths under `open-brain/`)

1. **Fallback, only after the walk finds no owner.** In `src/suite-owner.ts`, `liveOwnerProbe(startPid, loadTable?, env = process.env, proofDir = <the by-pid dir>)`:
   when `resolveOwnerWalk` returns no owner, read `env.CLAUDE_CODE_SESSION_ID`; if set, scan `proofDir` (resolve it the
   way the server does: `byPidDir(<active-session path>)` in `shared/process-session.ts`) for a proof file whose
   `session_id` equals it and whose `ide` is `"claude"`; take the pid from the file NAME; accept it only when
   (a) `processStartTime(pid)` equals the proof's `proc_start` (alive, not a reused pid) and (b) that pid's command line
   (from the loaded Win32 table, or `readProcessParent` off Windows) matches `isClaudeExeCommandLine`. Then the owner is
   `{ pid, source: "claude-session", reason: null }`. Exactly one matching proof is required; zero or several → no owner.
2. **The refusal names why the fallback did not apply**, appended to `NO_OWNER_REASON`'s text:
   `…; no CLAUDE_CODE_SESSION_ID` / `…; no session proof for CLAUDE_CODE_SESSION_ID <id8>` /
   `…; the proof for <id8> names pid <p>, which is not running (or was reused)` /
   `…; the proof for <id8> names pid <p>, which is not claude.exe` / `…; <n> proofs name session <id8>`.
3. `OwnerSource` gains `"claude-session"`; follow it wherever the union or `owner_source` is typed or written
   (`suite-run-meta.ts`, `docs/loops/t168-suite-meta.md`). Never read `CLAUDE_PID`. The walk's order is unchanged
   (cursor-agent host first, then the nearest claude.exe); the fallback never overrides a walk result.
4. **Nested-launch measurement (required, before commit 2):** from this run's own Bash tool, start
   `claude -p "print the value of the environment variable CLAUDE_CODE_SESSION_ID and nothing else" --model claude-haiku-5-5`
   (a nested session) and compare the value it prints with this session's `$CLAUDE_CODE_SESSION_ID`. **They must
   differ.** If they are equal, the variable is inherited like `CLAUDE_PID`, the fallback would name the OUTER session,
   and you STOP: `BLOCKED T-268 CLAUDE_CODE_SESSION_ID is inherited by nested sessions`. Paste both values (first 8
   characters only) in the reply.

## Existing tests (planner-read; verdicts)

- `tests/t168-owner-wired.test.ts`: N1-N5 stay green (the fallback runs only when the walk finds nothing; N5a's
  "neither present" row must now also pass `env: {}` so the fallback cannot apply, and still expects `NO_OWNER_REASON`
  at the START of the reason: update only that call and its reason assertion to a prefix match).
- `tests/suite-run-meta.test.ts`: the ownerless rows use `SUITE_ANCESTRY` (an injected table, not the live walk), so
  they stay green; confirm.
- Any other newly failing row: STOP, `BLOCKED T-268 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t268-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t268-wt")`, `Set-Location`
   into it, `git checkout -q -b fix/t268-owner-from-session-proof 5a858fd917876a0c90a32979a4123568aa83380b`. HEAD must
   print that SHA and the tree must be clean, else STOP, BLOCKED. `npm ci` in `open-brain`. **Forbidden:** `git stash`,
   `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout, running `npm run test:heavy` without
   `SUITE_DRY_RUN=1`, and `docs/loops/machine-lease.ps1`.
3. **Base run** (in `open-brain`): `npx vitest run tests/t168-owner-wired.test.ts tests/suite-run-meta.test.ts --no-file-parallelism --testTimeout=180000`.
4. **Commit 1, `T-268: tests (red)`.** New file `open-brain/tests/t268-owner-session-proof.test.ts` (namespace imports;
   a temp proof dir; an injected table and env; no real lease):
   - **S1:** a table whose chain breaks at a missing parent, env `CLAUDE_CODE_SESSION_ID=U`, a proof `<P>.json` for U
     with P's real start time (use this test process's own pid and `processStartTime(process.pid)` so the liveness check
     is real) and a table row for P whose command line is `…\claude.exe …` → `{ pid: P, source: "claude-session" }`.
   - **S2:** the same with no `CLAUDE_CODE_SESSION_ID` → no owner, reason ends `no CLAUDE_CODE_SESSION_ID`.
   - **S3:** a proof whose `proc_start` differs → no owner, `not running (or was reused)`.
   - **S4:** P's command line is not claude.exe → no owner, `which is not claude.exe`.
   - **S5:** two proofs naming U → no owner, `2 proofs name session`.
   - **S6:** a chain that DOES reach claude.exe → the walk's pid with source `claude.exe`, even when a proof for another
     live pid matches the env (the fallback never overrides).
   - **S7:** `CLAUDE_PID` set to a live claude pid, no session id → still no owner (never read).
   Run the file: S1, S3-S5 red (S2/S6/S7 may pass already; say which). Paste it.
5. **Commit 2, `T-268: test:heavy's owner falls back to the session proof named by CLAUDE_CODE_SESSION_ID`:** the ruling,
   after step 4 of the Ruling (the nested measurement) says the values differ.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline 5a858fd9..HEAD`
   shows 2 lines; `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), the t268 file, then step 3's command again. Paste all three. Then
   the **live check from this run's Bash tool**: `SUITE_DRY_RUN=1 npx tsx src/cli-suite-run.ts --meta "$TEMP/t268-meta.json"`;
   the meta must show `owner_source` `claude-session` and `owner_pid` equal to the pid in this session's own proof file
   (the desktop has no lease helper, so it then refuses at the helper: that refusal is expected and takes nothing).
8. **Mutants** (edit, run the t268 file only, paste, `git checkout -- <file>`, clean tree; never commit):
   - M1: the start-time check dropped → S3 red. M2: the claude.exe check dropped → S4 red.
   - M3: the first of several proofs accepted → S5 red. M4: the fallback runs before the walk → S6 red.
   - M5: `CLAUDE_PID` read as a further fallback → S7 red.
9. `git diff --name-only 5a858fd9..HEAD` must show only `open-brain/src/suite-owner.ts`, `open-brain/src/suite-run-meta.ts`
   (only if the union lives there), `open-brain/src/cli-suite-run.ts` (only if the probe's call changes),
   `docs/loops/t168-suite-meta.md`, `open-brain/tests/t268-owner-session-proof.test.ts`,
   `open-brain/tests/t168-owner-wired.test.ts`. Anything else: STOP, BLOCKED.
10. `git push origin fix/t268-owner-from-session-proof` (never force); `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr create --base master --head fix/t268-owner-from-session-proof --title "T-268: test:heavy's owner falls back to the session proof named by CLAUDE_CODE_SESSION_ID (Git Bash)" --body "Brief: docs/loops/t268-owner-from-session-proof-brief.md."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-268 <sha40> PR #<n>` or `BLOCKED T-268 <reason>`. Then each command with its output: the
nested measurement (8-character prefixes only), base run, red run, tsc, the t268 run, the second run, the live check's
meta, the mutants, the name-only diff, `ls-remote` = `rev-parse`, the PR URL and CI. At most 2 attempts at a red. Mark
anything not run `NOT RUN`. If the code differs from a line this brief quotes, follow the ruling's intent and say what
differed. Do not merge.
