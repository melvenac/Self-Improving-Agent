# T326: SessionEnd runs its fast work before the git checks (T-326)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-27, session 175. **Task:** T-326 (P1), code half only. **Tag:** `t326`. **Size:** SMALL
(2 edits in 1 file, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief and
`85e79e44`). **Authority:** D-163/D-164 (Aaron 10-26: planners brief, build and merge SIA code; hook SOURCE code is
normal code). The other half, `"timeout": 60` on the SessionEnd hook in `~/.claude/settings.json`, is hook CONFIG and is
Aaron's; it is NOT part of this PR.

```text
IMPACT-TARGETS: none (statements inside the cli-session-end.ts entry script change position; no exported symbol changes)
```

## Why

Claude Code gives SessionEnd hooks a 1.5-second budget unless a per-hook `timeout` raises it (up to 60 s;
code.claude.com/docs/en/hooks, the `timeout` field). `open-brain/src/cli-session-end.ts` ran the T-179 handoff check and
the T-246 work-after-end check (git scans, 25-43 s on a real 11 MB transcript) BEFORE the T-324 greeting outcome, the
T-159 trigger-fires reconcile and the trigger-keys refresh. Real session ends on the S2/S3 build wrote 0 outcome rows;
a manual run of the same build on copies wrote the right row. This moves ONE contiguous span, unchanged, to right after
the session proof: `readTriggerCounts`, the T-324 outcome `try` block, and the T-159 reconcile + trigger-keys
`if (existsSync(V2_DB))` block, with a 4-line `// T-326:` comment above it. Nothing else moves; no statement changes.
Why the order is safe is in `docs/loops/t326-sim.md` ("Why the order is safe", points 1-5).

## The change, exactly

Files under `docs/loops/t326/`.
- **`t326-session-end-order.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t326-session-end-order.test.ts`.
  O1-O3 spawn the SessionEnd hook through tsx and assert stdout line order.
- **`edits.txt`:** 2 edits in 1 file, `open-brain/src/cli-session-end.ts`: insert the span after the session proof;
  delete it from after the skills-audit check.

## Measured before dispatch

