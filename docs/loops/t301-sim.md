# SIM T301: the heavy-suite run prints its owner, lease and census - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-301 (P3). **Tag:** `sim-t301`.

## What is measured

`open-brain/src/cli-suite-run.ts` (the T-168 heavy-suite wrapper) prints only `suite seat: ...`; the owner, the lease
take/release and the census reach only suite-run-meta.json (T-168's Cursor half, finding 2). The edit prints three
lines after the meta file is written and before any refusal: `suite owner: pid <n> (<source>)` or
`suite owner: none (<reason>)`; `suite lease: <status> (take exit <n|none>, release exit <n|none>)`;
`suite census: available, busy SIA: <names|none>` or the census's own `census unavailable: ...` reason.

Files under `docs/loops/t301/`: `t301-suite-lines.test.ts` (new file, goes to
`open-brain/tests/t301-suite-lines.test.ts`, L1-L5), `edits.txt` (1 edit in `open-brain/src/cli-suite-run.ts`),
`m1.txt` (busy SIA always none), `m2.txt` (release exit never printed), `m3.txt` (owner reason dropped), `m4.txt`
(census reason dropped), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The five files" means, from `open-brain`:
`npx vitest run tests/t301-suite-lines.test.ts tests/suite-run-meta.test.ts tests/t168-seat-resolve.test.ts tests/t168-owner-wired.test.ts tests/t268-owner-session-proof.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `t301-suite-lines.test.ts`, `edits.txt`, `m1.txt` .. `m4.txt` under
   `docs/loops/t301/`.
c. Baseline: `Copy-Item docs/loops/t301/t301-suite-lines.test.ts open-brain/tests/t301-suite-lines.test.ts`. Run the
   five files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t301/apply.cjs . docs/loops/t301/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/t301-suite-lines.test.ts tests/suite-run-meta.test.ts tests/t168-seat-resolve.test.ts tests/t168-owner-wired.test.ts tests/t268-owner-session-proof.test.ts tests/t270-table-control-chars.test.ts tests/t283-suite-vitest-args.test.ts tests/shared --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows only
   in files other than the five files, alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each
   such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` and paste
   every line.
h. Mutants, on the applied tree; the file is `open-brain/src/cli-suite-run.ts` for all four. Back it up once with
   `Copy-Item <file> "$env:TEMP\t301-fixed.bak"`. For each of m1..m4:
   `node docs/loops/t301/apply.cjs . docs/loops/t301/<m>.txt` (paste output); run the five files; paste the `Tests`
   line and every `x` row; restore with `Copy-Item "$env:TEMP\t301-fixed.bak" <file> -Force`. Never use
   `git checkout` to restore here (it would also remove the fix). After m4's restore, run the five files once more and
   paste the `Tests` line.

## Reply

First line: `READY sim-t301 <HEAD sha8> ALL PASS` only if: c's only red rows are L1-L5 in t301-suite-lines.test.ts;
d prints `APPLIED 1 edits to 1 files` and all three exit 0; e and the final run of h show 0 failed; f has 0 rows red
alone; g shows `module-boundary [pass]`; m1 reds L2 only; m2 reds L1 only; m3 reds L4 only; m4 reds L3 only. Otherwise
`READY sim-t301 <HEAD sha8> MISMATCH` and list each step that differed, with the full assertion message of every red
row. Every number is pasted output, with its command.

Round 2 (job #87 at 7e6b439b was MISMATCH on L2 and L3 only, on the exit status, not on the printed lines):
decideSuiteStart refuses on a busy or unavailable census only for a controlled rerun. L2 now sets
OPEN_BRAIN_CONTROLLED_RERUN=1 and expects exit 2; L3 expects exit 0. Every printed line matched in round 1.
