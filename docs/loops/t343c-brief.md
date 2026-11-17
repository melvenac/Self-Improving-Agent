# T343c: the stale-tree warning reads content; one more row for the status pathspec (T-343; supersedes PR #1131)

Runtime: CC (claude -p, Opus)
SEAT: job runner (Lenovo or QA PC), NOT the desktop. No hub key. Code. Ends at READY with a PR, or HANDBACK; no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-17, session 178. **Tasks:** T-343. **Tag:** `t343c`. **Size:** SMALL (one source file,
one new test file). **Base:** the START sha the launcher names (a master that contains this brief). This is a fresh
build from master, NOT a commit on top of PR #1125's or PR #1131's branch.
**Authority:** the backlog (D-145); merge on Atlas's QA ACCEPT, sent to clark. No auth, deps, workflows or hooks.

```text
IMPACT-TARGETS: describeTreeCurrency (session-start/tree-currency.ts), compare (session-start/tree-currency.ts), describe (session-start/tree-currency.ts)
```

`compare` and `describe` are module-private and their names are common, so the launcher may rate them UNKNOWN. Their
only caller chain is `describeTreeCurrency`, which has three callers in `open-brain/src`: `cli-bootstrap.ts:210` (the
SessionStart hook), `pipelines/session-start/start-report.ts:132` (ob_start), and `pipelines/sync/checks.ts:2657`
(`composeGreeting`). All three take `.lines` only; nothing in `src` reads `.severity` (both reviews confirmed it).

## Why this supersedes PR #1131 (CAND 7486b537)

The t343b build was READY: its 13 mutants went red as predicted. The round-2 review confirmed F1 and F2 fixed and the
source correct, and REJECTED on one new surviving mutant:

- **N2.** Dropping `"--", ".agents"` from the `git status` call in `behindContent` passes all 19 rows. Yet it turns a
  real state, a tree behind by code only with an uncommitted edit to a tracked file OUTSIDE `.agents/`, from the calm
  line into `THIS TREE IS STALE`. That is every builder with uncommitted code. Nothing pinned the pathspec.

**The source does not change.** This build produces `tree-currency.ts` byte-identical to CAND 7486b537 (step 3 pins
its blob hash). The only difference from PR #1131 is one more test row, T343-20.

## What changes

1. `docs/loops/t343/edits.txt`, 7 edits, then `docs/loops/t343b/edits.txt`, 3 edits, to
   `open-brain/src/pipelines/session-start/tree-currency.ts`: both unchanged, both described in
   `docs/loops/t343-brief.md` and `docs/loops/t343b-brief.md`. There is no `t343c/edits.txt`.
