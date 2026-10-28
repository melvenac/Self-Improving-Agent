# T329: a fresh /start does not read like faults (T-329, N4)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-28, session 175. **Task:** T-329 (P2; N4 of `docs/loops/t241-frogger-rerun-report.md`).
**Tag:** `t329`. **Size:** SMALL (6 source edits in 3 files, 11 test edits in 5 existing test files, 1 new test file).
**Base:** the START sha the launcher names (a master that contains this brief). **Authority:** D-145 (work the backlog
by priority). Merge under D-163 (Atlas's QA ACCEPT; not an excluded class).

```text
IMPACT-TARGETS: formatScanCounts (scan-counts.ts; caller start-report.ts:194), renderState (state-render.ts; the own-handoff
header only), describeReadsOwed (reads-owed.ts; caller start-report.ts:283)
```

## Why

The T-241 re-run's first `/start` on a clean fresh install printed four lines that read like faults and were not.
Planner rulings (full text: `docs/loops/t329-sim.md`):
1. Scan counts: zero reads `Session logs: all readable` / `Transcript directories: all readable`; a scan that did not
   run reads `not searched yet` / `not scanned yet` with its reason. Both lines stay printed; nonzero is unchanged.
2. The empty handoff a fresh import writes renders as `Your handoff: none yet (fresh record)`; a legacy handoff with
   any content renders as before.
3. A checkout's first session (no earlier session row of that checkout, known session number and checkout) labels the
   list `READS FIRST (N)`; otherwise `READS OWED` as before.
4. Seat shown as the folder name: no change.

## The change, exactly

Files under `docs/loops/t329/`.
- **`t329-fresh-start.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/pipelines/t329-fresh-start.test.ts`.
  Rows F1-F5.
- **`edits-r2.txt`:** 17 edits in 8 files. It is `edits.txt` (the SIM's 15 edits in 7 files) plus 2 edits in
  `open-brain/tests/pipelines/session-start/briefing.test.ts`: the T-233 rows at lines 477 and 597 pass `null` as
  `describeReadsOwed`'s checkout instead of `"x"`. Use `edits-r2.txt`, NOT `edits.txt`.

Why `null`: those rows compare `handleStart`'s block with `renderBriefing` fed `describeReadsOwed(...)`. `handleStart`
passes `ownCheckout ?? null` (start-report.ts:259, 288), and for that fixture `ownCheckout` is undefined: no
`handoff_by_checkout` flag file exists (greeting-flags.ts `handoffCheckout` returns undefined) and the seat is
`developer`, not NOT_A_SEAT. With ruling 3, `"x"` (no earlier row) read `READS FIRST` while the real call (`null`)
reads `READS OWED`, so the blocks differed. `null` is the value the real call passes; no import changes.

## Measured before dispatch

QA PC SIM `sim-t329` (job #320) at `11f3c839`: MISMATCH on one prediction only.
- Baseline (seven files, new test only): `1 failed | 6 passed (7)` files, `4 failed | 135 passed (139)`; red F1, F2,
  F3, F5 only.
- `edits.txt`: `APPLIED 15 edits to 7 files`; both tsc and `npm run build` exit 0; seven files `139 passed (139)`.
- Wide run: `2 failed | 1783 passed (1785)`; the 2 red rows were the briefing.test.ts T-233 rows above (3 of 3 red
  alone, deterministic). `edits-r2.txt` adds the fix; the planner checked it applies (`APPLIED 17 edits to 8 files` on
  base copies) but nothing was run on the desktop.
- `retirements [pass]`, `module-boundary [pass]`, `command-tool-names [pass]`.
- m1 -> F1; m2 -> F4; m3 -> F5, each tsc exit 0, all as predicted.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t048-zero-case.test.ts` line 57 | CHANGES in edits-r2.txt | Pins `Session logs unreadable: 0`; now `all readable`. |
| `server.test.ts` lines 107-108 | CHANGES in edits-r2.txt | Same zero form in handleStart output. |
| `briefing-fix.test.ts` BF-R4, BF-R5 | CHANGES in edits-r2.txt | `sessions: []`, a first session: `READS FIRST`. |
| `g062-reads-owed.test.ts` O1, O2, O5 helper | CHANGES in edits-r2.txt | First session forms; O5's finder matches `^READS (OWED\|FIRST)`. |
| `briefing.test.ts` T-233 rows (477, 597) | CHANGES in edits-r2.txt | Checkout `null`, the value handleStart passes (above). |
| `briefing-fix.test.ts` BF-R1/R2/R3/F8, `handoff-by-checkout.test.ts`, `state-render.test.ts`, t296, t304, greeting-size | stays green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t329 <test name>`. Exceptions, from T-292 load on the
shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows or
file-level hook timeouts only in files other than the eight files, with that error or a timeout: re-run each such
file alone up to 3 times; green on any run alone means paste every run and go on, red on all 3 means STOP. Known flaky
under load: hub-presence, state-import-r4, end-fix-q3, t159-fast-path N3, record-erasure R179,
`tests/pipelines/session-start/latest-brief.test.ts` (hook timeout, T-292 signature), `tests/server.test.ts` handleSync
`runs sync on project root` (5 s default timeout; seen on CI for #1055). The server.test.ts T-230 rows are NOT on this
list: they are in the eight files and must pass.

## Steps

"The eight files" means, from `open-brain`:
`npx vitest run tests/pipelines/t329-fresh-start.test.ts tests/t048-zero-case.test.ts tests/server.test.ts tests/pipelines/session-start/briefing-fix.test.ts tests/pipelines/session-start/g062-reads-owed.test.ts tests/pipelines/session-start/state-render.test.ts tests/pipelines/session-start/handoff-by-checkout.test.ts tests/pipelines/session-start/briefing.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b build/t329`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash, reset --hard,
   force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real `~/.claude/`,
   any MCP config, and anything under `docs/`.
3. **Commit 1** (`T329: rows for a fresh /start that does not read like faults`).
   - `Copy-Item docs/loops/t329/t329-fresh-start.test.ts open-brain/tests/pipelines/t329-fresh-start.test.ts`.
   - Run the eight files. Expect 1 failed file and 4 failed tests, red F1, F2, F3, F5 only (F4 green). Paste the
     summary and each `x` row. Commit the test file.
4. **Commit 2** (`T329: neutral fresh-start wording for scan counts, empty handoff and first-session reads (T-329)`).
   - From the clone root: `node docs/loops/t329/apply.cjs . docs/loops/t329/edits-r2.txt` prints exactly
     `APPLIED 17 edits to 8 files`.
   - In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build` (each exit 0).
   - Run the eight files: 0 failed.
   - `npx vitest run tests/pipelines tests/t154-cli-start.test.ts tests/server.test.ts tests/t048-zero-case.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait).
     Expect 0 failed, subject to the exception rule. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`;
     both must show `[pass]`.
   - Commit the 3 source files and the 5 edited test files.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m3: `node docs/loops/t329/apply.cjs . docs/loops/t329/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; `npx tsc --noEmit` in `open-brain` exits 0; run
   `npx vitest run tests/pipelines/t329-fresh-start.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and the `x` rows (expected: m1 -> F1; m2 -> F4; m3 -> F5); restore with
   `git checkout -- open-brain/src` and check the status is empty. After m3, run the eight files once more: 0 failed.
   Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 9 paths:
   `M open-brain/src/pipelines/session-start/reads-owed.ts`, `M open-brain/src/pipelines/session-start/scan-counts.ts`,
   `M open-brain/src/pipelines/session-start/state-render.ts`,
   `M open-brain/tests/pipelines/session-start/briefing-fix.test.ts`,
   `M open-brain/tests/pipelines/session-start/briefing.test.ts`,
   `M open-brain/tests/pipelines/session-start/g062-reads-owed.test.ts`,
   `A open-brain/tests/pipelines/t329-fresh-start.test.ts`, `M open-brain/tests/server.test.ts`,
   `M open-brain/tests/t048-zero-case.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/build/t329` must equal HEAD.
   `gh pr create --base master --head build/t329 --title "T329: a fresh /start does not read like faults (T-329)" --body "Brief: docs/loops/t329-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t329 <sha40> PR #<n>` or `BLOCKED t329 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

sia-rebuild on the main checkout. Live check: the next adoption's first `/start` (or a scratch import) shows
`Your handoff: none yet (fresh record)`, `Session logs: all readable` (or `not searched yet`), and `READS FIRST (N)`.
