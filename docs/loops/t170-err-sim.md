# SIM T170-ERR: the recall trigger reads `MATCH: error:` keys on a failed shell call - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-170 part (ii), error keys (P1). **Tag:** `sim-t170err`.

## What is measured

/end step 2 keys a lesson `MATCH: command|path|error|none`, and the trigger reads only command keys. On 10-24 the live
store held 30 lessons keyed `MATCH: error: "..."` (e.g. 659, PowerShell's `Variable reference is not valid` parse
error), and none could ever fire, although Claude Code hands a failed Bash or PowerShell call's text to the hook as
PostToolUseFailure's top-level `error` field (measured, docs/loops/t170-ii/research-reply.md and powershell-reply.md).
Desktop measurement (read-only, live store): the parse rule below reads all 30 keys as usable text, 0 unusable.

The edit (13 edits in 4 files):
- `trigger/match-keys.ts`: `parseErrorKey` (the double-quoted text after `MATCH: error:`, `\"` and `\\` undone,
  whitespace folded, under 6 characters is null), `errorMatchesKey` (a substring of the error text, whitespace folded,
  case-sensitive), `readTriggerErrorKeys`, `matchingErrorKeyIds` (longest first). The header comment says so.
- `trigger/keys-writer.ts`: the sidecar gains `errorKeys: [{id, text}]` beside `keys`; the returned counts are
  unchanged (still the command keys').
- `cli-recall-trigger.ts`: on a payload with a string `error`, the sidecar's error keys are matched against it; a
  match makes the call asked, and `error` and `errorKeyIds` go to `runTrigger`.
- `trigger/run.ts`: each error-key id is re-read from the store and re-tested against the error text (a stale sidecar
  costs a miss, never a wrong injection), before the command keys (with one slot, the failure's own text names the
  mistake more exactly); the fire's query gains `error-match:<ids>`. Seat filtering (T-313) and once-per-session
  apply as for command keys.

Files under `docs/loops/t170-err/`: `t170-error-keys.test.ts` (new file, goes to
`open-brain/tests/trigger/t170-error-keys.test.ts`; K1-K8), `edits.txt`, `m1.txt` (no re-test), `m2.txt` (the hook
ignores `error`), `m3.txt` (no errorKeys written), `m4.txt` (error keys never go first), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The four files" means, from `open-brain`:
`npx vitest run tests/trigger/t170-error-keys.test.ts tests/trigger/t170-match-keys.test.ts tests/trigger/t170-ii-failure-event.test.ts tests/trigger/t313-seat.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `t170-error-keys.test.ts`, `edits.txt`, `m1.txt` .. `m4.txt` under
   `docs/loops/t170-err/`.
c. Baseline: `Copy-Item docs/loops/t170-err/t170-error-keys.test.ts open-brain/tests/trigger/t170-error-keys.test.ts`.
   Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t170-err/apply.cjs . docs/loops/t170-err/edits.txt` (paste output). In
   `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code
   and any error lines.
e. Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/trigger tests/setup-hooks.test.ts tests/t235-p2-5-cursor-recall.test.ts tests/t294-small-fixes.test.ts tests/t243-audit-lows.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` and paste
   every line.
h. Mutants, on the applied tree. Back up the three files the mutants touch once:
   `Copy-Item open-brain/src/trigger/run.ts "$env:TEMP\t170e-run.bak"`,
   `Copy-Item open-brain/src/cli-recall-trigger.ts "$env:TEMP\t170e-hook.bak"`,
   `Copy-Item open-brain/src/trigger/keys-writer.ts "$env:TEMP\t170e-writer.bak"`. For each of m1..m4:
   `node docs/loops/t170-err/apply.cjs . docs/loops/t170-err/<m>.txt` (paste output); run the four files; paste the
   `Tests` line and every `x` row; restore all three from their backups with `Copy-Item ... -Force`. Never use
   `git checkout` to restore here (it would also remove the fix). After m4's restore, run the four files once more and
   paste the `Tests` line.

## Reply

First line: `READY sim-t170err <HEAD sha8> ALL PASS` only if: c's red rows are K1-K7 in t170-error-keys.test.ts and
nothing else (K8 green); d prints `APPLIED 13 edits to 4 files` and all three exit 0; e and the final run of h show 0
failed; f has 0 rows red alone; g shows `module-boundary [pass]`; m1 reds K5 only; m2 reds K7 only; m3 reds K3 and K7
only; m4 reds K6 only. Otherwise `READY sim-t170err <HEAD sha8> MISMATCH` and list each step that differed, with the
full assertion message of every red row. Every number is pasted output, with its command.
