# T331: the recall trigger's withheld arm, shipped OFF (T-331)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-31, session 175. **Task:** T-331 (RSI research idea #1). **Tag:** `t331`.
**Size:** SMALL (`open-brain/src/trigger/run.ts` 4 edits, `policy.ts` 1, `policies/recall-trigger.json` 1,
`policies/recall-trigger.schema.json` 1; one new test file). **Base:** the START sha the launcher names (a master that
contains this brief). **Authority:** Aaron's 10-31 research ask ("Look for ideas we can adopt"); clark's 10-31 relay
of Aaron ("pick up any downstream work that's available"); D-164 (hook SOURCE code is not an SG-1 exclusion). The arm
ships OFF (`withhold_fraction: 0`); turning it on is Aaron's ruling. Merge under D-163 on Atlas's QA ACCEPT.

## Why

The PRD's open question about the recall trigger is whether an injection changes behaviour. Today there is nothing to
compare an injection with. This adds a counterfactual arm. A share of would-be injections, chosen by a hash of the
session and the ids, is withheld and recorded as a silent fire whose query carries `withheld:<ids>`, so later work can
compare outcomes after injected and withheld fires. It ships at 0, which changes nothing until Aaron sets a fraction.

## The change, exactly

- **`docs/loops/t331/edits.txt`:** 7 edits in 4 files, exactly as SIM `sim-t331` (job #492) measured.
  - **`run.ts`:** the `node:crypto` import, `withheldIds?` on TriggerOutcome, the exported `withholdDraw(session, ids)`
    (the first 8 hex digits of sha256 of `"<session>:<ids>"`, divided by 2^32), and the withheld branch before the
    injected record.
  - **`policy.ts`:** `withhold_fraction: z.number().min(0).max(1).optional()`.
  - **`recall-trigger.json`:** `"withhold_fraction": 0`.
  - **`recall-trigger.schema.json`:** the derived field, zod 4.3.6's exact output.
- **`docs/loops/t331/t331-withheld-arm.test.ts`** goes to `open-brain/tests/trigger/t331-withheld-arm.test.ts`. Rows
  W1-W5.
- No migration: `trigger_fires.state`'s CHECK is untouched. The token rides in `query`, as `seat-skip:` does.

## Measured before dispatch

SIM `sim-t331` (job #492) at `53534348`: ALL PASS.
- **Red-first:** 4 failed and 1 passed (W1, W3, W4, W5 red; W2 green). The file loaded.
- **Edits:** `APPLIED 7 edits to 4 files`; both tsc runs and the build exit 0. `write-schema` left the schema file at
  `1 file changed, 5 insertions(+)`.
- **Wide run:** 29 files and 284 tests passed.
- **Sync:** `retirements [pass]`, `module-boundary [pass]`.
- **Mutants:** m1 turns W4 red, m2 turns W3 red, m3 turns W1 red, and the file is green after the restore.
- **Planner re-check:** a dry-apply against `53534348` printed `APPLIED 7 edits to 4 files`, and m1-m3 each printed
  `APPLIED 1 edits to 1 files`.

## Existing tests (verdicts)

These files pin the trigger and stay green (SIM step e: 29 files, 0 red): `tests/trigger/*` (floor.test's
derived-schema drift row passes only WITH the schema edit; fires, hook, t159-fast-path N1b, no-network, negatives,
query, t170-*, t265, t286, t288, t290, t313), `tests/pipelines/session-start/t324-s3-trigger-counts.test.ts`
(triggerCounts unchanged), the audit-fix a1-r5/r7/r8/r9 files, t235-p2-5, t243, t247, t294 and setup-hooks. Any other red
existing row: STOP, `BLOCKED t331 <test name>`.

**Exception rule** (T-292, shared QA PC): a red row or a file-level hook timeout alongside `Timeout calling
onTaskUpdate` or a timeout gets up to 3 re-runs of that file alone. Green on any run means paste every run and go on;
red on all 3 means STOP.

**Known flaky under load:** hub-presence, state-import-r4, end-fix-q3, t159-fast-path N3, record-erasure R179,
`tests/pipelines/session-start/latest-brief.test.ts`, `tests/server.test.ts` handleSync `runs sync on project root`,
`tests/shared/state-writer-notes.test.ts` T171-D1.

## Steps

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b build/t331`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci` (exit code). Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes, any MCP config,
     `npm install`, hand-editing the derived schema file, and anything under `docs/`.
3. **Apply.** `node docs/loops/t331/apply.cjs . docs/loops/t331/edits.txt` must print exactly
   `APPLIED 7 edits to 4 files`. Then
   `Copy-Item docs/loops/t331/t331-withheld-arm.test.ts open-brain/tests/trigger/t331-withheld-arm.test.ts`.
   In `open-brain`: `npx tsc --noEmit` (exit 0), `npx tsc -p tsconfig.tests.json --noEmit` (exit 0), `npm run build`
   (exit 0).
4. **Schema regenerates to the edited bytes.**
   - Stage the edited schema file only for this check: `git add open-brain/src/trigger/policies/recall-trigger.schema.json`.
   - In `open-brain`, run `npx tsx src/trigger/write-schema.ts` and paste its line.
   - From the clone root, run `git diff --exit-code open-brain/src/trigger/policies/recall-trigger.schema.json`, which
     compares the working tree with the staged edit. Paste the exit code. It must be 0.
   - **Not 0:** write-schema produced different bytes from the edit. STOP: paste the full diff, commit nothing and
     reply `BLOCKED t331 schema`. Never keep either version by hand.
   - **0:** `git reset -q open-brain/src/trigger/policies/recall-trigger.schema.json` (unstage it; step 8 stages
     everything together).
5. **New file.** In `open-brain`:
   `npx vitest run tests/trigger/t331-withheld-arm.test.ts --no-file-parallelism`. Expect `Tests 5 passed (5)`.
   Red-first was measured in the SIM and is not repeated.
6. **Mutants**, each on the applied tree.
   - Back up once: `Copy-Item open-brain/src/trigger/run.ts "$env:TEMP\t331-run.bak" -Force`.
   - For each of m1..m3: `node docs/loops/t331/apply.cjs . docs/loops/t331/<m>.txt` must print
     `APPLIED 1 edits to 1 files`. Then `npx tsc --noEmit` (exit 0) and the step-5 command. Paste the `Tests` line and
     the red row names.
   - Restore after each with `Copy-Item "$env:TEMP\t331-run.bak" open-brain/src/trigger/run.ts -Force`. Never use
     git checkout.
   - Predicted: **m1** turns W4 red only, **m2** turns W3 red only, **m3** turns W1 red only. After m3's restore, the
     step-5 command shows `Tests 5 passed (5)`.
   - A mutant whose red rows differ: STOP, `BLOCKED t331 <m> <rows>`.
7. **Wide run**, in `open-brain`:
   `npx vitest run tests/trigger tests/pipelines/session-start/t324-s3-trigger-counts.test.ts tests/audit-fix-a1-r5.test.ts tests/audit-fix-a1-r5-migration.test.ts tests/audit-fix-a1-r7-scrub.test.ts tests/audit-fix-a1-r8-scrub.test.ts tests/audit-fix-a1-r9-scrub.test.ts tests/t235-p2-5-cursor-recall.test.ts tests/t243-audit-lows.test.ts tests/t247-pins-scrub.test.ts tests/t294-small-fixes.test.ts tests/setup-hooks.test.ts tests/pipelines/sync --no-file-parallelism --testTimeout=180000`
   (40-minute cap). Expect 0 failed, subject to the exception rule. Paste `Test Files`, `Tests` and any `Errors` line,
   plus the full assertion message of any red row.
8. **Sync.** From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`.
   Paste every line; both must be `[pass]`.
9. **Commit.** One commit, `T331: recall trigger withheld arm, ships off (T-331)`.
   - Stage exactly the 5 paths: `open-brain/src/trigger/run.ts`, `open-brain/src/trigger/policy.ts`,
     `open-brain/src/trigger/policies/recall-trigger.json`, `open-brain/src/trigger/policies/recall-trigger.schema.json`
     and `open-brain/tests/trigger/t331-withheld-arm.test.ts`.
   - The message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <START>..HEAD` shows 1 line, and the status is empty (build output is ignored; if anything
     else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows exactly:
     `M open-brain/src/trigger/policies/recall-trigger.json`, `M open-brain/src/trigger/policies/recall-trigger.schema.json`,
     `M open-brain/src/trigger/policy.ts`, `M open-brain/src/trigger/run.ts`, `A open-brain/tests/trigger/t331-withheld-arm.test.ts`.
10. **Push and open the PR.**
    - Push, never force. `git ls-remote origin refs/heads/build/t331` must equal HEAD.
    - `gh pr create --base master --head build/t331 --title "T331: recall trigger withheld arm, ships off (T-331)" --body "Brief: docs/loops/t331-brief.md. Ships OFF (withhold_fraction 0)."`.
    - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion (CI runs on
      the tcm runners since T-330).

## Reply

- **First line:** `READY t331 <sha40> PR #<n>` or `BLOCKED t331 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild.sh <mergesha>`. Live check on the main build, against a COPY of the store (never the live DB):
- **Shipped OFF:** `loadPolicy()` from `open-brain/build/trigger/policy.js` returns `withhold_fraction: 0`.
- **Still injects:** `runTrigger` from `build/trigger/run.js`, on a scratch copy of knowledge-v2.db with the G-039
  command (`npx vitest run 2>&1 | tail -8; echo $?`) and the shipped policy, returns `state: 'injected'` with no
  `withheldIds`.
- **What's left:** turning the arm on (for example 0.5) is a one-line policy change that needs Aaron's word. The
  per-arm outcome count (`withheld` in triggerCounts) is a follow-up slice with Prism.
