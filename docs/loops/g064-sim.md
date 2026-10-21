# SIM G064: the bootstrap scaffold declares the one seat developer - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-21, session 174. **Gap:** G-064. **Tag:** `sim-g064`.

## What is measured

G-064: `bootstrap scaffold` wrote `.agents/AGENT.md` with `role: none`, so a single-agent project's checkout could never
be shown its own handoff (set_handoff takes only planner/developer/qa; ob_start names no handoff as "yours" while the
reader's seat is unresolved). Measured on mail-server, 10-20. The scaffold now declares the one seat `developer`, the
seat the import already assumes for the handoff (T-251). A checkout that still declares `role: none` is told how to
become the developer seat.

Files under `docs/loops/g064/`:
- `edits.txt`: 5 edits in 4 files: `open-brain/src/pipelines/bootstrap/index.ts` (2: SCAFFOLD_FILES' why, `agentMd`),
  `open-brain/src/pipelines/session-start/role-files.ts` (1: the NOT A SEAT advice line),
  `project-template/.claude/commands/bootstrap.md` (1), `README.md` (1).
- `tests.txt`: 3 edits in 2 files: `open-brain/tests/pipelines/t272-seat-checkout.test.ts` S2 and S5 (role: developer),
  `open-brain/tests/pipelines/bootstrap-fix.test.ts` (the fresh install's ob_start: `Seat: ... (developer)`, no NOT A
  SEAT, no unresolved reader).
- `g064-developer-seat.test.ts`: new file, goes to `open-brain/tests/pipelines/g064-developer-seat.test.ts`. G1-G4.
- `m1.txt` (agentMd writes role: none again), `m2.txt` (the advice line loses its fix), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The three files" means, from `open-brain`:
`npx vitest run tests/pipelines/g064-developer-seat.test.ts tests/pipelines/t272-seat-checkout.test.ts tests/pipelines/bootstrap-fix.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `tests.txt`, `edits.txt`, `m1.txt`, `m2.txt`, `g064-developer-seat.test.ts` under
   `docs/loops/g064/`.
c. Baseline: `node docs/loops/g064/apply.cjs . docs/loops/g064/tests.txt` (paste output);
   `Copy-Item docs/loops/g064/g064-developer-seat.test.ts open-brain/tests/pipelines/g064-developer-seat.test.ts`. Run the
   three files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root: `node docs/loops/g064/apply.cjs . docs/loops/g064/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the three files. Paste the `Test Files` and `Tests` lines and every `x` row.
f. `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/end-fix --no-file-parallelism --testTimeout=180000`
   (40-minute cap). Paste the `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the
   assertion message. Red rows only in files other than the three files, alongside T-292's `Timeout calling
   onTaskUpdate` or hook timeouts: re-run each such file alone and paste both. Do not fix anything.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "FAIL|ISSUE|parity|mirror"`.
   Paste every line.
h. Mutants, on the applied tree. For each of m1, m2: first back up the ONE file its `@@@` line names with
   `Copy-Item <file> "$env:TEMP\g064-<m>.bak"`; `node docs/loops/g064/apply.cjs . docs/loops/g064/<m>.txt` (paste
   output); run the three files; paste the `Tests` line and every `x` row; restore with
   `Copy-Item "$env:TEMP\g064-<m>.bak" <file> -Force`. Never use `git checkout` to restore here: the fix is not
   committed and git would discard it. After m2's restore, run the three files once more and paste the `Tests` line.

## Reply

First line: `READY sim-g064 <HEAD sha8> ALL PASS` only if: c prints `APPLIED 3 edits to 2 files` and its red rows are
only G1-G4, t272 S2 and S5, and the bootstrap-fix whole-path row; d prints `APPLIED 5 edits to 4 files` and all three
exit 0; e and the final run of h show 0 failed; f has 0 rows red alone; g shows no FAIL or ISSUE line that names a
file this change touches; m1 reds at least G1 and G2; m2 reds G4. Otherwise `READY sim-g064 <HEAD sha8> MISMATCH` and
list each step that differed. Every number is pasted output, with its command.
