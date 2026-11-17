# T343: the stale-tree warning reads content, not a commit count (T-343)

Runtime: CC (claude -p, Opus)
SEAT: job runner (Lenovo or QA PC), NOT the desktop. No hub key. Code. Ends at READY with a PR, or HANDBACK; no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-17, session 178. **Tasks:** T-343. **Tag:** `t343`. **Size:** SMALL (one source file,
one new test file). **Base:** the START sha the launcher names (a master that contains this brief).
**Authority:** the backlog (D-145); merge on Atlas's QA ACCEPT, sent to clark. No auth, deps, workflows or hooks.

```text
IMPACT-TARGETS: describeTreeCurrency (session-start/tree-currency.ts), compare (session-start/tree-currency.ts), describe (session-start/tree-currency.ts)
```

`compare` and `describe` are module-private and their names are common, so the launcher may rate them UNKNOWN. Their
only caller chain is `describeTreeCurrency`, which has three callers in `open-brain/src`: `cli-bootstrap.ts:210` (the SessionStart hook),
`pipelines/session-start/start-report.ts:132` (ob_start), and `pipelines/sync/checks.ts:2657` (`composeGreeting`). All
three take `.lines` only; nothing in `src` reads `.severity`.

## What changes

`docs/loops/t343/edits.txt`, 7 edits in 1 file (`open-brain/src/pipelines/session-start/tree-currency.ts`), and one new
test file copied from `docs/loops/t343/t343-tree-currency-content.test.ts`.

Today `classify` returns `behind` whenever `rev-list --count` finds a commit on the upstream ref that HEAD lacks, and
`describe` prints `THIS TREE IS STALE`. Only that case is re-read; `diverged`, `ahead`, `record-behind`, `skip` and a
level tree are untouched.

A new private function `behindContent` runs when `classify` says `behind`, and returns:

- **0** when the record revision is equal on both sides and `git rev-parse HEAD^{tree}` equals
  `git rev-parse <upstream>^{tree}`. Severity becomes `current`. The existing level line prints, with the count kept
  inside its brackets:
  `Tree currency: level with origin/master (record here rev 634, at origin/master rev 634; 1 commit behind with the same content) ...`
  (the rest of the line is unchanged).
- **n > 0** when the trees differ, the revision is equal and not null on both sides, and
  `git diff --name-only --no-renames -z HEAD <upstream> --` lists n files, none under `.agents/`. Severity is the new
  value `behind-code`, one line:
  `Tree currency: 3 commits behind origin/main, record current with origin/main (record here rev 193, at origin/main rev 193); 1 non-record file differs. Compared against the last fetch (<time>), not the network. Not the drift line: drift compares the rendered views to .agents/state.json within this tree.`
- **null** in every other case, which keeps today's three STALE lines byte for byte: the revisions differ (the revision
  here is read from the working copy, so an uncommitted older record counts), a path under `.agents/` differs, there is
  no record on either side and the trees differ, or any of the three git calls fails.

