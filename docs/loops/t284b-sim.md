# SIM T284b: setup points core.hooksPath at the main checkout's .githooks, absolute - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-28, session 175. **Task:** T-284 (P3), step b. **Tag:** `sim-t284b`. **Authority:**
Aaron in the planner's window, 2026-10-28 (AskUserQuestion): "Absolute path (Recommended)".

## What is measured

T-284 shipped a tracked `.githooks/commit-msg` and `scripts/setup.mjs` sets `core.hooksPath=.githooks`. The live check
of 10-28 failed: the value is RELATIVE, git resolves it in each worktree's own root, and every seat worktree is a sparse
checkout without `.githooks/`, so git silently ran no hook there. With the value set by hand to the main checkout's
absolute `.githooks`, the same check passed. This SIM moves setup to the absolute path:

- `scripts/setup-hooks.mjs`: `commitHooksPlan(current)` becomes `commitHooksPlan(current, target)`, `target` the main
  checkout's `.githooks` as an absolute path. Both sides are compared as paths (trimmed, backslashes to slashes, no
  trailing slash). Equal: already set, nothing written. Unset: set. The legacy relative `.githooks`: set (upgraded),
  with a note that says so. Any other value: left alone and reported, as today.
- `scripts/setup.mjs` `registerCommitHooks`: `target` = `dirname(git rev-parse --path-format=absolute --git-common-dir)`
  + `/.githooks`, so setup run inside a worktree still names the main checkout; written with
  `execFileSync('git', ['config', 'core.hooksPath', target])`, no shell. `--path-format` needs git 2.31 or later.

Files under `docs/loops/t284b/`: `t284-commit-msg-hook.test.ts` (REPLACES the existing
`open-brain/tests/t284-commit-msg-hook.test.ts`: C0-C4 unchanged; S1 rewritten for the new signature; S2, S3, S4 new),
`edits.txt` (4 edits in 2 files), `m1.txt` (legacy value not upgraded), `m2.txt` (no slash normalisation), `m3.txt`
(any other value is overwritten), `apply.cjs`.

Existing tests that import `scripts/setup-hooks.mjs`, with verdicts:
- `tests/t284-commit-msg-hook.test.ts`: S1 pins the old one-argument plan and `plan('.githooks\n').set === false`;
  REPLACED by this SIM's copy.
- `tests/setup-hooks.test.ts` (withSessionHooks, withCursorMcp, withCursorSessionHook, withCursorRecallHook),
  `tests/setup-cursor-commands.test.ts` (copyCursorSlashCommands), `tests/setup-repo-root.test.ts` (repoRootFrom): none
  touches commitHooksPlan or COMMIT_HOOKS_PATH; stay green, no edit.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The four files" means, from `open-brain`:
`npx vitest run tests/t284-commit-msg-hook.test.ts tests/setup-hooks.test.ts tests/setup-cursor-commands.test.ts tests/setup-repo-root.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). Print `git --version` (must be 2.31 or later). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t284b/`.
c. Baseline: `Copy-Item docs/loops/t284b/t284-commit-msg-hook.test.ts open-brain/tests/t284-commit-msg-hook.test.ts -Force`.
   Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
d. Apply: `node docs/loops/t284b/apply.cjs . docs/loops/t284b/edits.txt` (paste output).
   `node --check scripts/setup.mjs` and `node --check scripts/setup-hooks.mjs` (exit codes). In `open-brain`:
   `npx tsc -p tsconfig.tests.json --noEmit` (exit code and any error lines).
e. Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/harness tests/shared tests/t284-commit-msg-hook.test.ts tests/setup-hooks.test.ts tests/setup-cursor-commands.test.ts tests/setup-repo-root.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes). Paste the `Test Files`, `Tests` and any
   `Errors` lines and every `x` row. Red rows alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run
   each such file alone and paste both.
g. Mutants, on the applied tree. Back up once: `Copy-Item scripts/setup-hooks.mjs "$env:TEMP\t284b-sh.bak"`. For each
   of m1..m3: `node docs/loops/t284b/apply.cjs . docs/loops/t284b/<m>.txt` (paste output); run ONLY
   `npx vitest run tests/t284-commit-msg-hook.test.ts --no-file-parallelism --testTimeout=180000`; paste the `Tests`
   line and every `x` row; restore with `Copy-Item "$env:TEMP\t284b-sh.bak" scripts/setup-hooks.mjs -Force`. After
   m3's restore, run the four files once more and paste the `Tests` line.
h. One measurement (setup.mjs runs every step on import, so registerCommitHooks is not called alone). In a temp dir:
   `git init -q main`; in `main` commit one file (`git -c user.name=t -c user.email=t@example.invalid commit -q --allow-empty -m init`);
   `git -C main worktree add -q ../wt`. From inside `wt`, print
   `git rev-parse --path-format=absolute --git-common-dir`. Then, from the clone root, print the target and the plan
   setup would compute for the legacy value:
   `node -e "const p=require('path');const c=process.argv[1].trim();const t=p.join(p.dirname(c),'.githooks').replace(/\\\\/g,'/');import('./scripts/setup-hooks.mjs').then(m=>console.log(t, JSON.stringify(m.commitHooksPlan('.githooks', t))))" "<the common dir printed above>"`
   Write that one-liner to a .cjs file first if the shell mangles it; paste the file and its output.

## Predicted

- c: red S1 (its first note does not contain the target; the old plan ignores a second argument), S2 (the legacy value
  reads as already set), S3 (backslashes read as another value, note says left alone), S4 (setup.mjs has no
  `'--git-common-dir'`). C0-C4 green. The other three files green.
- d: `APPLIED 4 edits to 2 files`; both `node --check` and tsc exit 0.
- e and g's final run: 0 failed.
- m1 -> S2 only. m2 -> S3 only. m3 -> S1 only.
- h: the common dir printed from `wt` ends `/main/.git`; the target ends `/main/.githooks`; the plan is
  `{"set":true,"note":"git core.hooksPath upgraded from the relative .githooks to <target> ..."}`.

## Reply

First line: `READY sim-t284b <HEAD sha8> ALL PASS` only if every prediction held and f has 0 rows red alone. Otherwise
`READY sim-t284b <HEAD sha8> MISMATCH` and list each step that differed, with the full assertion message of every red
row. Always include step h's output. Every number is pasted output, with its command.
