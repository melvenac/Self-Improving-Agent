# SIM T326: SessionEnd runs its fast work before the slow git checks - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-27, session 175. **Task:** T-326 (P1), code half only. **Tag:** `sim-t326`.
**Authority:** D-163/D-164 (Aaron 10-26: planners brief, build and merge SIA code; hook SOURCE code is normal code). The
other half, `"timeout": 60` on the SessionEnd hook in `~/.claude/settings.json`, is hook CONFIG and is Aaron's; it is
NOT part of this SIM. **Base:** the launcher's START, a master that contains this SIM (`85e79e44` or later).

```text
IMPACT-TARGETS: none (statements inside the cli-session-end.ts entry script change position; no exported symbol changes)
```

## What is measured

Claude Code gives SessionEnd hooks a 1.5-second budget unless a per-hook `timeout` raises it (up to 60 s;
code.claude.com/docs/en/hooks, the `timeout` field). `open-brain/src/cli-session-end.ts` runs, in order: the T-245
claim, the T-003 session proof, the T-179 handoff check and the T-246 work-after-end check (both git scans), the T-262
skills-audit check, then the T-324 greeting outcome, the T-159 trigger-fires reconcile and the trigger-keys refresh,
then the session-end pipeline. Timed on the desktop against copies with a real 11 MB transcript (Relay, e0e0d12f): proof
0.33 s, handoff check 25.6 s, work-after-end 42.9 s, outcome 43.2 s. Real session ends on the S2/S3 build wrote 0
outcome rows; a manual run of the same build on copies wrote the right row. So the budget ends the hook before the
outcome block.

The change moves ONE contiguous span, unchanged, to right after the session proof: `readTriggerCounts` (a function
declaration), the T-324 outcome `try` block, and the T-159 reconcile + trigger-keys `if (existsSync(V2_DB))` block,
with a 4-line `// T-326:` comment above it. Nothing else moves; no statement changes.

Why the order is safe (read on `85e79e44`):
1. The outcome block reads `hookPayload`, `resolveSessionId`, `readObEndStamp(dir)`, the transcript and the store, read
   only. The two git checks never write the ob_end stamp (`.agents/SESSIONS/.ob-end-stamp.json` is written only by
   `ob_end`); `recordMissingHandoff`, `recordWorkAfterEnd` and `recordSkillsAuditNotice` append their own marker files.
2. The reconcile and keys refresh read the store and the pending-fires file; the checks touch neither.
3. The outcome block still runs before the reconcile (its S3 comment: pending not-asked fires carry no query, so the
   counts do not change either way).
4. The session proof stays first (T-003: before anything slow). The vault/DB exits stay last, so t159's pin
   (`trigger fires NOT RECONCILED` before `v2 vault not found`) holds.
5. Every block is synchronous, so the hook's stdout line order IS the order the blocks ran. The new rows assert line
   order rather than kill the process at 1.5 s: a timed kill would race tsx's own start-up on a loaded QA PC.