2. `docs/loops/t343c/t343-tree-currency-content.test.ts`: the 19 rows of t343b's file, unchanged, plus:
   - **T343-20** (review N2): the clone tracks `code.txt` and is 1 commit behind (upstream added `lib/b.txt`), with an
     uncommitted append to `code.txt`. The row first asserts `git status --porcelain` is `M code.txt` (the test helper
     trims porcelain's leading space), then expects severity `behind-code` and exactly the one calm line,
     `1 commit behind ... 1 non-record file differs`.

## Existing tests that pin this behaviour (planner read; not simulated)

Same table and verdicts as `docs/loops/t343-brief.md`: no existing row turns red. The t343b build ran step 4 at
CAND 7486b537: 61 passed. T343-1 to T343-19 were green there. T343-20 is green at CAND by the review's fixture x7,
which printed the calm line for this state.

## Steps

1. **Shell.** Windows host: PowerShell, `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `$env:NO_COLOR='1'`.
   Linux host: bash, `export NO_COLOR=1`, and use `cp` where a step says `Copy-Item` (backups under `/tmp`). Either way
   `node -v` must print `v22.*`. Say which host you are on.
2. **Branch.** In the clone at START: `git checkout -q -b build/t343c`. HEAD must equal START and the porcelain must be
   empty. `git grep -c behindContent -- open-brain/src` must print nothing (exit 1): if it prints a count, an earlier
   T343 PR was merged after all; STOP, `BLOCKED t343c base already has t343`. In `open-brain`: `npm ci` (exit code),
   then `node -e "require('better-sqlite3')"`; on "Could not locate the bindings file" run
   `npm rebuild better-sqlite3` and say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes, any MCP config, `npm install`,
     anything under `docs/`, `.github/`, `.claude/`, `package.json`, `greeting-metrics.ts`, and the branches of PR #1125
     and PR #1131 (fetching `loop/t343b` to read one hash, below, is allowed; checking it out is not).
3. **Apply**, two commands in this order, from the clone root:
   - `node docs/loops/t343c/apply.cjs . docs/loops/t343/edits.txt` must print exactly `APPLIED 7 edits to 1 files`.
   - `node docs/loops/t343c/apply.cjs . docs/loops/t343b/edits.txt` must print exactly `APPLIED 3 edits to 1 files`.
   **Pin the source.** `git hash-object open-brain/src/pipelines/session-start/tree-currency.ts` must print
   `584e195173b0a42c52b8e72325a49ed609c2776d`. Then `git fetch -q origin loop/t343b` and
   `git rev-parse 7486b537:open-brain/src/pipelines/session-start/tree-currency.ts` must print the same hash. A
   different hash from either command: STOP, `BLOCKED t343c source differs from CAND`, pasting both. If the fetch fails
   because the branch is gone, say so, mark the second command `NOT RUN`, and go on: the first hash is the pin.
   Then
   `Copy-Item docs/loops/t343c/t343-tree-currency-content.test.ts open-brain/tests/pipelines/session-start/t343-tree-currency-content.test.ts`
   (the file from `t343c/`, NOT the ones in `t343/` or `t343b/`) and, from the clone root,
   `git add open-brain/tests/pipelines/session-start/t343-tree-currency-content.test.ts` (S4 guard D1b fails on an
   untracked test file). In `open-brain`: `npx tsc --noEmit` (exit 0), `npx tsc -p tsconfig.tests.json --noEmit`
   (exit 0), `npm run build` (exit 0).
4. **The six files.** In `open-brain`:
   `npx vitest run tests/pipelines/session-start/t343-tree-currency-content.test.ts tests/pipelines/session-start/tree-currency.test.ts tests/pipelines/session-start/tree-currency-fetch.test.ts tests/pipelines/session-start/upstream-ref.test.ts tests/pipelines/session-start/t298-s4.test.ts tests/s173g.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed, 62 passed, and 20 tests in the t343 file. Paste `Test Files` and `Tests`. A red row here: STOP,
   `BLOCKED t343c rows <rows>`, with each assertion message (expected vs received).
5. **Mutants**, each on the applied tree. Back up once from the clone root (Windows `$env:TEMP`, Linux `/tmp`):
   `open-brain/src/pipelines/session-start/tree-currency.ts` -> `t343c-tc.bak`.
   For each `docs/loops/t343c/mN.txt` (m1-m14): apply (must print `APPLIED 1 edits to 1 files`), in `open-brain` run
   `npx vitest run tests/pipelines/session-start/t343-tree-currency-content.test.ts tests/pipelines/session-start/tree-currency.test.ts --no-file-parallelism --testTimeout=180000`,
   paste the failed rows, restore the file from its backup (never git checkout). m1-m13 are byte copies of t343b's.
   Predicted red (rows 1-19 confirmed by the t343b build; row 20 and m14 NOT simulated):
   - m1 (tree-equality check inverted): T343-1, -2, -3, -6, -7, -8, -9, -13, -14, -15, -16, -17, and now -20.
   - m2 (revision-equality check dropped): T343-18.
   - m3 (the `.agents/` path check on the diff dropped): T343-3, -15, -16.
   - m4 (unreadable-tree-hash fallback dropped): T343-5.
   - m5 (unreadable-file-list fallback returns 1): T343-6.
   - m6 (no-record guard dropped): T343-7.
   - m7 (FAILED-fetch rewording made a no-op): T343-8.
   - m8 (the working-copy status check removed): T343-11, -12, -19.
   - m9 (`--no-renames` dropped): T343-15.
   - m10 (`-z` dropped from the diff): T343-16, -17.
   - m11 (`differ` forced to `differs`): T343-17.
   - m12 (`dirty !== ""` weakened to `dirty`): T343-19.
   - m13 (`--untracked-files=no` dropped): T343-13.
   - m14 (review N2: `"--", ".agents"` dropped from the status call): T343-20 only.
   **A mutant with NO red row is a STOP** (`BLOCKED t343c <m> survives`). Other differences from the prediction are not
   a STOP: paste the rows and go on; the planner rules. After the last restore, rerun step 4: 0 failed, and rerun the
   `git hash-object` command of step 3: the same hash.
6. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap). Expect 0
   failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook timeout is rerun
   alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole `Unhandled Errors` section if any.
   A red `tests/harness/checks.test.ts` D4 is not a STOP: paste its last stderr line and go on (the review reproduced it
   red at START on the QA PC). Any other red row: STOP, `BLOCKED t343c suite <rows>`, with each assertion message.
7. **Sync.** From the clone root: `node open-brain/build/cli.js sync 2>&1 | grep -E "module-boundary|retirements"`
   (Windows: `Select-String -Pattern "module-boundary|retirements"`). Paste every line; both must be `[pass]`.
8. **Commit.** One commit, `T343c: the stale-tree warning reads content and the working copy's record (T-343)`.
   - Stage exactly the 2 paths: `open-brain/src/pipelines/session-start/tree-currency.ts`,
     `open-brain/tests/pipelines/session-start/t343-tree-currency-content.test.ts`.
   - The message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - No git identity on the host and `git config` writes forbidden: commit with GIT_AUTHOR_*/GIT_COMMITTER_* env vars
     (Forge, melvenac@gmail.com).
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows those 2 paths: the source file `M`, the test file `A`.
   - `git rev-parse HEAD:open-brain/src/pipelines/session-start/tree-currency.ts` prints
     `584e195173b0a42c52b8e72325a49ed609c2776d`.
9. **Push and open the PR**, only on a host that can push. A host that cannot push (the Lenovo, read-only token) stops
   after step 8 and replies `HANDBACK t343c <sha40>`; the planner lands the commit with `job.mjs land`. Do not try to push there.
   - Push, never force. `git ls-remote origin refs/heads/build/t343c` must equal HEAD.
   - `gh pr create --base master --head build/t343c --title "T343c: the stale-tree warning reads content and the working copy's record (T-343)" --body "Brief: docs/loops/t343c-brief.md. Supersedes #1131 and #1125; source identical to #1131, one more test row."`.
   - Do not close, comment on or push to #1125 or #1131; the planner closes them.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Reply

- **First line:** `READY t343c <sha40> PR #<n>`, `HANDBACK t343c <sha40>` (no-push host, steps 1-8 all passed) or
  `BLOCKED t343c <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

Unchanged from `docs/loops/t343b-brief.md`, plus: (5) a builder tree behind by code-only commits with uncommitted code
outside `.agents/` prints the `record current with` line, not `THIS TREE IS STALE`.
