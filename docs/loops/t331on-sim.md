# SIM T331-ON: turn the recall trigger's withheld arm on (withhold_fraction 0.5) - measure which rows flip

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-01, session 175. **Task:** T-331. **Tag:** `sim-t331on`. **Base:** the START sha the
launcher names (origin/master containing this file). **Authority:** Aaron, 11-01, AskUserQuestion in clark's window:
"Yes, turn it on (Recommended)". Aaron named no value; 0.5 is the research figure (docs/loops/rsi-research-2026-10-31.md).

```text
IMPACT-TARGETS: loadPolicy (trigger/policy.ts), runTrigger (trigger/run.ts) - behaviour only, no code change
```

## What is measured

Two edits (`docs/loops/t331on/edits.txt`): `recall-trigger.json` `withhold_fraction` 0 -> 0.5, and row W3 of
`tests/trigger/t331-withheld-arm.test.ts` re-pinned from 0 to 0.5. No src code changes.

The arm is drawn per (session uuid, ids) by `withholdDraw` (sha256, deterministic). Tests that use the SHIPPED policy
(`loadPolicy()`, or the hook reading `recall-trigger.json` from disk) and expect an injection now pass or fail on that
draw for their fixed session uuid: about half of them could flip. Known users of the shipped policy:
`tests/trigger/hook.test.ts` (SESSION `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, spawns the hook), `tests/trigger/floor.test.ts`,
`tests/trigger/no-network.test.ts` (SESSION `no-net00-0000-0000-0000-000000000000`). There may be others. **This run
finds them; it is a measurement, so a red row is a result, not a failure of the run.**

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `docs/loops/t331on/apply.cjs` and `docs/loops/t331on/edits.txt`.
c. Baseline, before the edits, in `open-brain`: `npx vitest run tests/trigger/t331-withheld-arm.test.ts --no-file-parallelism`.
   Paste the `Tests` line (predicted `Tests 5 passed (5)`).
d. From the clone root `node docs/loops/t331on/apply.cjs . docs/loops/t331on/edits.txt` (paste output; predicted
   `APPLIED 2 edits to 2 files`). In `open-brain`: `npm run build` (paste exit code). Then
   `npx tsx src/trigger/write-schema.ts` and from the clone root `git diff --stat open-brain/src/trigger/policies/recall-trigger.schema.json`
   (predicted: empty, a value is not a schema change).
e. In `open-brain`:
   `npx vitest run tests/trigger tests/pipelines/session-start/t324-s3-trigger-counts.test.ts tests/audit-fix-a1-r5.test.ts tests/audit-fix-a1-r5-migration.test.ts tests/audit-fix-a1-r7-scrub.test.ts tests/audit-fix-a1-r8-scrub.test.ts tests/audit-fix-a1-r9-scrub.test.ts tests/t235-p2-5-cursor-recall.test.ts tests/t243-audit-lows.test.ts tests/t247-pins-scrub.test.ts tests/t294-small-fixes.test.ts tests/setup-hooks.test.ts --no-file-parallelism --testTimeout=180000`
   (30-minute cap). Paste `Test Files`, `Tests`, any `Errors` line, and EVERY `x` row with its file and full assertion
   message. Re-run each red file alone once and paste that run (a draw is deterministic, so a real flip stays red;
   a timeout that goes green is T-292's flake: say which).
f. Find every other test that reads the shipped policy: from the clone root
   `git grep -n -e "loadPolicy()" -e "recall-trigger.json" -- open-brain/tests` and paste the output. For each file it
   lists that step e did not run, run it alone and paste `Tests` and every `x` row.
g. For each red row from e or f, open the test and report: the session uuid it uses, the ids it expects injected,
   and the exact line that asserts the injection (file:line plus the line text). Compute the draw with
   `node -e "const c=require('crypto');const h=c.createHash('sha256').update(process.argv[1]).digest('hex').slice(0,8);console.log(parseInt(h,16)/0x100000000)" "<uuid>:<ids comma-joined>"`
   and paste it (a draw below 0.5 is withheld).
h. Full wide run, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap). Paste
   `Test Files`, `Tests`, any `Errors` line and every `x` row not already listed.
i. Restore nothing; do not commit. Final `git status --porcelain` (paste).

## Predicted

- c: 5 passed. d: `APPLIED 2 edits to 2 files`, build 0, schema stat empty.
- e/f: W3 green; W1, W2, W4, W5 green (they set the fraction explicitly). Unknown: rows using the shipped policy with a
  draw below 0.5. That list is the result.

## Reply

First line: `READY sim-t331on <HEAD sha8> MEASURED <n> red row(s)`, then the steps' pasted output, then a table of
red rows: file, row name, uuid, ids, draw, asserting line. Every number is pasted output, with its command.