Files under `docs/loops/t326/`: `t326-session-end-order.test.ts` (new, goes to
`open-brain/tests/t326-session-end-order.test.ts`; O1-O3 spawn the SessionEnd hook through tsx, as the T-324 W rows
do), `edits.txt` (2 edits in 1 file: insert the span after the session proof; delete it from after the skills-audit
check), `m1.txt` (the outcome block back after the checks; 2 edits), `m2.txt` (the reconcile + keys block back after
the checks; 2 edits), `m3.txt` (copied instead of moved: the outcome and reconcile blocks run again after the checks;
1 edit), `apply.cjs`. Checked on the desktop on a copy of `85e79e44`'s file: `edits.txt` applies once each, the applied
file holds every original line plus the 4 comment lines, and esbuild parses the applied file and each mutant.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/trigger/t159-fast-path.test.ts` (reconcile lines; L440 pins `NOT RECONCILED` before `v2 vault not found`) | stays green | Line text unchanged; the vault exit is still after the reconcile. |
| `tests/pipelines/session-start/t324-s2-greeting-outcome.test.ts` W1, W2; `t324-s3-trigger-counts.test.ts` W3, W4 | stay green | `toContain` on the outcome line and the row; no order assertion. |
| `tests/t262-part2.test.ts`, `tests/end-fix-*.test.ts`, `tests/t276-session-trailer.test.ts`, `tests/shared/handoff-guard.test.ts` | stay green | They assert the check lines' text, not their position relative to the moved lines. |
| `tests/t003-session-proof.test.ts` | stays green | The proof block does not move and stays first. |
| `tests/t294-small-fixes.test.ts`, `tests/t162a-rematch-add.test.ts`, `tests/t322-rematch.test.ts` (trigger-keys lines) | stay green | Text only. |
| `tests/setup-hooks.test.ts`, `tests/pipelines/sync/hook-registration.test.ts` | unaffected | Settings only. |
| `tests/harness/s4-guards.test.ts` D1b | not run here | A SIM cannot commit the new test (entry 895); the build commits it. |

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The five files" means, from `open-brain`:
`npx vitest run tests/t326-session-end-order.test.ts tests/pipelines/session-start/t324-s2-greeting-outcome.test.ts tests/pipelines/session-start/t324-s3-trigger-counts.test.ts tests/trigger/t159-fast-path.test.ts tests/t262-part2.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). `git merge-base --is-ancestor 85e79e44 HEAD` must exit 0. In `open-brain`:
   `npm ci`, then `node -e "require('better-sqlite3')"` (on "Could not locate the bindings file" run
   `npm rebuild better-sqlite3` and say so).
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t326/`.
c. Baseline (test only): `Copy-Item docs/loops/t326/t326-session-end-order.test.ts open-brain/tests/t326-session-end-order.test.ts`.
   Run the five files. Paste the `Test Files` and `Tests` lines, any `Errors` line, and every `x` row with its
   assertion message.
d. From the clone root `node docs/loops/t326/apply.cjs . docs/loops/t326/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/pipelines tests/shared tests/trigger tests/end-fix tests/t262-part2.test.ts tests/t003-session-proof.test.ts tests/t276-session-trailer.test.ts tests/t294-small-fixes.test.ts tests/t048-r2b.test.ts tests/t162a-rematch-add.test.ts tests/t322-rematch.test.ts tests/t326-session-end-order.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait; never
   the 10-minute default). Paste the `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and
   the assertion message. Red rows alongside T-292's `Timeout calling onTaskUpdate` or a timeout: re-run each such file
   alone up to 3 times and paste every run. Known flaky under QA PC load: `hub-presence.test.ts`,
   `state-import-r4.test.ts`, `end-fix-q3.test.ts`.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary","retirements"`
   and paste every line.
h. Mutants, on the applied tree. Back up once:
   `Copy-Item open-brain/src/cli-session-end.ts "$env:TEMP\t326-se.bak"`. For each of m1..m3:
   `node docs/loops/t326/apply.cjs . docs/loops/t326/<m>.txt` (paste output); run ONLY
   `npx vitest run tests/t326-session-end-order.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and every `x` row; restore with
   `Copy-Item "$env:TEMP\t326-se.bak" open-brain/src/cli-session-end.ts -Force`. Never use `git checkout` to restore
   here. After m3's restore, run the five files once more and paste the `Tests` line.

## Predicted

- c: in t326-session-end-order.test.ts, O1 and O2 red (the outcome, reconcile and keys lines come after the handoff and
  work-after-end lines at baseline); O3 green; the other four files green.
- d: `APPLIED 2 edits to 1 files`; all three exit 0.
- e and h's final run: 0 failed.
- f: 0 failed, subject to the re-run rule.
- g: `module-boundary [pass]`, `retirements [pass]`.
- m1 (`APPLIED 2 edits to 1 files`) -> O1. m2 (`APPLIED 2 edits to 1 files`) -> O2. m3 (`APPLIED 1 edits to 1 files`)
  -> O3.

## Reply

First line: `READY sim-t326 <HEAD sha8> ALL PASS` only if every prediction held, f has 0 rows red on every run alone,
and g shows both `[pass]`. Otherwise `READY sim-t326 <HEAD sha8> MISMATCH` and list each step that differed, with the
full assertion message of every red row. Every number is pasted output, with its command.
