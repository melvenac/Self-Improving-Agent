# T-168 (last item): the suite owner resolves through #427's walker, and a lease held by another owner refuses

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop one-off (no hub key). Windows host required (the owner walk reads the Win32 process table). Code only.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t168-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 168. **Task:** T-168 (P1). **Tag:** `T-168`. **Size:** SMALL.
**Base:** `304d56392c8e2fdab33b08a66daae96ece46ab5d` (origin/master; its code equals 399121cd). If clark re-pins it at
launch, that SHA wins. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: resolveOwnerFromAncestry unboundOwnerProbe resolveOwner (cli-suite-run.ts) (covered by tests/suite-run-meta.test.ts, tests/t235-p2-3-cursor-proof.test.ts)
```

## Why

T-168's note ends: "REMAINING: the owner resolver sits behind an interface pending #427; #427 has now merged
(bda94d19), so wire it to findCursorAgentHostPid. QA 279 F-A: the different-owner lease case is untested. Then close."
Verified in code at 399121cd: `src/cli-suite-run.ts:152` still returns `unboundOwnerProbe()`, so EVERY `npm run
test:heavy` without `--owner-pid` refuses (exit 2, vitest never runs); `src/suite-owner.ts:27-36` is a COPY of #427's
matcher; and only a same-owner lease row exists (`tests/suite-run-meta.test.ts:392`), so QA 279's mutant M5 ("a lease
held by any pid counts as the owner's") survives every row.

## Ruling (exact names; paths under `open-brain/`)

1. **`src/suite-owner.ts`:**
   - Import `findCursorAgentHostPid`, `isCursorAgentHostCommandLine`, `loadWin32ProcessTable`, `readProcessParent` and
     the types they use from `./shared/process-session.js`. Delete the local copy of the matcher (`:27-36`); keep
     re-exporting `isCursorAgentHostCommandLine` from this module if any test imports it from here.
   - New `export function resolveOwnerWalk(startPid: number, readParent: (pid: number) => ProcessParentInfo | null):
     ResolvedOwner`: `findCursorAgentHostPid(startPid, readParent)` → `{ pid, source: "cursor-agent", reason }` on a hit;
     else the NEAREST ancestor (start included) whose command line `isClaudeExeCommandLine` → `{ pid, source:
     "claude.exe", reason }`; else `{ pid: null, source: "none", reason: NO_OWNER_REASON }`. Order: cursor-agent first,
     as shipped (planner ruling). Never `process.ppid` itself as the owner, never `CLAUDE_PID` (nested sessions inherit
     the outer one's).
   - `resolveOwnerFromAncestry(startPid, rows)` keeps its signature and delegates to `resolveOwnerWalk` over the rows.
   - Replace `unboundOwnerProbe` with `export function liveOwnerProbe(startPid: number, loadTable = loadWin32ProcessTable):
     ResolvedOwner`. On win32, or when a `loadTable` is passed explicitly, load the table ONCE; a failed load returns
     `{ pid: null, source: "none", reason: "Win32 process table: <its error>" }`; otherwise walk with
     `p => table.get(p) ?? null`. Never pass `readProcessParent` itself on win32 (it would reload the table per step).
     Elsewhere walk with `readProcessParent`.
2. **`src/cli-suite-run.ts`:** the import (`:25`) follows; `:152` becomes `return liveOwnerProbe(process.ppid);`
   (`process.ppid` is only the walk's start). `--owner-pid` and `SUITE_ANCESTRY`/`SUITE_OWNER_FROM` keep precedence and
   behaviour. Refresh both files' header comments, and `docs/loops/t168-suite-meta.md` line 5, to say the owner is now
   resolved live.
3. **No test may reach the real machine lease.** Every CLI row that can now resolve an owner sets the `SUITE_LEASE_*`
   seams (`SUITE_LEASE_EXIT`, `SUITE_LEASE_STATUS_EXIT`, `SUITE_LEASE_STATUS_OUT`, `SUITE_LEASE_RELEASE_EXIT`) or
   `SUITE_LEASE_OPT_OUT`, and every row that must stay ownerless sets `SUITE_ANCESTRY` to a chain with neither a
   cursor-agent host nor claude.exe. Rows must give the same result on the desktop, the laptop, the QA PC and Linux CI.

## Existing tests (planner-researched; verdicts)

- `tests/suite-run-meta.test.ts:392` "a lease already held by the same owner": **must be updated.** Its call without an
  owner (`:394-397`) asserts exit 2 and `owner_pid` null; under a live CC or Cursor ancestor the owner now resolves. Make
  that call ownerless by setting `SUITE_ANCESTRY` to a no-owner chain; keep every assertion.
- `:359` "cli: lease exits 11 and 2 refuse" and `:426` "a missing win32 helper refuses…": stay green, **harden** the same
  way (no-owner `SUITE_ANCESTRY`, or seams), and correct the comment at `:376`.
- Stay green: `:39 :55 :77 :94 :110 :131 :189 :203 :218 :232 :239 :244 :259 :315`, and `:146 (R7) :291 :307 :344` as long
  as `resolveOwnerFromAncestry`, `SUITE_ANCESTRY` and the `NO_OWNER_REASON` text are kept;
  `tests/t235-p2-3-cursor-proof.test.ts` rows `35 45 86 212`.
- Any other newly failing row: STOP, `BLOCKED T-168 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t168-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t168-wt")`, `Set-Location`
   into it, `git checkout -q -b fix/t168-owner-wired 304d56392c8e2fdab33b08a66daae96ece46ab5d`. HEAD must print that SHA
   and the tree must be clean, else STOP, BLOCKED. `npm ci` in `open-brain`. **Forbidden:** `git stash`,
   `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout, and running `npm run test:heavy` or
   `docs/loops/machine-lease.ps1` for real.
3. **Base run** (in `open-brain`): `npx vitest run tests/suite-run-meta.test.ts tests/t235-p2-3-cursor-proof.test.ts tests/shared --no-file-parallelism --testTimeout=180000`.
   Paste the summary and every failing row; anything red is pre-existing.
4. **Commit 1, `T-168: tests (red)`.** New file `open-brain/tests/t168-owner-wired.test.ts` (namespace imports so a
   missing export fails rows, not the file). Give every CLI-spawning row an explicit 60 s timeout.
   - **N1 (QA 279 F-A):** `--owner-pid 100`, `SUITE_LEASE_STATUS_EXIT=10`,
     `SUITE_LEASE_STATUS_OUT="lease=held owner=forge session= pid=200 started=t expires=t"`, `SUITE_LEASE_EXIT=10` →
     exit 2, stderr contains `lease held (exit 10)`; meta `lease_status` "held", `lease_take_exit` 10,
     `lease_release_exit` null, `vitest.exit_code` null.
   - **N2:** N1 with `pid=1000` (100 is a prefix of 1000, not equal) → the same refusal.
   - **N3 (wired, real walk):** spawn `tests/fixtures-t003/cursor-agent/versions/e2e-fixture/index.js` with
     `-- <the clone's tsx> src/cli-suite-run.ts --meta <tmp>`, no `--owner-pid`, no `SUITE_ANCESTRY`,
     `SUITE_DRY_RUN=1` and the lease seams at 0 → exit 0, meta `owner_pid` equals the fixture's printed host pid, and
     `owner_source` "cursor-agent". (Read the fixture first to see what it prints and how it passes argv.)
   - **N4 (unit, injected walk):** a chain tsx → cmd → claude.exe(30) → sh(`…/npm/claude`) gives pid 30, source
     "claude.exe"; a chain where a claude.exe is NEARER than a cursor-agent host gives the host, source "cursor-agent".
   - **N5 (unit):** a chain with neither → pid null, reason `NO_OWNER_REASON`, never the start pid; a `loadTable` that
     fails → pid null, reason matching `/^Win32 process table:/`.
   Run the file: N3, N4 (the claude.exe-only chain may already pass through the existing ancestry path; say which) and
   N5's table half red. N1 and N2 may already pass; paste which.
