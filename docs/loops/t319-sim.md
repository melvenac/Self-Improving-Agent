# SIM T319: retire domains.json (D-162) - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-21, session 174. **Task:** T-319 (D-162, Aaron 10-20). **Tag:** `sim-t319`.

## What is measured

D-162 retires `.agents/SYSTEM/domains.json`. Files under `docs/loops/t319/`: `tests.txt` (1 edit:
`open-brain/tests/pipelines/session-start/briefing-fix.test.ts` BF-R1 now asserts the file is NOT owed), `edits.txt`
(11 edits in 11 files: /start step 4 in three runtimes, two harness-audit rows, `reads-owed.ts`, `score.ts`,
`.gitignore`, `CLAUDE.md`, `.agents/SYSTEM/RULES.md`, `.agents/retirements.json`), `m1.txt`, `apply.cjs`. The run also
deletes `.agents/SYSTEM/domains.json`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `tests.txt`, `edits.txt`, `m1.txt` under `docs/loops/t319/`.
c. Baseline: `node docs/loops/t319/apply.cjs . docs/loops/t319/tests.txt` (paste output); `$env:NO_COLOR='1'`; in
   `open-brain`: `npx vitest run tests/pipelines/session-start/briefing-fix.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste the summary and every `x` row.
d. From the clone root: `node docs/loops/t319/apply.cjs . docs/loops/t319/edits.txt` (paste output), then
   `git rm -q .agents/SYSTEM/domains.json`. Then `git grep -n "domains.json" -- . ':!docs' ':!CHANGELOG.md'` and paste
   every hit.
e. In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code
   and any error lines.
f. `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/end-fix --no-file-parallelism --testTimeout=180000`
   (40-minute cap). Paste the `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the
   assertion message. Red rows only in files other than briefing-fix.test.ts alongside T-292's `Timeout calling
   onTaskUpdate` or hook timeouts: re-run each such file alone and paste both. Do not fix anything.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "retire|domains|FAIL|WARN"`.
   Paste every line. This is the retirement check and the rest of /sync on the changed tree.
h. Mutant: `node docs/loops/t319/apply.cjs . docs/loops/t319/m1.txt` (paste output), run the briefing-fix file, paste
   the summary and `x` rows, then restore with `git checkout -- open-brain/src/pipelines/session-start/reads-owed.ts`
   and re-run it (paste the summary).

## Reply

First line: `READY sim-t319 <HEAD sha8> ALL PASS` only if: c prints `APPLIED 1 edits to 1 files` and the file shows
`x` BF-R1 only; d prints `APPLIED 11 edits to 11 files` and the grep has NO hit in `.claude/commands/`, `project-template/`,
`.gitignore`, `CLAUDE.md`, `.agents/SYSTEM/RULES.md` or `.agents/retirements.json`, and in `open-brain/src/` only the
two D-162 comments (hits in test fixtures and in the record `.agents/state.json` and its rendered views are expected); e all exit 0; f has 0 rows red alone; g shows no retirement failure or warning
that names domains.json; h reds BF-R1 and the restore turns it green. Otherwise `READY sim-t319 <HEAD sha8> MISMATCH`
and list each step that differed. Every number is pasted output.
