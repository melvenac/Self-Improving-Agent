# SIM T262R: the skills audit keys a text tool that writes a file - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-23, session 174. **Task:** T-262 (D-152), S173 gap 1. **Tag:** `sim-t262r`.

## What is measured

T-262's audit (`open-brain/src/pipelines/skills-audit/index.ts`, `commandKeys`) drops generic programs, so clark's four
QA PC prompts built in one session as `sed -e ... old-prompt.txt > new.txt` produced no key and no row. The edit: a text
tool from a fixed list (sed, awk, cat, head, tail, cut, sort, uniq, tr, grep, jq, iconv) whose segment redirects stdout
to a real file keys as `<tool> > file`. Not a file: `2>`, `>&2`, `2>&1`, /dev/null, NUL, $null. A command with a heredoc
gets no such key (`cat > f <<EOF` is content, not a build). Shell builtins (echo, printf) stay unkeyed.

Files under `docs/loops/t262r/`:
- `t262-redirect-key.test.ts`: new file, goes to `open-brain/tests/t262-redirect-key.test.ts`. R1-R8.
- `edits.txt`: 2 edits in 1 file (`open-brain/src/pipelines/skills-audit/index.ts`).
- `m1.txt` (heredoc guard dropped), `m2.txt` (null devices count as files), `m3.txt` (`>&2` counts as a file),
  `m4.txt` (any generic program keys, not only the text tools), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The five files" means, from `open-brain`:
`npx vitest run tests/t262-redirect-key.test.ts tests/t262-skills-audit.test.ts tests/t262-part2.test.ts tests/t262-fix-2.test.ts tests/s173g.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `t262-redirect-key.test.ts`, `edits.txt`, `m1.txt` .. `m4.txt` under
   `docs/loops/t262r/`.
c. Baseline: `Copy-Item docs/loops/t262r/t262-redirect-key.test.ts open-brain/tests/t262-redirect-key.test.ts`. Run the
   five files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t262r/apply.cjs . docs/loops/t262r/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/shared tests/t258-notice-races.test.ts tests/t267-folder-key-shellfree.test.ts tests/t262-redirect-key.test.ts tests/t262-skills-audit.test.ts tests/t262-part2.test.ts tests/t262-fix-2.test.ts tests/s173g.test.ts tests/pipelines --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows only
   in files other than the five files, alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each
   such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` and paste
   every line.
h. Mutants, on the applied tree; the file is `open-brain/src/pipelines/skills-audit/index.ts` for all four. Back it up
   once with `Copy-Item <file> "$env:TEMP\t262r-fixed.bak"`. For each of m1..m4:
   `node docs/loops/t262r/apply.cjs . docs/loops/t262r/<m>.txt` (paste output); run the five files; paste the `Tests`
   line and every `x` row; restore with `Copy-Item "$env:TEMP\t262r-fixed.bak" <file> -Force`. Never use
   `git checkout` to restore here (it would also remove the fix). After m4's restore, run the five files once more and
   paste the `Tests` line.

## Reply

First line: `READY sim-t262r <HEAD sha8> ALL PASS` only if: c's only red rows are R1, R2, R7 and R8 in
t262-redirect-key.test.ts (R3-R6 green: they expect no key, which is today's behaviour); d prints
`APPLIED 2 edits to 1 files` and all three exit 0; e and the final run of h show 0 failed; f has 0 rows red alone; g
shows `module-boundary [pass]`; m1 reds R5 and t262-skills-audit's `K5 heredoc bodies are data` only; m2 reds R3 only;
m3 reds R4 only; m4 reds R6 only. Otherwise `READY sim-t262r <HEAD sha8> MISMATCH` and list each step that differed,
with the full assertion message of every red row. Every number is pasted output, with its command.
