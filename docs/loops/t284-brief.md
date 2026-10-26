# T284: a tracked commit-msg hook stamps the Claude Code session (T-284)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 174. **Task:** T-284 (P3). **Tag:** `t284`. **Size:** SMALL (1 new hook
file, 4 edits in 2 script files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this
brief). **Authority:** Aaron at the planner's desk, 2026-10-26: "Stamp uuid, tracked hook".

```text
IMPACT-TARGETS: none (scripts/*.mjs and a git hook; no open-brain/src symbol changes)
```

## Why

/end attributes commits by their `Claude-Session:` trailer, and since T-276 the session's own uuid counts as its value;
the trailer is written by the agent today (prompt level). `.githooks/commit-msg` stamps `Claude-Session: <uuid>` from
`CLAUDE_CODE_SESSION_ID` when that holds a uuid and the message has no Claude-Session trailer; anything else is left
alone. `scripts/setup.mjs` sets `core.hooksPath=.githooks` only when it is unset. The key is `Claude-Session`, not a new
key, because the guards read only `%(trailers:key=Claude-Session)`.

## The change, exactly

Files under `docs/loops/t284/`.
- **`commit-msg`:** copied verbatim to `.githooks/commit-msg`, added with mode 100755.
- **`t284-commit-msg-hook.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t284-commit-msg-hook.test.ts`.
  C0-C4, S1.
- **`edits.txt`:** 4 edits in 2 files: `scripts/setup-hooks.mjs` (`COMMIT_HOOKS_PATH`, `commitHooksPlan`) and
  `scripts/setup.mjs` (import, `registerCommitHooks`, its call after `registerHooks`).

## Measured before dispatch

QA PC SIM `sim-t284` (job #132) at `db8438ed`: every prediction held except one wide-run row, ruled a SIM artifact:
`tests/harness/s4-guards.test.ts` D1b ("the real tree has no untracked file under open-brain/tests") was red because a
SIM may not commit, so the copied test file stayed untracked. This build commits it, so D1b is green here.
- Baseline (the new test file, no hook): two files `3 failed | 16 passed (19)`; red C0, C1, S1.
- Apply: `APPLIED 4 edits to 2 files`; `100755` on `.githooks/commit-msg`; `node --check` on both scripts and the tests
  tsc exit 0; two files `19 passed (19)`.
- m1 (no existing-trailer check) C3; m2 (no uuid check) C4; m3 (setup overwrites another hooksPath) S1.
- Under the runner's real env (CLAUDE_CODE_SESSION_ID set, length 36) a probe commit ended `Claude-Session: <uuid>`.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/setup-hooks.test.ts` | stays green | The settings functions are unchanged. Green in the SIM. |
| `tests/harness/*` (git with `core.hooksPath` forced to the null device) | stay green | The harness never runs repo hooks. Green in the SIM. |
| `tests/harness/s4-guards.test.ts` D1b | green after commit 1 | The new test file is tracked once committed. |

Any other red existing row means STOP and report `BLOCKED t284 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the two files below, with that error or a hook timeout: re-run each such file alone; green alone means paste
both runs and go on, red alone means STOP.

## Steps

"The two files" means, from `open-brain`:
`npx vitest run tests/t284-commit-msg-hook.test.ts tests/setup-hooks.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t284-commit-msg-hook`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, any MCP config, `git config core.hooksPath` in this clone, and anything under `docs/`.
3. **Commit 1** (`T284: rows for the commit-msg hook`).
   - `Copy-Item docs/loops/t284/t284-commit-msg-hook.test.ts open-brain/tests/t284-commit-msg-hook.test.ts`.
   - Run the two files. Expect `1 failed | 1 passed (2)` files and `3 failed | 16 passed (19)` tests, the red rows C0, C1
     and S1. Paste the summary and each `x` row. Commit the test file.
4. **Commit 2** (`T284: a tracked commit-msg hook stamps the Claude Code session (T-284)`).
   - From the clone root: `New-Item -ItemType Directory .githooks`; `Copy-Item docs/loops/t284/commit-msg .githooks/commit-msg`;
     `git add --chmod=+x .githooks/commit-msg`; `node docs/loops/t284/apply.cjs . docs/loops/t284/edits.txt` prints
     exactly `APPLIED 4 edits to 2 files`. Paste `git ls-files -s .githooks/commit-msg` (must start `100755`).
   - `node --check scripts/setup.mjs` and `node --check scripts/setup-hooks.mjs` (exit 0). In `open-brain`:
     `npx tsc -p tsconfig.tests.json --noEmit` (exit 0).
   - Run the two files: `19 passed (19)`.
   - `npx vitest run tests/harness tests/shared tests/setup-hooks.test.ts tests/t284-commit-msg-hook.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait). Expect
     0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - Commit `.githooks/commit-msg`, `scripts/setup.mjs` and `scripts/setup-hooks.mjs`.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m3: `node docs/loops/t284/apply.cjs . docs/loops/t284/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run `npx vitest run tests/t284-commit-msg-hook.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and the `x` rows (expected: m1 -> C3; m2 -> C4; m3 -> S1); restore with
   `git checkout -- .githooks scripts` and check the status is empty. After m3, run the two files once more:
   `19 passed (19)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 4 paths: `A .githooks/commit-msg`,
   `A open-brain/tests/t284-commit-msg-hook.test.ts`, `M scripts/setup-hooks.mjs`, `M scripts/setup.mjs`. And
   `git ls-tree HEAD .githooks/commit-msg` shows mode `100755`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t284-commit-msg-hook` must equal
   HEAD. `gh pr create --base master --head feat/t284-commit-msg-hook --title "T284: a tracked commit-msg hook stamps the Claude Code session (T-284)" --body "Brief: docs/loops/t284-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion (Linux CI runs C0-C4 with the
   exec bit).

## Reply

- **First line:** `READY t284 <sha40> PR #<n>` or `BLOCKED t284 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

In the main checkout: `node scripts/setup.mjs` is heavy, so set it directly once:
`git -C <main> config core.hooksPath .githooks` (shared by every worktree of the repo). Live check: the next commit a
seat makes without writing the trailer carries `Claude-Session: <its uuid>`, and /end counts it.
