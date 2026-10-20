# T317-S1: ob_end's record gate needs this session's set_handoff, not any record write (T-317 part 1)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t317-s1-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-20, session 173. **Task:** T-317 (P0; Aaron 10-20: "yes and high priority. Several
agents are about to roll"). **Tag:** `T317-S1`. **Size:** SMALL (1 src file, 2 edits; 1 new test file).
**Base:** the dispatch SHA Atlas names (a master that contains this brief). **Checklist:**
`~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: checkRecordUpdated checkSessionHandoff (end-record-guard.ts newLayoutRecordUpdated: the sessions[] row no longer passes the gate)
```

## Why

`/end` writes no project state. The handoff is written during work with `ob_state set_handoff`, and ob_end's
`RECORD NOT UPDATED` gate is the backstop. The SessionEnd hook's `checkSessionHandoff` uses the same rule.

On the new layout, `newLayoutRecordUpdated` passes the gate on a `sessions[]` row for the session. Every record
write adds one, so an `add_decision` or `update_task` let a session close with no handoff. The next session then
started from whatever handoff an earlier session left.

**Fix:** drop the `sessions[]` branch. The refusal detail now says that other record writes don't count, and that
`ob_state set_handoff` does. A loop `docs/loops/*-handoff.md` commit still counts, as today.

Part 2 (a stale handoff written before the session's later work) needs a schema field and follows T-315.

## The change, exactly

All files are under `docs/loops/t317-s1/`.

- **`edits.txt`:** 2 exact-once replacements in `open-brain/src/shared/end-record-guard.ts`.
  1. The `sessionRow` variable and its `if` branch are removed, and a T-317 comment is added.
  2. The not-updated `detail` text changes.
- **`t317-s1.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t317-s1.test.ts`.
  - R1: a session whose only record write is `add_decision` is refused, with the new detail text.
  - R2 (guard): the same session closes once it sets its handoff.

## Measured before dispatch

QA PC SIM T317-S1 at `3d11c2dc` (master `16075e2a` plus these files). sha256 prefixes:

| File | sha256 prefix |
|---|---|
| edits | `be181a9a5c33f2b4` |
| test | `176273cbf51ba82c` |
| m1 | `68617b38fa00b76a` |

- The new file on the unpatched base: `1 failed | 1 passed (2)`. R1 red, R2 green.
- Apply: `APPLIED 2 edits to 1 files`. Both tsc runs and the build exit 0.
- The step 4 run: `79 passed (79)` files and `1076 passed (1076)` tests. All 15 `end-fix-*` files are green. One
  T-292 `Timeout calling "onTaskUpdate"` error appeared with every test green.
- m1 (the `sessions[]` branch restored): R1 red.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/end-fix-*.test.ts` (15 files) | stay green | They close via `set_handoff` or old-layout `next-session.md`. None relied on the `sessions[]` row. Green in the SIM. |
| `tests/end-fix-r4-pins.test.ts` S1b (`add_decision` after ob_end) | stays green | The E4 after-end path uses the content hash and still reports WORK AFTER. Green in the SIM. |
| `tests/server.test.ts`, `tests/shared`, `tests/pipelines/session-end`, `tests/pipelines/session-start` | stay green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED T317-S1 <test name>`. There are two exceptions, both
from T-292 load on the shared QA PC:
- T-292's `Timeout calling onTaskUpdate` error when every test passed: paste it and go on.
- That error with ONE red existing test outside `t317-s1.test.ts`: re-run that test's file alone. If it is green
  alone, paste both runs and go on. If it is red alone, STOP.
- A red `t317-s1.test.ts` row is never an exception.

## Steps

1. **Shell.** In PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t317-s1-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`. Otherwise STOP.
2. **Clone and install.**
   - Make a fresh clone into `(Join-Path $env:TEMP "t317-s1-wt")`, unless the launcher named one.
   - Run `git checkout -q -b fix/t317-s1-handoff-gate <base>`. HEAD must equal the base, and the porcelain must be
     empty.
   - In `open-brain`, run `npm ci`, then the better-sqlite3 probe.
   - Forbidden: stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/open-brain/`, `~/.claude/commands/`, and anything under `docs/`.
3. **Commit 1** (`T317-S1: rows for the handoff gate`). It holds the new test file only.
   - Run `Copy-Item docs/loops/t317-s1/t317-s1.test.ts open-brain/tests/`.
   - Run `$env:NO_COLOR='1'`. Then, in `open-brain`, run
     `npx vitest run tests/t317-s1.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect `1 failed | 1 passed (2)`: R1 red, R2 green. Paste the summary and the `x` rows.
4. **Commit 2** (`T317-S1: ob_end's record gate needs this session's set_handoff, not any record write (T-317)`).
   - From the clone root, `node docs/loops/t317-s1/apply.cjs . docs/loops/t317-s1/edits.txt` must print exactly
     `APPLIED 2 edits to 1 files`.
   - Run `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build` (exit 0).
   - Run `npx vitest run tests/t317-s1.test.ts tests/end-fix tests/shared tests/server.test.ts tests/pipelines/session-end tests/pipelines/session-start --no-file-parallelism --testTimeout=180000`
     (25-minute cap). Expect 0 failed and about 1076 tests. Paste the `Test Files`, `Tests` and any `Errors` lines.
5. **Check the commits.**
   - Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <base>..HEAD` shows 2 lines.
   - The status is empty.
6. **Mutant.** On the committed fix:
   - Run `node docs/loops/t317-s1/apply.cjs . docs/loops/t317-s1/m1.txt`. It prints `APPLIED 1 edits to 1 files`.
   - Run the new test file. Paste the `x` rows. Expected red: R1.
   - Restore with `git checkout -- open-brain/src`. The status must be empty. Never commit it.
7. **Check the diff.** `git diff --name-only <base>..HEAD` shows exactly:
   - `open-brain/src/shared/end-record-guard.ts`
   - `open-brain/tests/t317-s1.test.ts`
8. **Push and open the PR.**
   - Push, never force. `git ls-remote origin refs/heads/fix/t317-s1-handoff-gate` must equal HEAD.
   - Run `gh pr create --base master --head fix/t317-s1-handoff-gate --title "T317-S1: ob_end's record gate needs this session's set_handoff (T-317)" --body "Brief: docs/loops/t317-s1-brief.md."`.
   - Then run `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T317-S1 <sha40> PR #<n>` or `BLOCKED T317-S1 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply.
- Every number is pasted output, with its command shown above it. Mark anything not run `NOT RUN`.
- Do not merge.

## After merge (not this run)

`sia-rebuild`. From then on, a session that wrote record changes but no `set_handoff` gets `RECORD NOT UPDATED …
no set_handoff for session <uuid> (other record writes by this session do not count: run ob_state set_handoff)` at
`ob_end`, and the SessionEnd hook flags it for the next `/start`.
