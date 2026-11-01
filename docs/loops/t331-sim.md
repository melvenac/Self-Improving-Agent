# SIM T331: the recall trigger's withheld arm, shipped OFF - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-31, session 175. **Task:** T-331 (RSI research idea #1: a counterfactual arm, so the
PRD's open question "does an injection change behaviour?" gets a comparison). **Tag:** `sim-t331`. **Base:** the START
sha the launcher names (origin/master `3cf95a01` or later, containing this file). **Authority:** clark's 10-31 relay of
Aaron ("pick up any downstream work that's available"). The arm ships OFF (`withhold_fraction: 0`); turning it on is
Aaron's ruling, not this task's.

```text
IMPACT-TARGETS: runTrigger (trigger/run.ts; caller cli-recall-trigger.ts main), TriggerPolicySchema (trigger/policy.ts;
callers loadPolicy, write-schema.ts, policyJsonSchema)
```

## What is measured

The design, all in the existing policy file and run.ts:

1. **Knob:** `withhold_fraction` in `TriggerPolicySchema` (`z.number().min(0).max(1).optional()`), set to `0` in
   `src/trigger/policies/recall-trigger.json`. Absent or 0 is off. The derived `recall-trigger.schema.json` gains the
   field (computed with zod 4.3.6's `toJSONSchema`, the same call `write-schema.ts` makes; floor.test.ts compares the
   bytes).
2. **Draw:** `withholdDraw(sessionUuid, ids)` is the first 8 hex digits of `sha256("<session>:<ids>")` divided by
   2^32, in [0, 1). It's deterministic and keyed on session and ids, not on the command, so one entry is withheld for a
   whole session or not at all.
3. **Withheld fire:** when `withholdDraw(...) < withhold_fraction`, runTrigger records a **silent** fire whose query
   carries `withheld:<ids>` (the `seat-skip:` pattern), `injected_ids` `[]`, and no recall_log row or counter bump. It
   returns `{state: 'silent', ids: [], withheldIds}` with no additionalContext.
4. **No migration:** `trigger_fires.state` has `CHECK(state IN ('not-asked','silent','injected'))` (db-v2.ts:89). A 4th
   state would need a table rebuild, so the token rides in `query` instead. A real 4th state is a follow-up only if
   Aaron wants one.
5. **Not in this task (follow-up):** per-arm outcome reporting. `greeting-outcome.ts` `triggerCounts` counts the query
   tokens (seat-skip, path-match, error-match), but its exact shape is Prism's dashboard contract (T-324 S3, pinned by
   `toEqual` in t324-s3-trigger-counts.test.ts), so a `withheld` count goes there in its own slice, agreed with Prism.

Files under `docs/loops/t331/`:
- `t331-withheld-arm.test.ts`: new file, goes to `open-brain/tests/trigger/t331-withheld-arm.test.ts`. Rows W1-W5.
- `edits.txt`: 7 edits in 4 files. `run.ts` 4 (the crypto import, `withheldIds` on TriggerOutcome, `withholdDraw`, the
  withheld branch); `policy.ts` 1; `recall-trigger.json` 1; `recall-trigger.schema.json` 1.
- `m1.txt` (strict cut `<` becomes `<=`), `m2.txt` (an absent fraction means 1, not 0), `m3.txt` (the `withheld:`
  token dropped from the query), `apply.cjs` (same applier as t330).

Planner pre-check (desktop, text only, no tests run): `apply.cjs` on base copies of the 4 files printed
`APPLIED 7 edits to 4 files`; m1, m2, m3 each `APPLIED 1 edits to 1 files` on the edited copies. The edited
schema file is byte-identical to zod's `toJSONSchema` output for the new contract.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/trigger/floor.test.ts` derived-schema drift row | stays green with the edit | The schema file edit is zod's exact output; without it this row would go red. |
| `tests/trigger/floor.test.ts` strict/typo, R19 provenance, floor rows | stays green | Field optional; provenance and floor unchanged; `relevence_floor` is still an unknown key. |
| `tests/trigger/fires.test.ts` (all) | stays green | Its `TriggerPolicy` literals have no `withhold_fraction`: off, so every injection is unchanged. |
| `tests/trigger/hook.test.ts` | stays green | Spreads `loadPolicy()` (fraction 0). |
| `tests/trigger/t159-fast-path.test.ts` N1b | stays green | `node:crypto` is imported by run.ts, which is on the asked path only (not one of the fast-path modules N1b checks). |
| `tests/trigger/no-network.test.ts`, negatives, query, t170-*, t265, t286, t288, t290, t313 | stays green | No withheld fraction set; the injected/silent paths are unchanged. |
| `tests/pipelines/session-start/t324-s3-trigger-counts.test.ts` | stays green | triggerCounts unchanged (see 5 above). |
| audit-fix-a1-r5*, a1-r7/r8/r9-scrub, t235-p2-5, t243, t247, t294, setup-hooks | stays green | None sets the fraction; the scrubs read `command`, not `query`. |

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t331/`.
c. Baseline: `Copy-Item docs/loops/t331/t331-withheld-arm.test.ts open-brain/tests/trigger/t331-withheld-arm.test.ts`.
   In `open-brain`: `npx vitest run tests/trigger/t331-withheld-arm.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
