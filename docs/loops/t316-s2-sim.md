# SIM T316-S2: MAYBE SHIPPED in the briefing - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-21, session 174. **Task:** T-316 S2 (P1). **Tag:** `sim-t316-s2`.

## What is measured

T-316 S1 made /sync's open-task-commits read the default branch too (measured on Makerspace: 8 named). S2 puts the
same match in the /start briefing, opt-in per repo (greeting.json `maybe_shipped`): one note,
`MAYBE SHIPPED (n): T-x T-y +k more, see /sync`, at most 64 chars. Legacy layout: its own line after the pick-up
notes. Budgeted layout: appended to the pick-up line and paid for out of the pick-up's 400-char cap, as T-302's
merged note is, so the budget does not grow. ob_start passes the record it renders. SIA turns the flag on.

Files under `docs/loops/t316-s2/`:
- `edits.txt`: 9 edits in 5 files. `open-brain/src/pipelines/sync/open-task-commits.ts` (the match moves into
  `scanOpenTaskCommits`; `checkOpenTaskCommits` keeps every message; new `describeMaybeShipped`,
  `MAYBE_SHIPPED_MAX_CHARS`), `session-start/briefing.ts`, `session-start/start-report.ts`,
  `session-start/greeting-flags.ts` (comment), `.agents/SYSTEM/greeting.json`.
- `tests.txt`: 5 edits in 2 files. `tests/pipelines/session-start/briefing-budget.test.ts` (the every-flag worst
  case also carries a 64-char note) and `tests/server.test.ts` (one new row through `handleStart`).
- `t316-s2.test.ts`: new file, goes to `open-brain/tests/pipelines/sync/t316-s2.test.ts`.
- `m1.txt` (the budgeted pick-up does not pay for the note), `m2.txt` (ob_start never passes it), `m3.txt` (the cap
  forgets the `, see /sync` tail), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The three files" means, from `open-brain`:
`npx vitest run tests/pipelines/sync/t316-s2.test.ts tests/pipelines/session-start/briefing-budget.test.ts tests/server.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `tests.txt`, `edits.txt`, `m1.txt`, `m2.txt`, `m3.txt`, `t316-s2.test.ts` under
   `docs/loops/t316-s2/`.
c. Baseline: `node docs/loops/t316-s2/apply.cjs . docs/loops/t316-s2/tests.txt` (paste output);
   `Copy-Item docs/loops/t316-s2/t316-s2.test.ts open-brain/tests/pipelines/sync/t316-s2.test.ts`. Run the three files.
   Paste the `Test Files` and `Tests` lines and every `x` row with its file.
d. From the clone root: `node docs/loops/t316-s2/apply.cjs . docs/loops/t316-s2/edits.txt` (paste output). In
   `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code
   and any error lines.
e. Run the three files. Paste the `Test Files` and `Tests` lines, every `x` row, and the `T302-WORST lines=... chars=...`
   console line.
f. `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/end-fix --no-file-parallelism --testTimeout=180000`
   (40-minute cap). Paste the `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the
   assertion message. Red rows only in files other than the three files, alongside T-292's `Timeout calling
   onTaskUpdate` or hook timeouts: re-run each such file alone and paste both. Do not fix anything.
g. The real record, from the clone root (it is SIA's own history, so this is also the cost):
   `node -e "import('./open-brain/build/pipelines/sync/open-task-commits.js').then(o=>{const t=JSON.parse(require('fs').readFileSync('.agents/state.json','utf8')).tasks;const s=Date.now();const r=o.describeMaybeShipped('.',t);console.log(JSON.stringify(r),'ms='+(Date.now()-s));})"`.
   Paste the line. Then `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "open-task-commits|module-boundary"`
   and paste both lines.
h. Mutants, on the applied tree. For each of m1, m2, m3: first back up the ONE file its `@@@` line names with
   `Copy-Item <file> "$env:TEMP\t316s2-<m>.bak"`; `node docs/loops/t316-s2/apply.cjs . docs/loops/t316-s2/<m>.txt`
   (paste output); run the three files; paste the `Tests` line and every `x` row; restore with
   `Copy-Item "$env:TEMP\t316s2-<m>.bak" <file> -Force`. Never use `git checkout` to restore here: the fix is not
   committed and git would discard it. After m3's restore, run the three files once more and paste the `Tests` line.

## Reply

First line: `READY sim-t316-s2 <HEAD sha8> ALL PASS` only if: c prints `APPLIED 5 edits to 2 files`; d prints
`APPLIED 9 edits to 5 files` and all three exit 0; e and the final run of h show 0 failed; f has 0 rows red alone;
g prints a JSON string starting `"MAYBE SHIPPED` or `null` (paste which), and the sync lines show `open-task-commits` in S1's
wording (`named by a code commit` or `0 open tasks named`, with `across HEAD and origin/master`) and
`module-boundary [pass]`; m1 reds at least t316-s2 R7, m2 reds the
server.test `T-316 S2` row, m3 reds t316-s2 R4. Otherwise `READY sim-t316-s2 <HEAD sha8> MISMATCH` and list each step
that differed. Every number is pasted output, with its command.
