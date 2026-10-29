# T284b: setup writes an absolute core.hooksPath, so the commit-msg hook runs in sparse worktrees (T-284)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-28, session 175. **Task:** T-284 step b (P3). **Tag:** `t284b`. **Size:** SMALL
(4 edits in 2 script files, 1 existing test file replaced). **Base:** the START sha the launcher names (a master that
contains this brief). **Authority:** Aaron, 2026-10-28, AskUserQuestion in the planner's window: "Absolute path
(Recommended)". Merge under D-163 (Atlas's QA ACCEPT; script source, not the excluded config class: the one config
change, this clone's core.hooksPath, Aaron ruled and the planner applied by hand).

```text
IMPACT-TARGETS: commitHooksPlan (scripts/setup-hooks.mjs; caller scripts/setup.mjs registerCommitHooks),
registerCommitHooks (scripts/setup.mjs)
```

## Why

T-284 (df2fe7a0) shipped a tracked `.githooks/commit-msg` and setup wrote `core.hooksPath=.githooks`. That value is
RELATIVE, so git resolves it in each worktree's own root. Every seat worktree is a sparse checkout without
`.githooks/`, so git silently ran no hook there: the planner's 10-28 live check (an empty commit in sia-planner with
`CLAUDE_CODE_SESSION_ID` set) got no trailer. With the clone's value set by hand to the absolute
`<main root>/.githooks`, the same check got `Claude-Session: <uuid>`. This change makes setup write the absolute path:
- `commitHooksPlan(current, target)`: both sides compared as paths (trim, backslash to slash, no trailing slash).
  Equal: `already`. Unset: set. The legacy relative `.githooks`: set, with an upgrade note. Anything else: left alone,
  wording unchanged.
- `registerCommitHooks`: target = `dirname(git rev-parse --path-format=absolute --git-common-dir)` + `/.githooks`, so
  setup run inside a worktree still names the main checkout; written with `execFileSync('git', [...])`, no shell (the
  path may hold a space).

## The change, exactly

Files under `docs/loops/t284b/`.
- **`t284-commit-msg-hook.test.ts`:** copied verbatim OVER the existing `open-brain/tests/t284-commit-msg-hook.test.ts`
  (its S1 pinned the one-argument plan and `plan('.githooks')` staying unset). Rows C0-C4 (hook, unchanged) and S1-S4.
- **`edits.txt`:** 4 edits in 2 files (`scripts/setup-hooks.mjs`, `scripts/setup.mjs`).

## Measured before dispatch

QA PC SIM `sim-t284b` (job #346) at `535a355f`: ALL PASS.
- git 2.55.0.windows.5 (supports `--path-format`).
- Baseline (four files, new test copy only): `1 failed | 3 passed (4)` files, `4 failed | 28 passed (32)`; red S1-S4.
- `edits.txt`: `APPLIED 4 edits to 2 files`; `node --check` both scripts exit 0; tsc tests exit 0; four files
  `32 passed (32)`.
- Wide run: `1 failed | 65 passed | 7 skipped (73)` files; the one red row was
  `tests/shared/state-writer-notes.test.ts` T171-D1 at 11 s, `23 passed (23)` alone (load; added to the flaky list).
- m1 -> S2; m2 -> S3; m3 -> S1, all as predicted.
- From inside a `git worktree add` worktree the common dir named the main `.git`, and the legacy `.githooks` planned
  as an upgrade to `<main>/.githooks` (path with a space).

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t284-commit-msg-hook.test.ts` | REPLACED (commit 1) | S1 pinned the old signature and the relative value. |
| `setup-hooks.test.ts`, `setup-cursor-commands.test.ts`, `setup-repo-root.test.ts` | stays green | Import setup-hooks.mjs but not `commitHooksPlan` or `COMMIT_HOOKS_PATH`; green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t284b <test name>`. Exceptions, from T-292 load on the
shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows or
file-level hook timeouts only in files other than the four files, with that error or a timeout: re-run each such
file alone up to 3 times; green on any run alone means paste every run and go on, red on all 3 means STOP. Known flaky
under load: hub-presence, state-import-r4, end-fix-q3, t159-fast-path N3, record-erasure R179,
`tests/pipelines/session-start/latest-brief.test.ts` (hook timeout, T-292 signature), `tests/server.test.ts` handleSync
`runs sync on project root` (5 s default timeout), `tests/shared/state-writer-notes.test.ts` T171-D1 (red at 11 s in
the SIM's wide run, 23/23 alone).

## Steps

"The four files" means, from `open-brain`:
`npx vitest run tests/t284-commit-msg-hook.test.ts tests/setup-hooks.test.ts tests/setup-cursor-commands.test.ts tests/setup-repo-root.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b build/t284b`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash, reset --hard,
   force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real `~/.claude/`,
   running `scripts/setup.mjs`, `git config` writes, any MCP config, and anything under `docs/`.
3. **Commit 1** (`T284b: rows for an absolute core.hooksPath`).
   - `Copy-Item docs/loops/t284b/t284-commit-msg-hook.test.ts open-brain/tests/t284-commit-msg-hook.test.ts -Force`.
   - Run the four files. Expect 1 failed file and 4 failed tests, red S1, S2, S3, S4 only (C0-C4 green). Paste the
     summary and each `x` row. Commit the test file.
4. **Commit 2** (`T284b: setup writes the absolute .githooks path, upgrading the relative one (T-284)`).
   - From the clone root: `node docs/loops/t284b/apply.cjs . docs/loops/t284b/edits.txt` prints exactly
     `APPLIED 4 edits to 2 files`.
   - `node --check scripts/setup.mjs` and `node --check scripts/setup-hooks.mjs` (each exit 0). In `open-brain`:
     `npx tsc -p tsconfig.tests.json --noEmit` (exit 0).
   - Run the four files: `32 passed (32)`.
   - `npx vitest run tests/harness tests/shared tests/t284-commit-msg-hook.test.ts tests/setup-hooks.test.ts tests/setup-cursor-commands.test.ts tests/setup-repo-root.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait).
     Expect 0 failed, subject to the exception rule. Paste the `Test Files`, `Tests` and any `Errors` lines, and the
     full assertion message of any red row.
   - Commit the 2 script files.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m3: `node docs/loops/t284b/apply.cjs . docs/loops/t284b/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run ONLY
   `npx vitest run tests/t284-commit-msg-hook.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and the `x` rows (expected: m1 -> S2; m2 -> S3; m3 -> S1); restore with
   `git checkout -- scripts` and check the status is empty. After m3, run the four files once more: `32 passed (32)`.
   Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 3 paths:
   `M open-brain/tests/t284-commit-msg-hook.test.ts`, `M scripts/setup-hooks.mjs`, `M scripts/setup.mjs`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/build/t284b` must equal HEAD.
   `gh pr create --base master --head build/t284b --title "T284b: setup writes an absolute core.hooksPath (T-284)" --body "Brief: docs/loops/t284b-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t284b <sha40> PR #<n>` or `BLOCKED t284b <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

No rebuild needed for the hook (scripts only; sia-rebuild only if the planner wants build-info current). Live check:
in a scratch clone with `core.hooksPath=.githooks`, run setup's plan via `node -e` import of `commitHooksPlan` with the
clone's common-dir target and see the upgrade note; this desktop clone already holds the absolute value (`already`).
