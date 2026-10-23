# SIM G062: READS OWED leaves out a file this seat wrote - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-22, session 174. **Gap:** G-062 part (a). **Tag:** `sim-g062`.

## What is measured

G-062: READS OWED keeps listing a brief the reading seat wrote itself (Atlas S174's greeting listed
docs/loops/t318-s1-brief.md, written in S174). Every commit's git author is Aaron, so authorship comes from the
Claude-Session trailer (T-276). Measured on the desktop 10-22: the previous session of a checkout has its transcript
beside the current one as `<uuid>.jsonl` (sia-planner s173: 147 MB), and its bridge record sits at byte 459, inside the
256 KB head; each brief's newest commit carries the writing session's bridge id (`session_<X>` for `cse_<X>`).

The fix, OPT-IN per repo (greeting.json `reads_owed_own`, default off; SIA's greeting.json turns it on):
`ownTrailerIds` = this session's trailer ids (proven transcript) + the newest other session of this checkout (its
transcript read head-only, a new `headOnly` option on `sessionTrailerIds`). `describeReadsOwed` takes them as an
optional 6th argument and leaves out a path whose newest commit's trailer carries one; with nothing left it prints
`READS OWED: none (<k> written by this seat)`.

Files under `docs/loops/g062/`:
- `edits.txt`: 11 edits in 5 files: `open-brain/src/shared/handoff-guard.ts` (headOnly),
  `open-brain/src/pipelines/session-start/reads-owed.ts` (newestTrailer, ownTrailerIds, the ownIds argument),
  `open-brain/src/pipelines/session-start/start-report.ts` (import and the gated call),
  `open-brain/src/pipelines/session-start/greeting-flags.ts` (the key list comment), `.agents/SYSTEM/greeting.json`
  (`"reads_owed_own": true`).
- `g062-reads-owed.test.ts`: new file, goes to `open-brain/tests/pipelines/session-start/g062-reads-owed.test.ts`. O1-O5.
- `m1.txt` (own ids ignored), `m2.txt` (earlier transcript read in full), `m3.txt` (the OLDEST other session counts),
  `m4.txt` (no opt-in gate), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The four files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/g062-reads-owed.test.ts tests/pipelines/session-start/briefing-fix.test.ts tests/pipelines/session-start/t161-transcript.test.ts tests/t276-session-trailer.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `edits.txt`, `g062-reads-owed.test.ts`, `m1.txt`, `m2.txt`, `m3.txt`, `m4.txt`
   under `docs/loops/g062/`.
c. Baseline: `Copy-Item docs/loops/g062/g062-reads-owed.test.ts open-brain/tests/pipelines/session-start/g062-reads-owed.test.ts`.
   Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message
   (a file that fails to import counts: paste its error line).
d. From the clone root `node docs/loops/g062/apply.cjs . docs/loops/g062/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/end-fix tests/t276-session-trailer.test.ts tests/t317-s1.test.ts tests/t317-s2.test.ts tests/t317-s3.test.ts tests/t318-s2.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground or a timeout of at least 40 minutes). Paste the `Test Files`, `Tests` and any `Errors`
   lines and every `x` row with its file and the assertion message. Red rows only in files other than the four files,
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|FAIL"` and
   paste every line.
h. Mutants, on the applied tree. For each of m1, m2, m3, m4: the file is
   `open-brain/src/pipelines/session-start/reads-owed.ts` for m1, m2 and m3, and
   `open-brain/src/pipelines/session-start/start-report.ts` for m4. Back it up with
   `Copy-Item <file> "$env:TEMP\g062-<m>.bak"`; `node docs/loops/g062/apply.cjs . docs/loops/g062/<m>.txt` (paste
   output); run the four files; paste the `Tests` line and every `x` row; restore with
   `Copy-Item "$env:TEMP\g062-<m>.bak" <file> -Force`. Never use `git checkout` to restore here. After m4's restore,
   run the four files once more and paste the `Tests` line.

## Reply

First line: `READY sim-g062 <HEAD sha8> ALL PASS` only if: c's only red file is g062-reads-owed.test.ts; d prints
`APPLIED 11 edits to 5 files` and all three exit 0; e and the final run of h show 0 failed; f has 0 rows red alone;
g shows `module-boundary [pass]` and no FAIL line; m1 reds O1, O2 and O5; m2 reds O4 only; m3 reds O3 only; m4 reds O5
only. Otherwise `READY sim-g062 <HEAD sha8> MISMATCH` and list each step that differed, with the full assertion
message of every red row. Every number is pasted output, with its command.
