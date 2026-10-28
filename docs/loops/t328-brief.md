# T328: the gitignore merge keeps the project's own exceptions (T-328)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-28, session 175. **Task:** T-328 (P3). **Tag:** `t328`. **Size:** SMALL (2 edits in
1 file, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief).
**Authority:** D-145 (work the backlog by priority); the defect was seen in both 10-27 adoptions (foundry, worth-it)
and fixed there by hand. Merge under D-163 (Atlas's QA ACCEPT; not an excluded class).

```text
IMPACT-TARGETS: mergeTemplateFiles (bootstrap/index.ts; shared by `bootstrap scaffold` and `state import --commit`)
```

## Why

`mergeTemplateFiles` appends the template gitignore's missing rules under one SIA header. git takes the LAST matching
pattern, so the block's `.env` / `.env.*` landed after a project's own `!.env.example` and silently re-ignored it
(`git check-ignore -v --no-index .env.example` -> `.gitignore:49:.env.*` in foundry). The fix: after the SIA block,
re-append the owner's own `!` exception lines under a second header,
`# --- the project's own exceptions, re-applied after the SIA block (T-328) ---`. Only for `.gitignore`;
de-duplicated; exceptions under `.agents/` are left out (the SIA block decides what in `.agents/` is tracked). No owner
exceptions -> no second block, byte-identical to today. Idempotent. Full rationale and the rejected alternative:
`docs/loops/t328-sim.md`.

## The change, exactly

Files under `docs/loops/t328/`.
- **`t328-gitignore-negations.test.ts`:** copied verbatim, as a new file, to
  `open-brain/tests/pipelines/t328-gitignore-negations.test.ts`. E1-E5.
- **`edits.txt`:** 2 edits in 1 file: `open-brain/src/pipelines/bootstrap/index.ts` (the exported helper
  `ownerNegationsToReapply`, and the merge's write line gaining the exceptions tail).

## Measured before dispatch

QA PC SIM `sim-t328` (job #296) at `a047c917`: ALL PASS.
- Baseline (four files, new test only): `1 failed | 3 passed (4)` files, `3 failed | 31 passed (34)`; red E1, E4, E5
  only.
- Apply: `APPLIED 2 edits to 1 files`; both tsc and `npm run build` exit 0; four files `34 passed (34)`.
- Wide run (`tests/pipelines tests/t154-cli-start.test.ts`): `1739 passed (1739)` tests; one file-level hook timeout in
  `tests/pipelines/session-start/latest-brief.test.ts` with T-292's `Timeout calling onTaskUpdate`; that file passed
  60/60 alone 3 of 3 times.
- `retirements [pass]`, `module-boundary [pass]`, `command-tool-names [pass]`.
- m1 (no exceptions re-applied) -> E1, E4, E5; m2 (`.agents/` not filtered) -> E4; m3 (exceptions before the block)
  -> E1, E4, E5. Each mutant's tsc exits 0.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `state-import-t297s2.test.ts` G1 (no .gitignore -> created from the template) | stays green | The `created` branch is untouched. Green in the SIM. |
| `state-import-t297s2.test.ts` G2 (owner `node_modules/` -> one SIA header) | stays green | No owner exceptions -> no second block. Green in the SIM. |
| `state-import-t297s2.test.ts` G3 (failed import restores the owner's file) | stays green | Restore path untouched. Green in the SIM. |
| `bootstrap-fix.test.ts` (owner `node_modules/\n.agents/`, startsWith) | stays green | No `!` lines. Green in the SIM. |
| `import-cmds-r2-l1.test.ts` (fixture already carries every rule) | stays green | `missing` is empty -> skipped before the new code. Green in the SIM. |
| `t297-s3-working-tree.test.ts` W4 (template file content) | stays green | The template file is unchanged. Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t328 <test name>`. Exceptions, from T-292 load on the
shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows or
file-level hook timeouts only in files other than the four files, with that error or a timeout: re-run each such file
alone up to 3 times; green on any run alone means paste every run and go on, red on all 3 means STOP. Known flaky
under load: hub-presence, state-import-r4, end-fix-q3, t159-fast-path N3, record-erasure R179,
`tests/pipelines/session-start/latest-brief.test.ts` (hook timeout, T-292 signature; 3/3 green alone in job #296).

## Steps

"The four files" means, from `open-brain`:
`npx vitest run tests/pipelines/t328-gitignore-negations.test.ts tests/pipelines/state-import-t297s2.test.ts tests/pipelines/bootstrap-fix.test.ts tests/pipelines/import-cmds-r2-l1.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b build/t328`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash, reset --hard,
   force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real `~/.claude/`,
   any MCP config, and anything under `docs/`.
3. **Commit 1** (`T328: rows for the gitignore exceptions re-apply`).
   - `Copy-Item docs/loops/t328/t328-gitignore-negations.test.ts open-brain/tests/pipelines/t328-gitignore-negations.test.ts`.
   - Run the four files. Expect `1 failed | 3 passed (4)` files and `3 failed | 31 passed (34)` tests, red E1, E4,
     E5 only. Paste the summary and each `x` row. Commit the test file.
4. **Commit 2** (`T328: gitignore merge re-applies the project's own exceptions (T-328)`).
   - From the clone root: `node docs/loops/t328/apply.cjs . docs/loops/t328/edits.txt` prints exactly
     `APPLIED 2 edits to 1 files`.
   - In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build` (each exit 0).
   - Run the four files: `34 passed (34)`.
   - `npx vitest run tests/pipelines tests/t154-cli-start.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait).
     Expect 0 failed, subject to the exception rule. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`;
     both must show `[pass]`.
   - Commit `open-brain/src/pipelines/bootstrap/index.ts`.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m3: `node docs/loops/t328/apply.cjs . docs/loops/t328/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; `npx tsc --noEmit` in `open-brain` exits 0; run
   `npx vitest run tests/pipelines/t328-gitignore-negations.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and the `x` rows (expected: m1 -> E1, E4, E5; m2 -> E4; m3 -> E1, E4, E5); restore with
   `git checkout -- open-brain/src` and check the status is empty. After m3, run the four files once more:
   `34 passed (34)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 2 paths:
   `M open-brain/src/pipelines/bootstrap/index.ts`,
   `A open-brain/tests/pipelines/t328-gitignore-negations.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/build/t328` must equal HEAD.
   `gh pr create --base master --head build/t328 --title "T328: gitignore merge keeps the project's own exceptions (T-328)" --body "Brief: docs/loops/t328-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t328 <sha40> PR #<n>` or `BLOCKED t328 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

sia-rebuild on the main checkout. foundry and worth-it were fixed by hand on 10-27; nothing to redo there. Live
check: a scratch `git init` with `.env*` and `!.env.example`, run through `bootstrap scaffold`, keeps `.env.example`
un-ignored (`git check-ignore -q --no-index .env.example` exits 1).
