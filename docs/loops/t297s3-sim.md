# SIM T297S3: the Working tree line names this session's own log; the template ignores settings backups

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-297 step 3 (P2). **Tag:** `sim-t297s3`.

## What is measured

Relay's s43 greeting listed SIA's own local files as uncommitted work ('7 uncommitted', 5 of them SIA's). Two changes,
per the T-297 note's corrected scope (never ignore session logs: A2A tracks them):
1. `describeWorkingTree` (briefing.ts) takes this session's log path and labels that one path
   `<path> (this session's log)`; start-report.ts passes `result.session.logPath`. Nothing is hidden; no other path is
   labelled; with no log the line is byte-identical.
2. `project-template/gitignore` gains `/.claude/*.bak-*` (the backups an installer leaves beside a settings file). The
   other two safe paths (`.agents/SESSIONS/.missing-handoff.shown.jsonl`, `.agents/role-reads.local.json`) are already
   ignored by the template's `.agents` allowlist.

Files under `docs/loops/t297s3/`: `t297-s3-working-tree.test.ts` (new file, goes to
`open-brain/tests/pipelines/session-start/t297-s3-working-tree.test.ts`; W1-W5), `edits.txt` (3 edits in 3 files),
`m1.txt` (no label), `m2.txt` (start-report passes no log), `m3.txt` (the ignore line matches nothing), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The four files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/t297-s3-working-tree.test.ts tests/pipelines/session-start/briefing.test.ts tests/pipelines/import-cmds-r2-l1.test.ts tests/pipelines/template-seed.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `t297-s3-working-tree.test.ts`, `edits.txt`, `m1.txt` .. `m3.txt` under
   `docs/loops/t297s3/`.
c. Baseline: `Copy-Item docs/loops/t297s3/t297-s3-working-tree.test.ts open-brain/tests/pipelines/session-start/t297-s3-working-tree.test.ts`.
   Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t297s3/apply.cjs . docs/loops/t297s3/edits.txt` (paste output). In
   `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code
   and any error lines.
e. Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/pipelines tests/t154-cli-start.test.ts tests/server.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` and paste
   every line.
h. Mutants, on the applied tree. Back up the three edited files once:
   `Copy-Item open-brain/src/pipelines/session-start/briefing.ts "$env:TEMP\t297-briefing.bak"`,
   `Copy-Item open-brain/src/pipelines/session-start/start-report.ts "$env:TEMP\t297-report.bak"`,
   `Copy-Item project-template/gitignore "$env:TEMP\t297-gitignore.bak"`. For each of m1..m3:
   `node docs/loops/t297s3/apply.cjs . docs/loops/t297s3/<m>.txt` (paste output); run the four files; paste the
   `Tests` line and every `x` row; restore all three from their backups with `Copy-Item ... -Force`. Never use
   `git checkout` to restore here (it would also remove the fix). After m3's restore, run the four files once more and
   paste the `Tests` line.

## Reply

First line: `READY sim-t297s3 <HEAD sha8> ALL PASS` only if: c's red rows are W1, W4 and W5 in
t297-s3-working-tree.test.ts and nothing else; d prints `APPLIED 3 edits to 3 files` and all three exit 0; e and the
final run of h show 0 failed; f has 0 rows red alone; g shows `module-boundary [pass]`; m1 reds W1 and W5 only; m2 reds
W5 only; m3 reds W4 only. Otherwise `READY sim-t297s3 <HEAD sha8> MISMATCH` and list each step that differed, with the
full assertion message of every red row. Every number is pasted output, with its command.
