# T297S3: the Working tree line names this session's own log; the template ignores settings backups (T-297)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-297 step 3 (P2). **Tag:** `t297s3`. **Size:** SMALL (5
edits in 4 files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief).

```text
IMPACT-TARGETS: describeWorkingTree renderStartReport
```

## Why

Relay's s43 greeting listed SIA's own local files as uncommitted work. Per the T-297 note's corrected scope (never
ignore session logs: A2A tracks them): `describeWorkingTree` (briefing.ts) takes this session's log path and labels that
one path `<path> (this session's log)`; start-report.ts passes `result.session.logPath`. Nothing is hidden, no other path
is labelled, and with no log the line is byte-identical. `project-template/gitignore` gains `/.claude/*.bak-*`.

## The change, exactly

Files under `docs/loops/t297s3/`.
- **`t297-s3-working-tree.test.ts`:** copied verbatim, as a new file, to
  `open-brain/tests/pipelines/session-start/t297-s3-working-tree.test.ts`. W1-W5.
- **`edits.txt`:** 5 edits in 4 files: briefing.ts (`describeWorkingTree(projectRoot, ownLog?)`), start-report.ts (passes
  the log), project-template/gitignore (the ignore line), and `tests/pipelines/session-start/briefing.test.ts` (its two
  rows that rebuild ob_start's block with `renderBriefing` now pass the same session's log to `describeWorkingTree`).

## Measured before dispatch

QA PC SIM `sim-t297s3` (job #104) at `f14f1866`, with the first 3 edits: every step matched except one cause, ruled.
`briefing.test.ts` "the block in ob_start's output is exactly renderBriefing's output for the same record" and "QA 263
F4: ... the MCP block is renderBriefing's" were red alone: their expectation built the Working tree line with
`describeWorkingTree(root)`, so ob_start's new label was on one side only
(`- "Working tree: 1 uncommitted: .agents/SESSIONS/Session_55.md"` vs `+ "... Session_55.md (this session's log)"`).
Edits 4 and 5 pass the log on the expectation side; they were checked to apply, not run. No file under `open-brain/`
or `project-template/` changed between `f14f1866` and this brief's base.
- Baseline (the new test file, no source): `1 failed | 3 passed (4)` files, `3 failed | 55 passed (58)` tests; the red
  rows are W1, W4 and W5.
- 3 edits: both tsc runs and the build exit 0; W1-W5 green; the wide run `2 failed | 1721 passed (1723)`, the two rows
  above only, plus T-292's `Timeout calling "onTaskUpdate"` error. `module-boundary [pass]`.
- m1 W1 and W5 (the two briefing rows stay green: both sides lose the label); m2 W5; m3 W4.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `briefing.test.ts` the two ob_start-vs-renderBriefing rows | changed | Edits 4-5: the expectation passes the session's own log, as ob_start now does. |
| `briefing.test.ts` describeWorkingTree rows (`clean`, `2 uncommitted: a.txt, b.txt`, not checked) | stay green | No log is passed, so the line is byte-identical. Green in the SIM. |
| `import-cmds-r2-l1`, `template-seed` | stay green | The harness copies the template gitignore itself. Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t297s3 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the four files below, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red row in the four files after step 4 is never an exception.

## Steps

"The four files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/t297-s3-working-tree.test.ts tests/pipelines/session-start/briefing.test.ts tests/pipelines/import-cmds-r2-l1.test.ts tests/pipelines/template-seed.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t297s3-working-tree`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, any MCP config, and anything under `docs/`.
3. **Commit 1** (`T297S3: rows for this session's own log on the Working tree line`).
   - `Copy-Item docs/loops/t297s3/t297-s3-working-tree.test.ts open-brain/tests/pipelines/session-start/t297-s3-working-tree.test.ts`.
   - Run the four files. Expect `1 failed | 3 passed (4)` files and `3 failed | 55 passed (58)` tests, the red rows W1,
     W4 and W5 in t297-s3-working-tree.test.ts. Paste the summary and each `x` row.
4. **Commit 2** (`T297S3: the Working tree line names this session's log; the template ignores settings backups (T-297)`).
   - `node docs/loops/t297s3/apply.cjs . docs/loops/t297s3/edits.txt` prints exactly `APPLIED 5 edits to 4 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - Run the four files: `58 passed (58)`.
   - `npx vitest run tests/pipelines tests/t154-cli-start.test.ts tests/server.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground with a tool timeout of at least 40 minutes, never the 10-minute
     default). Expect 0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`).
     Paste it.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m3: `node docs/loops/t297s3/apply.cjs . docs/loops/t297s3/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the four files; paste the `Tests` line and the `x` rows (expected: m1 -> W1
   and W5; m2 -> W5 and the two briefing.test.ts ob_start-vs-renderBriefing rows; m3 -> W4 only); restore with
   `git checkout -- open-brain/src project-template` (this returns to commit 2) and check the status is empty. After
   m3, run the four files once more: `58 passed (58)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 5 paths:
   `M open-brain/src/pipelines/session-start/briefing.ts`, `M open-brain/src/pipelines/session-start/start-report.ts`,
   `M open-brain/tests/pipelines/session-start/briefing.test.ts`,
   `A open-brain/tests/pipelines/session-start/t297-s3-working-tree.test.ts`, `M project-template/gitignore`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t297s3-working-tree` must equal
   HEAD. `gh pr create --base master --head feat/t297s3-working-tree --title "T297S3: the Working tree line names this session's log; the template ignores settings backups (T-297)" --body "Brief: docs/loops/t297s3-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t297s3 <sha40> PR #<n>` or `BLOCKED t297s3 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`. Live check: the next /start in a checkout whose own log is new shows `(this session's log)` on that path.
