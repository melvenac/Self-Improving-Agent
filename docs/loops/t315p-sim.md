# SIM T315P: the build proxy keeps the host's stdio across a rebuild - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-23, session 174. **Task:** T-315 (D-161), proxy slice. **Tag:** `sim-t315p`.

## What is measured

T-315 step 0 (docs/loops/t315-step0.md): Claude Code does not restart a stdio server that exits, and ESM re-import does
not reload a module graph. So a new `open-brain/src/build-proxy.ts` owns the host's stdio and runs build/server.js as a
child; on a new build stamp, with nothing in flight, it starts a new child, replays `initialize`/`initialized`, and stops
the old one. The child's parent is then the proxy, so `proofParentPid` (shared/process-session.ts) lets the server read
the host's proof only when OPEN_BRAIN_PROXY_PID is its actual parent. `_recalledKnowledgeIds` (written, never read) goes.

Files under `docs/loops/t315p/`:
- `build-proxy.ts`: new file, goes to `open-brain/src/build-proxy.ts`.
- `t315-proxy.test.ts`: new file, goes to `open-brain/tests/t315-proxy.test.ts`. P1-P9.
- `edits.txt`: 6 edits in 2 files (`open-brain/src/shared/process-session.ts`, `open-brain/src/server.ts`).
- `m1.txt` (proof ignores the proxy-pid check), `m2.txt` (swap ignores in-flight requests), `m3.txt` (no initialize
  replay), `m4.txt` (list_changed sent without comparing), `m5.txt` (server proof keeps process.ppid), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The five files" means, from `open-brain`:
`npx vitest run tests/t315-proxy.test.ts tests/t003-session-proof.test.ts tests/t003-r2.test.ts tests/t235-p2-3-cursor-proof.test.ts tests/shared/t315-s1.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `build-proxy.ts`, `t315-proxy.test.ts`, `edits.txt`, `m1.txt` .. `m5.txt` under
   `docs/loops/t315p/`.
c. Baseline: `Copy-Item docs/loops/t315p/t315-proxy.test.ts open-brain/tests/t315-proxy.test.ts`. Run the five files.
   Paste the `Test Files` and `Tests` lines and every `x` row or import error with its file and message.
d. `Copy-Item docs/loops/t315p/build-proxy.ts open-brain/src/build-proxy.ts`, then from the clone root
   `node docs/loops/t315p/apply.cjs . docs/loops/t315p/edits.txt` (paste output). In `open-brain`: `npx tsc --noEmit`,
   `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error lines. Then
   `Test-Path build/build-proxy.js` (paste).
e. Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/end-fix tests/t003-session-proof.test.ts tests/t003-r2.test.ts tests/qa142-t003.test.ts tests/t048-r3.test.ts tests/t235-p2-3-cursor-proof.test.ts tests/t315-proxy.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows only
   in files other than the five files, alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each
   such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` and paste
   every line.
h. Mutants, on the applied tree. The file is `open-brain/src/shared/process-session.ts` for m1,
   `open-brain/src/build-proxy.ts` for m2, m3 and m4, and `open-brain/src/server.ts` for m5. For each: back it up with
   `Copy-Item <file> "$env:TEMP\t315p-<m>.bak"`; `node docs/loops/t315p/apply.cjs . docs/loops/t315p/<m>.txt` (paste
   output); run the five files; paste the `Tests` line and every `x` row; restore with
   `Copy-Item "$env:TEMP\t315p-<m>.bak" <file> -Force`. Never use `git checkout` to restore here (build-proxy.ts is
   untracked). After m5's restore, run the five files once more and paste the `Tests` line.

## Reply

First line: `READY sim-t315p <HEAD sha8> ALL PASS` only if: c's only red file is t315-proxy.test.ts (it cannot import
build-proxy.js); d prints `APPLIED 6 edits to 2 files`, all three exit 0 and `Test-Path` is True; e and the final run of
h show 0 failed; f has 0 rows red alone; g shows `module-boundary [pass]`; m1 reds P7 and P9 only; m2 reds P3 only; m3
reds P2, P5 and P6 only; m4 reds P5 only; m5 reds P9 only. Otherwise `READY sim-t315p <HEAD sha8> MISMATCH` and list
each step that differed, with the full assertion message of every red row. Every number is pasted output, with its
command.