5. **Commit 2, `T-168: the suite owner resolves through #427's walker; tests never reach the real lease`:** the ruling,
   plus the three row edits named above.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline 304d5639..HEAD`
   shows 2 lines; `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), the t168 file, then step 3's command again. Paste all three.
8. **Mutants** (edit, run the t168 file and `tests/suite-run-meta.test.ts` only, paste, `git checkout -- <file>`, clean
   tree; never commit):
   - M1 (QA 279 M5): `statusHeldByOwner` treats any status 10 as ours → N1 red.
   - M2: the pid regex loses its trailing `(?:\s|$)` → N2 red.
   - M3: `:152` back to the unbound probe → N3 red.
   - M4: claude.exe checked before the cursor-agent host → N4 red.
   - M5: `liveOwnerProbe` returns the start pid when nothing matches → N5 red.
9. `git diff --name-only 304d5639..HEAD` must show only `open-brain/src/suite-owner.ts`, `open-brain/src/cli-suite-run.ts`,
   `docs/loops/t168-suite-meta.md`, `open-brain/tests/t168-owner-wired.test.ts`, `open-brain/tests/suite-run-meta.test.ts`.
   Anything else: STOP, BLOCKED.
10. `git push origin fix/t168-owner-wired` (never force); `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr create --base master --head fix/t168-owner-wired --title "T-168: the suite owner resolves through #427's walker; a lease held by another owner refuses" --body "Brief: docs/loops/t168-owner-wired-brief.md."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-168 <sha40> PR #<n>` or `BLOCKED T-168 <reason>`. Then each command with its output: base
run, red run, tsc, the t168 run, the second run, the three row edits, the mutants, the name-only diff, `ls-remote` =
`rev-parse`, the PR URL and CI. Also say, from your own shell, what `liveOwnerProbe(process.ppid)` resolves to when run
under this headless session (pid, source, command line), as the live check. At most 2 attempts at a red. Mark anything
not run `NOT RUN`. If the code differs from a line this brief quotes, follow the ruling's intent and say what differed.
Do not merge.
