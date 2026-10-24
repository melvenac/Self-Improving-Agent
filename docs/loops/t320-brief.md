# T320: cut the unused build watch now the build proxy carries rebuilds (T-320 item 1)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-320 item (1) (T-315 follow-ups). **Tag:** `t320`.
**Size:** SMALL (1 src file deleted, 1 comment edit in server.ts, 1 test file replaced). **Base:** the START sha the
launcher names (a master that contains this brief).

```text
IMPACT-TARGETS: watchBuild attachBuildWatch (deleted with shared/build-watch.ts; no src importer)
```

## Why

`open-brain/src/shared/build-watch.ts` drove the exit-on-new-build route that failed live on 10-20 and was unwired by
the T-315 revert. Nothing in `open-brain/src` imports it; only `tests/shared/t315-s1.test.ts` (R1-R5) does. Its
docstring says an exited stdio server is respawned, which the 10-20 run disproved. The build proxy (`build-proxy.ts`,
#939) now carries rebuilds to running seats. The change: delete build-watch.ts; t315-s1.test.ts keeps R6 (server.ts
never exits on a new build) and gains R7 (the module is gone); the server.ts comment above `server.connect` names the
proxy.

## The change, exactly

Files under `docs/loops/t320/`.
- **`t315-s1.test.ts`:** copied verbatim over `open-brain/tests/shared/t315-s1.test.ts`. R6, R7.
- **`edits.txt`:** 1 edit in `open-brain/src/server.ts` (the comment above `server.connect`).
- **Delete** `open-brain/src/shared/build-watch.ts` with `git rm`, never `Remove-Item` (see the retirements row below).

## Measured before dispatch

QA PC SIM `sim-t320-3` (job #77) at `18756fc2`: every step matched but f. No file under `open-brain/` changed between
`18756fc2` and this brief's base. sha256 prefixes: test file `568f5c0c62a00660`, edits `c23524d871c03560`, m1
`3caf35eaf80dcb42`.
- Baseline (the new test file, no source change): the three files `1 failed | 2 passed (3)` files,
  `1 failed | 28 passed (29)` tests; the only red row is R7.
- Edits: `APPLIED 1 edits to 1 files`; both tsc runs and the build exit 0; `build/shared/build-watch.js` absent; the
  three files `29 passed (29)`.
- The wide run: `1 failed | 168 passed (169)` files, `1 failed | 2058 passed (2059)` tests. The one red row,
  red alone too, was `retirements-live.test.ts > R-011 on the live tree (T-215)`:
  `unreadable: open-brain/src/shared/build-watch.ts (ENOENT) ... (listed by git ls-files)`. The SIM deleted the file
  with `Remove-Item`, so the index still listed it. The scan reads `git ls-files` (`pipelines/sync/checks.ts`), which
  reads the index, so a `git rm` takes the path out and the row passes. That is read from the code, not measured:
  step 4 runs the row alone to measure it.
- `module-boundary [pass]`. m1 (server.ts mentions `attachBuildWatch(` again) R6 only; m2 (the module comes back) R7
  only.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/shared/t315-s1.test.ts` R1-R5 (build-watch rows) | removed | The module they test is cut; the file is replaced by R6 and R7. |
| `t315-proxy`, `t003-session-proof` | stay green | Neither imports build-watch. Green in the SIM. |
| `tests/pipelines/sync/retirements-live.test.ts` | stays green | Red in the SIM only because the deletion was unstaged; `git rm` stages it. Step 4 runs it alone. |
| everything else in step 4's run | stays green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t320 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the three files below and retirements-live, with that error or a hook timeout: re-run each such file alone;
green alone means paste both runs and go on, red alone means STOP. A red row in the three files or retirements-live
after step 4 is never an exception.

## Steps

"The three files" means, from `open-brain`:
`npx vitest run tests/shared/t315-s1.test.ts tests/t315-proxy.test.ts tests/t003-session-proof.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b chore/t320-cut-build-watch`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, any MCP config, and anything under `docs/`.
3. **Commit 1** (`T320: R7 pins that the unused build watch is gone`).
   - `Copy-Item docs/loops/t320/t315-s1.test.ts open-brain/tests/shared/t315-s1.test.ts -Force`.
   - Run the three files. Expect `1 failed | 2 passed (3)` files and `1 failed | 28 passed (29)` tests, the only red row
     R7 (`expected true to be false`). Paste the summary and the `x` row.
4. **Commit 2** (`T320: cut shared/build-watch.ts; the build proxy carries rebuilds (T-320)`).
   - From the clone root: `git rm -q open-brain/src/shared/build-watch.ts`, then
     `node docs/loops/t320/apply.cjs . docs/loops/t320/edits.txt` prints exactly `APPLIED 1 edits to 1 files`.
   - `git grep -n "build-watch" -- open-brain/src open-brain/tests`: paste every line; only
     `open-brain/tests/shared/t315-s1.test.ts` lines.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0); `Test-Path build/shared/build-watch.js` is False.
   - Run the three files: `29 passed (29)`.
   - `npx vitest run tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`: expect
     0 failed. Paste the `Tests` line. Red here means STOP: `BLOCKED t320 retirements-live` with the full message.
   - `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/t315-proxy.test.ts tests/t003-session-proof.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground with a tool timeout of at least 40 minutes, never the 10-minute
     default). Expect 0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`).
     Paste it.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix. Never commit a mutant.
   - m1: `node docs/loops/t320/apply.cjs . docs/loops/t320/m1.txt` prints `APPLIED 1 edits to 1 files`; run the three
     files; paste the `Tests` line and the `x` rows (expected: R6 only); restore with `git checkout -- open-brain/src`
     and check the status is empty.
   - m2: `git checkout <START> -- open-brain/src/shared/build-watch.ts` (the module comes back); run the three files;
     paste the `Tests` line and the `x` rows (expected: R7 only); restore with
     `git rm -q -f open-brain/src/shared/build-watch.ts` and check the status is empty.
   - Run the three files once more: `29 passed (29)`.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 3 paths:
   `M open-brain/src/server.ts`, `D open-brain/src/shared/build-watch.ts`, `M open-brain/tests/shared/t315-s1.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/chore/t320-cut-build-watch` must equal
   HEAD. `gh pr create --base master --head chore/t320-cut-build-watch --title "T320: cut the unused build watch (T-320)" --body "Brief: docs/loops/t320-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t320 <sha40> PR #<n>` or `BLOCKED t320 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`. Proxy seats pick up the new build with no reconnect; nothing else changes at run time.