d. From the clone root `node docs/loops/t331/apply.cjs . docs/loops/t331/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines. Then `npx tsx src/trigger/write-schema.ts` (paste its line) and from the clone root
   `git diff --stat open-brain/src/trigger/policies/recall-trigger.schema.json` (paste). Regenerating leaves the
   edited file as it was, so the stat is still `1 file changed, 5 insertions(+)`.
e. In `open-brain`: the new file again (0 failed), then
   `npx vitest run tests/trigger tests/pipelines/session-start/t324-s3-trigger-counts.test.ts tests/audit-fix-a1-r5.test.ts tests/audit-fix-a1-r5-migration.test.ts tests/audit-fix-a1-r7-scrub.test.ts tests/audit-fix-a1-r8-scrub.test.ts tests/audit-fix-a1-r9-scrub.test.ts tests/t235-p2-5-cursor-recall.test.ts tests/t243-audit-lows.test.ts tests/t247-pins-scrub.test.ts tests/t294-small-fixes.test.ts tests/setup-hooks.test.ts --no-file-parallelism --testTimeout=180000`
   (30-minute cap). Paste `Test Files`, `Tests`, any `Errors` line and every `x` row. Red rows alongside T-292's
   `Timeout calling onTaskUpdate` or hook timeouts (known flaky: t159-fast-path N3, hub-presence, end-fix-q3): re-run
   each such file alone up to 3 times and paste every run.
f. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`;
   paste every line.
g. Mutants, on the applied tree. Back up once:
   `Copy-Item open-brain/src/trigger/run.ts "$env:TEMP\t331-run.bak" -Force`. For each of m1..m3:
   `node docs/loops/t331/apply.cjs . docs/loops/t331/<m>.txt` (paste output); in `open-brain` `npx tsc --noEmit`
   (paste exit code), then ONLY `npx vitest run tests/trigger/t331-withheld-arm.test.ts --no-file-parallelism`;
   paste the `Tests` line and every `x` row; restore with
   `Copy-Item "$env:TEMP\t331-run.bak" open-brain/src/trigger/run.ts -Force`. Never use `git checkout` to restore.
   After m3's restore, run the new file once more and paste the `Tests` line.

## Predicted

- c: 4 red (W1, W3, W4, W5), 1 green (W2: fraction 0 injects, as today). W1 is red on `state` (the field is ignored, so
  it injects), W3 on `loadPolicy().withhold_fraction` (undefined), W4 and W5 on `withholdDraw is not a function`. If
  the file instead fails to LOAD on the missing export (`does not provide an export named 'withholdDraw'`), report it
  and count that as the same red-first; say which one happened.
- d: `APPLIED 7 edits to 4 files`; all three exit 0; write-schema leaves the schema file as edited.
- e: 0 failed (subject to the flaky rule).
- f: `module-boundary [pass]`, `retirements [pass]`.
- g: each mutant tsc exit 0. m1 -> W4 only (the boundary row: a fraction equal to the draw withholds). m2 -> W3 only
  (an absent fraction withholds). m3 -> W1 only (no `withheld:` token).

## Reply

First line: `READY sim-t331 <HEAD sha8> ALL PASS` only if every prediction held and e has 0 rows red alone. Otherwise
`READY sim-t331 <HEAD sha8> MISMATCH`, listing each step that differed with the full assertion message of every red
row. Every number is pasted output, with its command.

## After merge (not this run)

sia-rebuild. Live: `loadPolicy()` on the main build reports `withhold_fraction: 0`, and the next injected fire is
unchanged. Turning the arm on (for example 0.5) is a one-line policy-file change that needs Aaron's word. The
per-arm outcome count is a follow-up slice with Prism.
