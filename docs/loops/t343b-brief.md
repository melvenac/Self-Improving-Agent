# T343b: the stale-tree warning reads content, and the working copy under .agents/ (T-343; supersedes PR #1125)

Runtime: CC (claude -p, Opus)
SEAT: job runner (Lenovo or QA PC), NOT the desktop. No hub key. Code. Ends at READY with a PR, or HANDBACK; no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-17, session 178. **Tasks:** T-343. **Tag:** `t343b`. **Size:** SMALL (one source file,
one new test file). **Base:** the START sha the launcher names (a master that contains this brief). This is a fresh
build from master, NOT a commit on top of PR #1125's branch.
**Authority:** the backlog (D-145); merge on Atlas's QA ACCEPT, sent to clark. No auth, deps, workflows or hooks.

```text
IMPACT-TARGETS: describeTreeCurrency (session-start/tree-currency.ts), compare (session-start/tree-currency.ts), describe (session-start/tree-currency.ts)
```

`compare` and `describe` are module-private and their names are common, so the launcher may rate them UNKNOWN. Their
only caller chain is `describeTreeCurrency`, which has three callers in `open-brain/src`: `cli-bootstrap.ts:210` (the
SessionStart hook), `pipelines/session-start/start-report.ts:132` (ob_start), and `pipelines/sync/checks.ts:2657`
(`composeGreeting`). All three take `.lines` only; nothing in `src` reads `.severity` (the review of #1125 confirmed it).

## Why this supersedes PR #1125 (CAND caa04f4b)

The t343 build was READY and its seven mutants went red as predicted. The Opus review (job #1285) REJECTED on two
findings the planner accepts:

- **F1.** `behindContent` saw the working copy only through the `revision` number. An uncommitted edit under `.agents/`
  that keeps the revision got the calm line (review fixture v) or the `level with` line (fixture vi), where master
  prints `THIS TREE IS STALE`.
- **F2.** Dropping `--no-renames` or `-z` from the `git diff` call still passed all ten rows, and each removal moves a
  real repo state from STALE to the calm line (fixtures iii and iv). The code was right; no row pinned it.

Nits taken: the plural `differ` was never exercised; the `files.length === 0` guard is unreachable and needed a comment
saying so; the "two checks" comment overstated what was covered. The FAILED-fetch count nit is left alone.

## What changes

Two edit files, applied in order to `open-brain/src/pipelines/session-start/tree-currency.ts`, and one new test file.

1. `docs/loops/t343/edits.txt`, 7 edits: unchanged from the t343 brief (`docs/loops/t343-brief.md` describes them:
   `behindContent`, the `behind-code` severity and its calm line, the same-tree note, the FAILED-fetch rewording).
2. `docs/loops/t343b/edits.txt`, 3 edits on top:
   - **F1.** In `behindContent`, straight after the revision check:
     `const dirty = git(projectRoot, ["status", "--porcelain", "-z", "--untracked-files=no", "--", ".agents"]); if (dirty !== "") return null;`
     The file's `git()` helper returns the trimmed stdout, so `""` for a clean tree, and `null` when the call throws, so
     `!== ""` covers both a change and a failed call. Only TRACKED files count (`--untracked-files=no`, the planner's
     ruling): ob_start creates this session's log, `.agents/SESSIONS/Session_N.md`, untracked and not ignored in most
     repos, at every start, and an untracked file cannot make the record here older than master's. Ignored files
     (`AGENT.local.md`) are omitted by `--porcelain` as well.
   - The doc comment now says three checks and names what none of them sees.
   - A comment that `files.length === 0` is defensive.
3. `docs/loops/t343b/t343-tree-currency-content.test.ts`: the ten t343 rows unchanged (one import line widened), plus
   T343-11 to T343-19.

Order of the checks in `behindContent` after both files: revisions equal; `.agents/` clean in the working copy; both
tree hashes readable; trees equal (returns 0, the level line); a record exists; the diff readable; no `.agents/` path in
it (returns the file count, the calm line). Every failure returns null, which is today's STALE warning.

**Alarm:** unchanged from t343: none for either calm case; `greeting-metrics.ts` is not edited.

## Existing tests that pin this behaviour (planner read; not simulated)

Same table as `docs/loops/t343-brief.md`, same verdicts: no existing row turns red. The new status call runs only when
`classify` says `behind` and the revisions are equal, and every existing `behind` fixture changes the revision. The
review ran the 53 session-start files at CAND: 695 passed. `.agents/retirements.json` names no line of this file (0
hits at the base).

Rows in the new file (T343-1 to T343-10 are the t343 rows, green at CAND):

| row | fixture | expects |
|---|---|---|
| T343-11 | review (v): 1 code commit behind, uncommitted append to tracked `.agents/TASKS/INBOX.md` | STALE |
| T343-12 | review (vi): identical-tree merge case, `state.json` edited in place, revision kept | STALE |
| T343-13 | 3 code commits behind, an untracked, not ignored `.agents/SESSIONS/Session_9.md` (the session log) | calm line |
| T343-14 | 3 code commits behind, an untracked `.agents/AGENT.local.md` ignored through `.git/info/exclude` | calm line |
| T343-15 | review (iii): upstream `git mv .agents/TASKS/INBOX.md docs/INBOX.md`, revision unchanged | STALE |
| T343-16 | review (iv): upstream adds `.agents/notes-<u-umlaut>.md` (written `\u00fc` in the source) | STALE |
| T343-17 | 2 commits behind, 2 non-record files | `2 non-record files differ`, whole line |
| T343-18 | 3 code commits behind, `state.json` marked skip-worktree and rewritten at rev 0 (status prints nothing) | STALE, from the revision check |
| T343-19 | 3 code commits behind, the `status` call refused by the gate | STALE |

T343-18 exists because T343-10 no longer isolates the revision check: with F1 in place the status check also catches
an uncommitted `state.json`.

## Steps

1. **Shell.** Windows host: PowerShell, `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `$env:NO_COLOR='1'`.
   Linux host: bash, `export NO_COLOR=1`, and use `cp` where a step says `Copy-Item` (backups under `/tmp`). Either way
   `node -v` must print `v22.*`. Say which host you are on.
2. **Branch.** In the clone at START: `git checkout -q -b build/t343b`. HEAD must equal START and the porcelain must be
   empty. `git grep -c behindContent -- open-brain/src` must print nothing (exit 1): if it prints a count, PR #1125 was
   merged after all; STOP, `BLOCKED t343b base already has t343`. In `open-brain`: `npm ci` (exit code), then
   `node -e "require('better-sqlite3')"`; on "Could not locate the bindings file" run `npm rebuild better-sqlite3` and
   say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes, any MCP config, `npm install`,
     anything under `docs/`, `.github/`, `.claude/`, `package.json`, `greeting-metrics.ts`, and the branch of PR #1125.
3. **Apply**, two commands in this order, from the clone root:
   - `node docs/loops/t343b/apply.cjs . docs/loops/t343/edits.txt` must print exactly `APPLIED 7 edits to 1 files`.
   - `node docs/loops/t343b/apply.cjs . docs/loops/t343b/edits.txt` must print exactly `APPLIED 3 edits to 1 files`.
   Then
   `Copy-Item docs/loops/t343b/t343-tree-currency-content.test.ts open-brain/tests/pipelines/session-start/t343-tree-currency-content.test.ts`
   (the file from `t343b/`, NOT the one in `t343/`) and, from the clone root,
   `git add open-brain/tests/pipelines/session-start/t343-tree-currency-content.test.ts` (S4 guard D1b fails on an
   untracked test file). In `open-brain`: `npx tsc --noEmit` (exit 0), `npx tsc -p tsconfig.tests.json --noEmit`
   (exit 0), `npm run build` (exit 0).
4. **The six files.** In `open-brain`:
   `npx vitest run tests/pipelines/session-start/t343-tree-currency-content.test.ts tests/pipelines/session-start/tree-currency.test.ts tests/pipelines/session-start/tree-currency-fetch.test.ts tests/pipelines/session-start/upstream-ref.test.ts tests/pipelines/session-start/t298-s4.test.ts tests/s173g.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed, and 19 tests in the t343 file. Paste `Test Files` and `Tests`. A red row here: STOP,
   `BLOCKED t343b rows <rows>`, with each assertion message (expected vs received).
5. **Mutants**, each on the applied tree. Back up once from the clone root (Windows `$env:TEMP`, Linux `/tmp`):
   `open-brain/src/pipelines/session-start/tree-currency.ts` -> `t343b-tc.bak`.
   For each `docs/loops/t343b/mN.txt` (m1-m13): apply (must print `APPLIED 1 edits to 1 files`), in `open-brain` run
   `npx vitest run tests/pipelines/session-start/t343-tree-currency-content.test.ts tests/pipelines/session-start/tree-currency.test.ts --no-file-parallelism --testTimeout=180000`,
   paste the failed rows, restore the file from its backup (never git checkout). Predicted red (NOT simulated; m1-m7
   were confirmed on the t343 text for rows 1-10 only):
   - m1 (tree-equality check inverted): T343-1, -2, -3, -6, -7, -8, -9, -13, -14, -15, -16, -17.
   - m2 (revision-equality check dropped): T343-18. (T343-10 stays green now: the status check catches it.)
   - m3 (the `.agents/` path check on the diff dropped): T343-3, -15, -16.
   - m4 (unreadable-tree-hash fallback dropped): T343-5.
   - m5 (unreadable-file-list fallback returns 1): T343-6.
   - m6 (no-record guard dropped): T343-7.
   - m7 (FAILED-fetch rewording made a no-op): T343-8.
   - m8 (the working-copy status check removed): T343-11, -12, -19.
   - m9 (`--no-renames` dropped): T343-15.
   - m10 (`-z` dropped from the diff): T343-16, -17.
   - m11 (`differ` forced to `differs`): T343-17.
   - m12 (`dirty !== ""` weakened to `dirty`, so a failed status call passes): T343-19.
   - m13 (`--untracked-files=no` dropped): T343-13 only. T343-14's ignored file is invisible to `--porcelain` either way.
   **A mutant with NO red row is a STOP** (`BLOCKED t343b <m> survives`). Other differences from the prediction are not
   a STOP: paste the rows and go on; the planner rules. After the last restore, rerun step 4: 0 failed.
6. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap). Expect 0
   failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook timeout is rerun
   alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole `Unhandled Errors` section if any.
   A red `tests/harness/checks.test.ts` D4 is not a STOP: paste its last stderr line and go on (the review reproduced it
   red at START on the QA PC). Any other red row: STOP, `BLOCKED t343b suite <rows>`, with each assertion message.
7. **Sync.** From the clone root: `node open-brain/build/cli.js sync 2>&1 | grep -E "module-boundary|retirements"`
   (Windows: `Select-String -Pattern "module-boundary|retirements"`). Paste every line; both must be `[pass]`.
8. **Commit.** One commit, `T343b: the stale-tree warning reads content and the working copy's record (T-343)`.
   - Stage exactly the 2 paths: `open-brain/src/pipelines/session-start/tree-currency.ts`,
     `open-brain/tests/pipelines/session-start/t343-tree-currency-content.test.ts`.
   - The message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - No git identity on the host and `git config` writes forbidden: commit with GIT_AUTHOR_*/GIT_COMMITTER_* env vars
     (Forge, melvenac@gmail.com).
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows those 2 paths: the source file `M`, the test file `A`.
9. **Push and open the PR**, only on a host that can push. A host that cannot push (the Lenovo, read-only token) stops
   after step 8 and replies `HANDBACK t343b <sha40>`; the planner lands the commit with `job.mjs land`. Do not try to push there.
   - Push, never force. `git ls-remote origin refs/heads/build/t343b` must equal HEAD.
   - `gh pr create --base master --head build/t343b --title "T343b: the stale-tree warning reads content and the working copy's record (T-343)" --body "Brief: docs/loops/t343b-brief.md. Supersedes #1125."`.
   - Do not close, comment on or push to #1125; the planner closes it.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Reply

- **First line:** `READY t343b <sha40> PR #<n>`, `HANDBACK t343b <sha40>` (no-push host, steps 1-8 all passed) or
  `BLOCKED t343b <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild.sh <mergesha>`. Live checks, read-only: (1) the next planner `/start` in a tree whose only missing commit
is the merge of its own records PR, with `git status --porcelain --untracked-files=no -- .agents` empty, prints
`Tree currency: level with origin/master (... N commit(s) behind with the same content)` from both the hook and
ob_start; (2) the same tree with an uncommitted change to a TRACKED file under `.agents/` prints `THIS TREE IS STALE`, and
an untracked session log alone does not; note how often a seat starts with modified tracked record views, because
those keep the capitals warning; (3) a seat tree behind by code-only commits prints the `record current with` line; (4) the next
`greeting-metrics.jsonl` row for (1) or (3) has no `tree_stale` in `alarm_streaks`.