After a FAILED fetch (`describeTreeCurrency`'s existing branch): the identical-tree case is `current`, so it already
prints `no difference seen against ... not confirmed since`; the `behind-code` line has `record current with` replaced
by `record showing no difference from`, in the existing `.replace` chain.

**Alarm:** none for either new case. `greeting-metrics.ts` is not edited: its `tree_stale` pattern is
`/^THIS TREE IS STALE/m` and neither new line starts with that.

## Existing tests that pin this behaviour (planner read; not simulated)

| file / row | verdict |
|---|---|
| tree-currency.test.ts "reports BEHIND with the commit count and both record revisions" (rev 1 here, rev 3 upstream) | stays green: the revisions differ |
| tree-currency.test.ts "names the comparison so it cannot be read as the drift line", "RESOLVES a real last-fetch timestamp" (rev 1 vs rev 2) | stay green, same reason |
| tree-currency.test.ts current, SAYS SO, linked worktree, both SKIP rows, ahead, DIVERGED, absent upstream, record-behind | stay green: `classify` does not return `behind` |
| tree-currency-fetch.test.ts row 1 + 6 (`toContain("THIS TREE IS STALE: 1 commit behind origin/master")`, rev 1 vs rev 2) | stays green |
| tree-currency-fetch.test.ts rows 2, 3, 5, r2 rows, "a successful fetch leaves the lines exactly as before" | stay green: level, or behind an origin the clone could not fetch |
| upstream-ref.test.ts UR-4, UR-6 (rev 1 vs rev 2, asserts `headBehind` 1 and `origin/main`) | stay green |
| t298-s4.test.ts R1, R2, R4 (diverged, or level with the record branch) | stay green |
| s173g.test.ts R3 (ahead) | stays green |
| t327-objective-stale.test.ts :109, t318-s1.test.ts :36 (the `tree_stale` id in a list and in a fake streak) | unaffected: `ALARM_IDS` is not edited |

No existing row turns red. No file this brief edits is named in `.agents/retirements.json` (0 hits for `tree-currency`
at the base, and 0 hits for the hashes of the two replaced lines).

New rows, all in the new file `open-brain/tests/pipelines/session-start/t343-tree-currency-content.test.ts`: T343-1
(identical tree: level, count visible), T343-2 (same record, one file: the calm line, exact), T343-3 (same revision, a
record file differs: STALE), T343-4 (revision differs: all three STALE lines, exact), T343-5 (tree hashes unreadable:
STALE), T343-6 (file list unreadable: STALE), T343-7 (no record on either side: STALE), T343-8 and T343-9 (the two new
cases after a FAILED fetch), T343-10 (working-copy record behind, commits differ only in code: STALE). T343-4, T343-7
and T343-10 are pins: they are green before the edits as well. Rows 5 and 6 wrap `execFileSync` with
`vi.mock("node:child_process")`, the pattern `tests/t259-erasure-scan.test.ts` and `tests/harness/configwatch-a13.test.ts`
already use.

## Steps

1. **Shell.** Windows host: PowerShell, `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `$env:NO_COLOR='1'`.
   Linux host: bash, `export NO_COLOR=1`, and use `cp` where a step says `Copy-Item` (backups under `/tmp`). Either way
   `node -v` must print `v22.*`. Say which host you are on.
2. **Branch.** In the clone at START: `git checkout -q -b build/t343`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci` (exit code), then `node -e "require('better-sqlite3')"`; on "Could not locate the
   bindings file" run `npm rebuild better-sqlite3` and say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes, any MCP config, `npm install`,
     anything under `docs/`, `.github/`, `.claude/`, `package.json`, and `greeting-metrics.ts`.
3. **Apply.** `node docs/loops/t343/apply.cjs . docs/loops/t343/edits.txt` must print exactly
   `APPLIED 7 edits to 1 files`. Then
   `Copy-Item docs/loops/t343/t343-tree-currency-content.test.ts open-brain/tests/pipelines/session-start/t343-tree-currency-content.test.ts`
   and, from the clone root, `git add open-brain/tests/pipelines/session-start/t343-tree-currency-content.test.ts`
   (S4 guard D1b fails on an untracked test file). In `open-brain`: `npx tsc --noEmit` (exit 0),
   `npx tsc -p tsconfig.tests.json --noEmit` (exit 0), `npm run build` (exit 0).
4. **The six files.** In `open-brain`:
   `npx vitest run tests/pipelines/session-start/t343-tree-currency-content.test.ts tests/pipelines/session-start/tree-currency.test.ts tests/pipelines/session-start/tree-currency-fetch.test.ts tests/pipelines/session-start/upstream-ref.test.ts tests/pipelines/session-start/t298-s4.test.ts tests/s173g.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed. Paste `Test Files` and `Tests`. A red row here: STOP, `BLOCKED t343 rows <rows>`, with each assertion
   message (expected vs received).
5. **Mutants**, each on the applied tree. Back up once from the clone root (Windows `$env:TEMP`, Linux `/tmp`):
   `open-brain/src/pipelines/session-start/tree-currency.ts` -> `t343-tc.bak`.
   For each `docs/loops/t343/mN.txt` (m1-m7): apply (must print `APPLIED 1 edits to 1 files`), in `open-brain` run
   `npx vitest run tests/pipelines/session-start/t343-tree-currency-content.test.ts tests/pipelines/session-start/tree-currency.test.ts --no-file-parallelism --testTimeout=180000`,
   paste the failed rows, restore the file from its backup (never git checkout). Predicted red (NOT simulated):
   - m1 (tree-equality check inverted): T343-1, T343-2, T343-3, T343-6, T343-7, T343-8, T343-9.
   - m2 (revision-equality check dropped): T343-10.
   - m3 (the `.agents/` path check dropped): T343-3.
   - m4 (unreadable-tree-hash fallback dropped): T343-5.
   - m5 (unreadable-file-list fallback returns 1): T343-6.
   - m6 (no-record guard dropped): T343-7.
   - m7 (FAILED-fetch rewording made a no-op): T343-8.
   **A mutant with NO red row is a STOP** (`BLOCKED t343 <m> survives`). Other differences from the prediction are not
   a STOP: paste the rows and go on; the planner rules. After the last restore, rerun step 4: 0 failed.
6. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap). Expect 0
   failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook timeout is rerun
   alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole `Unhandled Errors` section if any.
   A red `tests/harness/checks.test.ts` D4 is not a STOP: paste its last stderr line and go on; CI judges it. Any other
   red row: STOP, `BLOCKED t343 suite <rows>`, with each assertion message. (Most likely source if one appears: a test
   that builds a clone behind its origin by a commit that does not touch `.agents/`, and expects `THIS TREE IS STALE`
   or `severity` `behind`. The planner found none by grep.)
7. **Sync.** From the clone root: `node open-brain/build/cli.js sync 2>&1 | grep -E "module-boundary|retirements"`
   (Windows: `Select-String -Pattern "module-boundary|retirements"`). Paste every line; both must be `[pass]`.
8. **Commit.** One commit, `T343: the stale-tree warning reads content, not a commit count (T-343)`.
   - Stage exactly the 2 paths: `open-brain/src/pipelines/session-start/tree-currency.ts`,
     `open-brain/tests/pipelines/session-start/t343-tree-currency-content.test.ts`.
   - The message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - No git identity on the host and `git config` writes forbidden: commit with GIT_AUTHOR_*/GIT_COMMITTER_* env vars
     (Forge, melvenac@gmail.com).
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows those 2 paths: the source file `M`, the test file `A`.
9. **Push and open the PR**, only on a host that can push. A host that cannot push (the Lenovo, read-only token) stops
   after step 8 and replies `HANDBACK t343 <sha40>`; the planner lands the commit with `job.mjs land`. Do not try to push there.
   - Push, never force. `git ls-remote origin refs/heads/build/t343` must equal HEAD.
   - `gh pr create --base master --head build/t343 --title "T343: the stale-tree warning reads content, not a commit count (T-343)" --body "Brief: docs/loops/t343-brief.md."`.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Reply

- **First line:** `READY t343 <sha40> PR #<n>`, `HANDBACK t343 <sha40>` (no-push host, steps 1-8 all passed) or
  `BLOCKED t343 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild.sh <mergesha>`. Live checks, read-only: (1) the next planner `/start` in a tree whose only missing commit
is the merge of its own records PR prints `Tree currency: level with origin/master (... N commit(s) behind with the same
content)` from both the hook and ob_start, and no `THIS TREE IS STALE`; (2) a seat tree behind by code-only commits
prints the `record current with` line; (3) the next `greeting-metrics.jsonl` row for either has no `tree_stale` in
`alarm_streaks`.
