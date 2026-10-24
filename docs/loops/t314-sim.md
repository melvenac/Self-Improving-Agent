# SIM T314: `open-brain start --read-only` writes nothing a real start reads - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-314 (P3). **Tag:** `sim-t314`.

## What is measured

Seats run `node <main>/open-brain/build/cli.js start <dir>` as a read-only check, and each run creates a session log,
taking the next session number (twice on one evening, s173). The edit adds `--read-only` to `start`: the report still
prints, and no session log, no role-read record (`.agents/role-reads.local.json`) and no greeting-metrics row are
written. Without the flag nothing changes. One existing row changes: `tests/shared/cli-args.test.ts` "a command with no
flags says so" used `COMMAND_SPECS.start`, which now has a flag, so it uses a bare spec instead.

Files under `docs/loops/t314/`: `t314-start-read-only.test.ts` (new file, goes to
`open-brain/tests/t314-start-read-only.test.ts`; R1-R5), `edits.txt` (10 edits in 6 files: cli-spec.ts, cli.ts,
session-start/types.ts, session-start/index.ts, session-start/start-report.ts, tests/shared/cli-args.test.ts), `m1.txt`
(the log is created anyway), `m2.txt` (role reads recorded anyway), `m3.txt` (metrics written anyway), `m4.txt` (the
CLI never passes the flag on), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The four files" means, from `open-brain`:
`npx vitest run tests/t314-start-read-only.test.ts tests/shared/cli-args.test.ts tests/t154-cli-start.test.ts tests/pipelines/session-start/role-docs-by-sha.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `t314-start-read-only.test.ts`, `edits.txt`, `m1.txt` .. `m4.txt` under
   `docs/loops/t314/`.
c. Baseline: `Copy-Item docs/loops/t314/t314-start-read-only.test.ts open-brain/tests/t314-start-read-only.test.ts`.
   Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t314/apply.cjs . docs/loops/t314/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/pipelines/session-start tests/shared tests/t154-cli-start.test.ts tests/server.test.ts tests/cli-bootstrap.test.ts tests/pipelines/sync/start-parity.test.ts tests/t314-start-read-only.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` and paste
   every line. Then, as a live probe on the clone itself:
   `$before = (Get-ChildItem .agents/SESSIONS -Filter 'Session_*.md').Count`;
   `node open-brain/build/cli.js start --read-only . | Select-String -Pattern "Session log:"`;
   `$after = (Get-ChildItem .agents/SESSIONS -Filter 'Session_*.md').Count`; paste the line and `$before $after`
   (must be equal), then `git status --porcelain` (must show only the applied edits and the copied test, nothing under
   `.agents/`).
h. Mutants, on the applied tree. Back up the two files the mutants touch besides cli.ts once:
   `Copy-Item open-brain/src/pipelines/session-start/index.ts "$env:TEMP\t314-index.bak"`,
   `Copy-Item open-brain/src/pipelines/session-start/start-report.ts "$env:TEMP\t314-report.bak"`,
   `Copy-Item open-brain/src/cli.ts "$env:TEMP\t314-cli.bak"`. For each of m1..m4:
   `node docs/loops/t314/apply.cjs . docs/loops/t314/<m>.txt` (paste output); run the four files; paste the `Tests`
   line and every `x` row; restore all three with `Copy-Item "$env:TEMP\t314-<name>.bak" <file> -Force`. Never use
   `git checkout` to restore here (it would also remove the fix). After m4's restore, run the four files once more and
   paste the `Tests` line.

## Reply

First line: `READY sim-t314 <HEAD sha8> ALL PASS` only if: c's red rows are R1, R2, R3 and R5 in
t314-start-read-only.test.ts and nothing else; d prints `APPLIED 10 edits to 6 files` and all three exit 0; e and the
final run of h show 0 failed; f has 0 rows red alone; g shows `module-boundary [pass]`, the `Session log: not created:
read-only start (--read-only)` line and equal counts; m1 reds R1 and R5 only; m2 reds R2 only; m3 reds R3 only; m4
reds R5 only. Otherwise `READY sim-t314 <HEAD sha8> MISMATCH` and list each step that differed, with the full
assertion message of every red row. Every number is pasted output, with its command.
