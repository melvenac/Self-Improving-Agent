# T295S1: the MCP server stops registering ob_score and ob_feedback (T-295 S1)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 174. **Task:** T-295 S1 (P2). **Tag:** `t295s1`. **Size:** SMALL (11 edits in
7 files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief). **Authority:**
Aaron at the planner's desk, 2026-10-26: "Cut 14 to 10". S1 is the two cuts; S2 moves ob_stats and ob_list to the CLI.

```text
IMPACT-TARGETS: handleScore handleFeedback
```

## Why

`ob_score` duplicates `ob_sync` with `score: true` (its trend view is `cli.js sync --history`). `ob_feedback` records one
rating; `ob_end`'s `entry_ratings` records the same per-entry ratings, and no transcript has called ob_feedback since
09-26. The server stops registering both. `handleScore` and `handleFeedback` stay exported (t048-r3 and t003-r2 call
them directly). The command files that named `ob_score` point at `ob_sync` and `cli.js sync --history`; CLAUDE.md and
README say 12 tools. The deleted ob_feedback description was a hashed allowed line for retirement R-011 ("maturity
lifecycle"), so its hash leaves `.agents/retirements.json` in the same change.

## The change, exactly

Files under `docs/loops/t295s1/`.
- **`t295-s1-tool-cut.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t295-s1-tool-cut.test.ts`. R1
  (tools/list over stdio is exactly the twelve), R2 (no repo command file names an unregistered tool).
- **`edits.txt`:** 11 edits in 7 files: `open-brain/src/server.ts` (the two registrations), `.claude/commands/sync.md`
  and `project-template/.claude/commands/sync.md` (identical edits), `project-template/.cursor/commands/sync.md`,
  `CLAUDE.md`, `README.md` (two), `.agents/retirements.json` (one stale line hash, `7f95baa8...`, removed from the
  server.ts referrer of R-011).

## Measured before dispatch

QA PC SIM `sim-t295s1` (job #133) at `7cccf4d1`, with the first 10 edits: c, d, e and the mutants held exactly.
- Baseline: four files `1 failed | 3 passed (4)`, `1 failed | 120 passed (121)`; red R1 only.
- Edit: `APPLIED 10 edits to 6 files`; both tsc runs and the build exit 0; sync.md and its template mirror identical;
  four files `121 passed (121)`.
- m1 (ob_feedback registered again) R1; m2 (sync.md names ob_score again) R2.
- Wide run: one red row, `tests/pipelines/sync/retirements-live.test.ts` "R-011 ... no unexpected referrer":
  `open-brain/src/server.ts missing 1 allowed line(s) hash 7f95baa88053...`. The 11th edit removes exactly that hash
  (it occurs once in the file; the JSON stays valid). That row is in this build's early file set below.
- `sync --check`'s `command-tool-names` named only `~/.claude/commands/sync.md` on the QA PC (outside the clone, an old
  copy). Environment; not checked here.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/t048-r3.test.ts`, `tests/t003-r2.test.ts` | stay green | They call the kept handlers directly. Green in the SIM. |
| `tests/t315-proxy.test.ts` (`ob_stats` as a fake child's tool) | stays green | Names as data, not the real server. Green in the SIM. |
| `tests/pipelines/sync/retirements-live.test.ts` R-011 | green after the 11th edit | Red in the SIM without it, on exactly the removed hash. |
| `tests/pipelines/sync/checks.test.ts` command-tool-names rows | stay green | Fixtures, not the repo's files. Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t295s1 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the five files below, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red row in the five files after step 4 is never an exception.

## Steps

"The five files" means, from `open-brain`:
`npx vitest run tests/t295-s1-tool-cut.test.ts tests/t048-r3.test.ts tests/t003-r2.test.ts tests/pipelines/sync/checks.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t295s1-tool-cut`. HEAD must equal START and the porcelain
   must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash, reset --hard,
   force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real `~/.claude/`, any
   MCP config, and anything under `docs/`.
3. **Commit 1** (`T295S1: rows for the two tool cuts`).
   - `Copy-Item docs/loops/t295s1/t295-s1-tool-cut.test.ts open-brain/tests/t295-s1-tool-cut.test.ts`.
   - Run the five files. Expect `1 failed | 4 passed (5)` files, red R1 only (retirements-live green at START). Paste the
     summary and each `x` row. Commit the test file.
4. **Commit 2** (`T295S1: the MCP server stops registering ob_score and ob_feedback (T-295 S1)`).
   - `node docs/loops/t295s1/apply.cjs . docs/loops/t295s1/edits.txt` prints exactly `APPLIED 11 edits to 7 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build`
     (exit 0). From the clone root: `Compare-Object (Get-Content .claude/commands/sync.md) (Get-Content project-template/.claude/commands/sync.md)`
     prints nothing.
   - Run the five files: 0 failed.
   - `npx vitest run tests/server.test.ts tests/pipelines tests/t315-proxy.test.ts tests/t295-s1-tool-cut.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait). Expect
     0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync --check 2>&1 | Select-String -Pattern "retirements|module-boundary"`.
     Paste every line (`module-boundary [pass]`; no retirements line naming server.ts).
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for m1 and m2: `node docs/loops/t295s1/apply.cjs . docs/loops/t295s1/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run `npx vitest run tests/t295-s1-tool-cut.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and the `x` rows (expected: m1 -> R1; m2 -> R2); restore with
   `git checkout -- open-brain/src .claude` and check the status is empty. After m2, run the five files once more:
   0 failed. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 8 paths: `M .agents/retirements.json`,
   `M .claude/commands/sync.md`, `M CLAUDE.md`, `M README.md`, `M open-brain/src/server.ts`,
   `A open-brain/tests/t295-s1-tool-cut.test.ts`, `M project-template/.claude/commands/sync.md`,
   `M project-template/.cursor/commands/sync.md`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t295s1-tool-cut` must equal HEAD.
   `gh pr create --base master --head feat/t295s1-tool-cut --title "T295S1: the MCP server stops registering ob_score and ob_feedback (T-295 S1)" --body "Brief: docs/loops/t295s1-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t295s1 <sha40> PR #<n>` or `BLOCKED t295s1 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`; each session's `/mcp reconnect open-brain` drops the two tools. Re-copy `~/.claude/commands/sync.md`
(and `~/.cursor/commands/sync.md`) from master, or /sync's command-tool-names flags `ob_score` in them. Live check:
`tools/list` from the rebuilt server shows twelve.
