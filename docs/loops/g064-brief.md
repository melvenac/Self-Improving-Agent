# G064: the bootstrap scaffold declares the one seat developer

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code + docs. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-21, session 174. **Gap:** G-064. **Tag:** `g064`. **Size:** SMALL (5 edits in 4 files,
3 test edits in 2 files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief).

```text
IMPACT-TARGETS: scaffold agentMd describeRoleFiles (text only: agentMd's AGENT.md body, SCAFFOLD_FILES' why, one advice line in describeRoleFiles; no signature changes)
```

## Why

`bootstrap scaffold` wrote `.agents/AGENT.md` with `role: none`. On a single-agent project the checkout could then never
be shown its own handoff: `set_handoff` takes only planner/developer/qa, and ob_start names no handoff as "yours" while
the reader's seat is unresolved (mail-server, 10-20: PICK UP HERE "none: this reader's seat is unresolved"). The scaffold
now declares the one seat `developer`, the seat T-251's import already assumes for the handoff. This reverses BF-5's
NOT A SEAT default for new scaffolds only; a checkout that still declares `role: none` keeps working and is told how to
become the developer seat.

## The change, exactly

Files under `docs/loops/g064/`.
- **`tests.txt`:** 3 edits in 2 files: `open-brain/tests/pipelines/t272-seat-checkout.test.ts` S2 and S5 (role:
  developer), `open-brain/tests/pipelines/bootstrap-fix.test.ts` (the fresh install's ob_start shows `Seat: ...
  (developer)`, no NOT A SEAT, no unresolved reader).
- **`g064-developer-seat.test.ts`:** copied verbatim, as a new file, to
  `open-brain/tests/pipelines/g064-developer-seat.test.ts`. G1-G4.
- **`edits.txt`:** 5 edits in 4 files: `open-brain/src/pipelines/bootstrap/index.ts` (2),
  `open-brain/src/pipelines/session-start/role-files.ts` (1), `project-template/.claude/commands/bootstrap.md` (1),
  `README.md` (1).

## Measured before dispatch

QA PC SIM `sim-g064` (job #34) at `1bc3d56c`. sha256 prefixes: tests `fe19ebc4bd9d3314`, edits `6d40ae0fdba13723`,
m1 `30b4a86cd5b35632`, m2 `130544e0467095d0`, test file `c17d09bea7ed35a3`.
- Baseline (tests.txt + the new file, no fix): `APPLIED 3 edits to 2 files`; the three files `3 failed (3)` files,
  `7 failed | 29 passed (36)`: the bootstrap-fix whole-path row, t272 S2 and S5, G1-G4.
- edits.txt: `APPLIED 5 edits to 4 files`. Both tsc runs and the build exit 0. The three files `36 passed (36)`.
- Step 4's run at the SIM base: `178 passed (178)` files, `2050 passed (2050)` tests, no Errors line. The START sha
  may carry later merges (T-316 S2 adds 8 tests), so expect 0 failed and at least 178 files.
- `open-brain sync`: no FAIL or ISSUE line names a file this change touches (mirror-parity and command-parity there
  are about the QA PC's user-scope command copies; bootstrap.md is template-only and excepted).
- m1 (agentMd writes role: none again): G1, G2, G3, t272 S2 and S5, the whole-path row red. m2 (the advice line loses
  its fix): G4 red.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t272-seat-checkout.test.ts` S2, S5 | changed by `tests.txt` | They pinned role: none. |
| `bootstrap-fix.test.ts` whole-path row | changed by `tests.txt` | It pinned NOT A SEAT. |
| `bootstrap-fix.test.ts` BF-5 and `role-files.test.ts` role: none rows | stay green | A declared role: none still says NOT A SEAT. Green in the SIM. |
| `t251-role-stubs.test.ts` | stays green | It declares roles itself; it never reads the scaffold's AGENT.md. Green in the SIM. |
| everything else in step 4's run | stays green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED g064 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the three files below, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red row in the three files after step 4 is never an exception.

## Steps

"The three files" means, from `open-brain`:
`npx vitest run tests/pipelines/g064-developer-seat.test.ts tests/pipelines/t272-seat-checkout.test.ts tests/pipelines/bootstrap-fix.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b fix/g064-developer-seat`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, and anything under `docs/`.
3. **Commit 1** (`G064: rows for the developer-seat scaffold`).
   - `node docs/loops/g064/apply.cjs . docs/loops/g064/tests.txt` prints exactly `APPLIED 3 edits to 2 files`.
   - `Copy-Item docs/loops/g064/g064-developer-seat.test.ts open-brain/tests/pipelines/g064-developer-seat.test.ts`.
   - Run the three files. Expect `7 failed | 29 passed (36)`. Paste the summary and the `x` rows.
4. **Commit 2** (`G064: the bootstrap scaffold declares the one seat developer (G-064)`).
   - `node docs/loops/g064/apply.cjs . docs/loops/g064/edits.txt` prints exactly `APPLIED 5 edits to 4 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - Run the three files: `36 passed (36)`.
   - `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/end-fix --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground or with a timeout of at least 40 minutes). Expect 0 failed. Paste the
     `Test Files`, `Tests` and any `Errors` lines.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1, m2: `node docs/loops/g064/apply.cjs . docs/loops/g064/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the three files; paste the `Tests` line and the `x` rows (expected: m1 ->
   G1, G2, G3, t272 S2 and S5, the whole-path row; m2 -> G4); restore with `git checkout -- open-brain/src` (this
   returns to commit 2) and check the status is empty. After m2, run the three files once more: `36 passed (36)`.
   Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 7 paths: `M` for `README.md`,
   `project-template/.claude/commands/bootstrap.md`, `open-brain/src/pipelines/bootstrap/index.ts`,
   `open-brain/src/pipelines/session-start/role-files.ts`, `open-brain/tests/pipelines/t272-seat-checkout.test.ts` and
   `open-brain/tests/pipelines/bootstrap-fix.test.ts`, and `A` for `open-brain/tests/pipelines/g064-developer-seat.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/fix/g064-developer-seat` must equal
   HEAD. `gh pr create --base master --head fix/g064-developer-seat --title "G064: the bootstrap scaffold declares the one seat developer" --body "Brief: docs/loops/g064-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY g064 <sha40> PR #<n>` or `BLOCKED g064 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`. New scaffolds declare `role: developer`. An existing `role: none` checkout where an agent works
(mail-server) changes its own `.agents/AGENT.md` to `role: developer`; /start tells it so.