QA PC SIM `sim-t326` (job #237) at `95459fc7`: MISMATCH, **ruled PASS by the planner**. Only h's final five-file run
differed: after m3's restore, `t159-fast-path.test.ts` N3 was red once (4714 ms), then green on 3 runs alone and on a
repeat of the five files. f's first attempt was killed at the tool's 10-minute limit with 3 red R179 rows in
`record-erasure.test.ts`; the complete re-run had them green. Neither file touches the moved span's behaviour.
- Baseline (test only): `1 failed | 4 passed (5)` files, `2 failed | 46 passed (48)` tests; red O1
  (`expected 4 to be less than 1`), O2 (`expected 5 to be less than 1`); O3 green.
- Apply: `APPLIED 2 edits to 1 files`; both tsc and `npm run build` exit 0; five files `48 passed (48)`.
- Wide run (second attempt): `214 passed (214)` files, `2358 passed (2358)` tests, 1492 s; 2 T-292
  `Timeout calling "onTaskUpdate"` errors, 0 `x` rows.
- `retirements [pass]`, `module-boundary [pass]` (164 files, 129 core).
- m1 -> O1; m2 -> O2; m3 -> O3.
- Planner check at 71dd239e: `edits.txt` still applies (`APPLIED 2 edits to 1 files`); `cli-session-end.ts` has not
  changed since 95459fc7.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/trigger/t159-fast-path.test.ts` (L440 pins `NOT RECONCILED` before `v2 vault not found`) | stays green | Line text unchanged; the vault exit is still after the reconcile. N3 is known flaky (below). |
| `t324-s2-greeting-outcome.test.ts` W1, W2; `t324-s3-trigger-counts.test.ts` W3, W4 | stay green | `toContain` on the outcome line and the row; no order assertion. Green in the SIM. |
| `tests/t262-part2.test.ts`, `tests/end-fix-*.test.ts`, `tests/t276-session-trailer.test.ts`, `tests/shared/handoff-guard.test.ts` | stay green | They assert the check lines' text, not their position. Green in the SIM. |
| `tests/t003-session-proof.test.ts` | stays green | The proof block does not move and stays first. |
| `tests/harness/s4-guards.test.ts` D1b | green after commit 1 | The new test file is tracked once committed. |
| `hub-presence.test.ts`, `state-import-r4.test.ts`, `end-fix-q3.test.ts`, `t159-fast-path.test.ts` N3, `record-erasure.test.ts` R179 rows | known flaky under load | Red once on the shared QA PC (SIMs #134, #143, #237), green alone. See the exception rule. |

Any other red existing row means STOP and report `BLOCKED t326 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. A red row in a
known-flaky file above, or in any file other than `t326-session-end-order.test.ts`, with that error or a timeout:
re-run that file alone up to 3 times; green on any run alone means paste every run and go on, red on all 3 means STOP.
A red O1, O2 or O3 after commit 2 is never flaky: STOP.

## Steps

"The five files" means, from `open-brain`:
`npx vitest run tests/t326-session-end-order.test.ts tests/pipelines/session-start/t324-s2-greeting-outcome.test.ts tests/pipelines/session-start/t324-s3-trigger-counts.test.ts tests/trigger/t159-fast-path.test.ts tests/t262-part2.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t326-session-end-order`. HEAD must equal START, the
   porcelain must be empty, and `git merge-base --is-ancestor 85e79e44 HEAD` must exit 0. In `open-brain`: `npm ci`,
   then `node -e "require('better-sqlite3')"` (on "Could not locate the bindings file" run
   `npm rebuild better-sqlite3` and say so). Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash, reset --hard,
   force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real `~/.claude/`,
   any MCP config, and anything under `docs/`.
3. **Commit 1** (`T326: rows for the SessionEnd step order`).
   - `Copy-Item docs/loops/t326/t326-session-end-order.test.ts open-brain/tests/t326-session-end-order.test.ts`.
   - Run the five files. Expect `1 failed | 4 passed (5)` files and `2 failed | 46 passed (48)` tests, red O1 and O2
     only (O3 green). Paste the summary and each `x` row. Commit the test file.
4. **Commit 2** (`T326: SessionEnd runs its fast work before the git checks (T-326)`).
   - From the clone root: `node docs/loops/t326/apply.cjs . docs/loops/t326/edits.txt` prints exactly
     `APPLIED 2 edits to 1 files`.
   - In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build` (each exit 0).
   - Run the five files: `48 passed (48)`.
   - `npx vitest run tests/pipelines tests/shared tests/trigger tests/end-fix tests/t262-part2.test.ts tests/t003-session-proof.test.ts tests/t276-session-trailer.test.ts tests/t294-small-fixes.test.ts tests/t048-r2b.test.ts tests/t162a-rematch-add.test.ts tests/t322-rematch.test.ts tests/t326-session-end-order.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait; never
     the 10-minute default). Expect 0 failed, subject to the exception rule. Paste the `Test Files`, `Tests` and any
     `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary","retirements"`;
     both must show `[pass]`.
   - Commit `open-brain/src/cli-session-end.ts`.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m3: `node docs/loops/t326/apply.cjs . docs/loops/t326/<m>.txt`
   prints `APPLIED 2 edits to 1 files` (m1, m2) or `APPLIED 1 edits to 1 files` (m3); run
   `npx vitest run tests/t326-session-end-order.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and the `x` rows (expected: m1 -> O1; m2 -> O2; m3 -> O3); restore with
   `git checkout -- open-brain/src` and check the status is empty. After m3, run the five files once more:
   `48 passed (48)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 2 paths:
   `M open-brain/src/cli-session-end.ts`,
   `A open-brain/tests/t326-session-end-order.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t326-session-end-order` must
   equal HEAD. `gh pr create --base master --head feat/t326-session-end-order --title "T326: SessionEnd runs its fast work before the git checks (T-326)" --body "Brief: docs/loops/t326-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t326 <sha40> PR #<n>` or `BLOCKED t326 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

sia-rebuild on the main checkout. Live check: the next real session end on the desktop appends a `kind:'outcome'` row
to `~/.claude/open-brain/greeting-metrics.jsonl`, even before Aaron adds the settings timeout (the outcome block now
finishes well inside 1.5 s); then tell Prism (dashboard T-054). The `"timeout": 60` on the SessionEnd hook in
`~/.claude/settings.json` is Aaron's (hook config) and is not part of this PR; after he adds it, verify the T-179
handoff check and the T-262 unaudited-session notice complete on a real session end.
