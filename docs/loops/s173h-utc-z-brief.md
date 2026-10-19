# S173H: the greeting's UTC date carries a Z (T-305, D-160)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named s173h-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-19, session 173. **Task:** T-305 (P3). **Decision:** D-160. **Tag:** `S173H`.
**Size:** SMALL (1 src file, 2 edits; 3 test files, 6 edits; 1 new test file). **Base:** the dispatch SHA clark names
(a master that contains this brief). **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: renderBriefing renderBudgeted (briefing.ts: the session line prints the date with a Z)
```

## Why

Every `/start` after 19:00 CDT showed tomorrow's date. For example, Maker S70 at about 22:45 CDT on 10-18 printed
`Session N — 2026-10-19`. The date is UTC (`start-report.ts:271`, `toISOString().slice(0, 10)`).

Aaron ruled on 10-19 (D-160): keep UTC and label it, `2026-10-19Z`. No switch to local time.

**Fix:** both session-line templates in `briefing.ts` print `${i.date}Z`.

**Kept as it is, on purpose:** `BriefingInput.date` stays a plain `YYYY-MM-DD`. `isExpired` compares it with a
watch-out's ISO `expires` as a string, so `"2026-10-19Z" > "2026-10-19"` would hide a watch-out on the last day it
should print. Row R3 pins that.

Out of scope: session-log headers, stored record dates, and the `Last session:` and decision dates in the state block.
They are record data, and the ruling is about the greeting label.

## The change, exactly

All files are under `docs/loops/s173h/`.

- **`edits.txt`:** 8 exact-once replacements across 4 files:
  - `open-brain/src/pipelines/session-start/briefing.ts` (2: line 149, the original layout; line 266, the budgeted
    layout, with a T-305 comment on the first)
  - `open-brain/tests/pipelines/session-start/briefing.test.ts` (1: line 74's exact session line)
  - `open-brain/tests/fixtures-state/a2a-1c200b41-render.golden.txt` (4: the session line under each
    `=== renderBriefing seat=… ===` header)
  - `open-brain/tests/pipelines/__snapshots__/fleet-ae-f5.test.ts.snap` (1: line 7)
- **`s173h.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/s173h.test.ts`.

## Measured before dispatch

QA PC SIM S173H by clark at `f675784c` (master `a9ca8813` plus these files) used these exact files. sha256 prefixes:

| File | sha256 prefix |
|---|---|
| edits | `7e18aa9532d6bf2c` |
| test | `d94f4e46f734095b` |
| m1 | `2ffd598f6f6fee13` |
| m2 | `cf275d41c75ad9eb` |
| m3 | `37ff6e5463459724` |

- The new file on the unpatched base: `2 failed | 1 passed (3)`. R1 and R2 are red; R3 is green, because it is a
  guard.
- Apply: `APPLIED 8 edits to 4 files`. Both tsc runs exit 0.
- The step 4 run: `58 passed (58)` files, `700 passed (700)` tests, with no Errors line.
- Mutants, each on the patched tree:

  | Mutant | Red row |
  |---|---|
  | m1 | R1 |
  | m2 | R2 |
  | m3 | R3 |

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `briefing.test.ts` row at line 74 | edited (in edits.txt) | Exact session line. |
| `a2a-byte-identical.test.ts` (golden) | edited (in edits.txt) | Four session lines in the golden. Every other byte is unchanged. |
| `fleet-ae-f5.test.ts` snapshot | edited (in edits.txt) | Line 7. Never run `-u`. |
| `t154-cli-start.test.ts` CS-2 | stays green | It normalises both sides, and both carry the Z. |
| `t161-transcript.test.ts`, `briefing-budget.test.ts` line 335 | stay green | `startsWith("Session N — ")` / `endsWith(...)`. |
| `briefing-budget.test.ts` (a) ISO expiry | stays green | `date` is still plain. |
| `t298-s2-handoff-stamp.test.ts` H4 | stays green | A hand-written report; the metrics do not parse the date. |
| `server.test.ts` lines 341, 358 | stay green | `next-session.md` and `Last session:` are record views, unchanged. |
| Budget caps (31 lines / 4400 chars) | stay green | +1 char on one line; measured in the SIM. |

Any other red existing row means STOP and report `BLOCKED S173H <test name>`. The one exception is T-292's
`Timeout calling onTaskUpdate` error when every test passed: paste it and go on.

## Steps

1. **Shell.** In PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "s173h-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`. Otherwise STOP.
2. **Clone and install.**
   - Make a fresh clone into `(Join-Path $env:TEMP "s173h-wt")`, unless the launcher named one.
   - Run `git checkout -q -b fix/s173h-utc-z <base>`. HEAD must equal the base, and the porcelain must be empty.
   - In `open-brain`, run `npm ci`, then the better-sqlite3 probe.
   - Forbidden: stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/open-brain/`, `~/.claude/commands/`, and anything under `docs/`.
3. **Commit 1** (`S173H: rows for the Z on the greeting date`). It holds the test file only.
   - Run `Copy-Item docs/loops/s173h/s173h.test.ts open-brain/tests/`.
   - Run `$env:NO_COLOR='1'`. Then, in `open-brain`, run
     `npx vitest run tests/s173h.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect `2 failed | 1 passed (3)`. Paste the summary and the `x` rows.
4. **Commit 2** (`S173H: the greeting's UTC date carries a Z (T-305, D-160)`).
   - From the clone root, `node docs/loops/s173h/apply.cjs . docs/loops/s173h/edits.txt` must print exactly
     `APPLIED 8 edits to 4 files`.
   - Run `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build` (exit 0).
   - Run `npx vitest run tests/s173h.test.ts tests/pipelines/session-start tests/pipelines/fleet-ae tests/t154-cli-start.test.ts tests/server.test.ts --no-file-parallelism --testTimeout=180000`
     (25-minute cap). Expect `700 passed`. Paste the `Test Files`, `Tests` and any `Errors` lines.
5. **Check the commits.**
   - Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <base>..HEAD` shows 2 lines.
   - The status is empty.
6. **Mutants.** Do this on the committed fix, for each of `m1.txt` … `m3.txt`:
   - Run `node docs/loops/s173h/apply.cjs . docs/loops/s173h/<mN>`. It prints `APPLIED 1 edits to 1 files`.
   - Run the new test file. Paste the summary and the `x` rows.
   - Restore with `git checkout -- open-brain/src`. The status must be empty.
   - Never commit a mutant.
   - Expected red rows: m1 R1 · m2 R2 · m3 R3.
7. **Check the diff.** `git diff --name-only <base>..HEAD` shows exactly:
   - `open-brain/src/pipelines/session-start/briefing.ts`
   - `open-brain/tests/fixtures-state/a2a-1c200b41-render.golden.txt`
   - `open-brain/tests/pipelines/__snapshots__/fleet-ae-f5.test.ts.snap`
   - `open-brain/tests/pipelines/session-start/briefing.test.ts`
   - `open-brain/tests/s173h.test.ts`
8. **Push and open the PR.**
   - Push, never force. `git ls-remote origin refs/heads/fix/s173h-utc-z` must equal HEAD.
   - Run `gh pr create --base master --head fix/s173h-utc-z --title "S173H: the greeting's UTC date carries a Z (T-305, D-160)" --body "Brief: docs/loops/s173h-utc-z-brief.md."`.
   - Then run `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY S173H <sha40> PR #<n>` or `BLOCKED S173H <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply.
- Every number is pasted output, with its command shown above it. Mark anything not run `NOT RUN`.
- Do not merge.

## After merge (not this run)

REBUILT. The next `/start` anywhere prints `Session N — YYYY-MM-DDZ · …`. A watch-out with an ISO `expires` still
prints on its last day.
