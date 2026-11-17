# T344b: the t344 build again, with rows for four surviving mutants (T-344, T-312); supersedes PR #1127

Runtime: CC (claude -p, Opus)
SEAT: job runner (Lenovo or QA PC), NOT the desktop. No hub key. Code. Ends at READY with a PR, or HANDBACK; no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-17, session 178. **Tasks:** T-344, T-312. **Tag:** `t344b`. **Size:** SMALL (one source
file, six test files). **Base:** the START sha the launcher names (a master that contains this brief and does NOT
contain PR #1127). **Authority:** the backlog (D-145); merge on Atlas's QA ACCEPT, sent to clark. No auth, deps,
workflows or hooks.

```text
IMPACT-TARGETS: renderBudgeted (session-start/briefing.ts), BRIEFING_BUDGET (session-start/briefing.ts)
```

## Why a second build

PR #1127 (CAND `4ebf6d23f2b82868d752bedf581aeef5abb93165`, brief `docs/loops/t344-brief.md`) was READY and its review
found the source correct on every behaviour (a) to (e). The review REJECTED it on four single-line mutants that change
what a reader sees and that no row caught: three in `cutSentence`, one in `cutWord`. This build supersedes PR #1127 and
is **tests only on top of it**: the source it produces is byte for byte the source at that CAND. Do not touch the
branch of PR #1127.

## What changes

Two edit files, applied in order:

1. `docs/loops/t344/edits.txt` (unchanged, 28 edits in 7 files): everything `docs/loops/t344-brief.md` describes under
   "What changes" and "Existing tests that pin this behaviour". That brief's table of red rows and new values still
   holds and is not repeated here.
2. `docs/loops/t344b/edits.txt` (2 edits in 1 file, `tests/pipelines/session-start/briefing-budget.test.ts`): one
   assertion added to T312-1 and four new rows at the end of the "T-312 and T-344" describe.

| row | fixture (arithmetic checked with a standalone copy of the string functions) | expected output | kills |
|---|---|---|---|
| T312-1, added line | the row's `capped` render (5 questions owned by aaron) | the lines starting `WAITING ON AARON` are exactly `["WAITING ON AARON (5):"]` | review nit E (a `none` line beside a section that has items) |
| T344-3 | `"word " x500`, `Then stop. `, `"tail " x297`, `done`: exactly 4000 characters, full stop at index 2509 | the pick-up whole, 4000 characters | m8 (review F) |
| T344-4 | `Done. `, `"word " x998`, `word`: 5000 characters, the only full stop at index 4, a space at index 4000 | `Done. ` + `"word " x798` + `word` + `... (5000 chars)`: 4014 characters | m9 (review G) |
| T344-5 | steps `1. ` to `11. `, each `"word " x64` then `done.` (3620 characters joined), then ` 12. ` and `"word " x199`, `word`: 4624 characters | the eleven steps + `... (4624 chars)`: 3634 characters; it does not end on `12.` | m10 (review H) |
| T344-6 | watch-out `"a" x176`, ` 2026-11-24T`, `"b" x150`: 338 characters, the only space at index 176 (200 - 24) | `- ` + `"a" x176` + `... (338 chars)`: 191 characters | m11 (review J) |

(`...` in this table stands for the ellipsis character the code prints.)

## Steps

1. **Shell.** Windows host: PowerShell, `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `$env:NO_COLOR='1'`.
   Linux host: bash, `export NO_COLOR=1`, and use `cp` where a step says `Copy-Item` (backups under `/tmp`). Either way
   `node -v` must print `v22.*`. Say which host you are on.
2. **Branch.** In the clone at START: `git checkout -q -b build/t344b`. HEAD must equal START and the porcelain must be
   empty. `git grep -c PICK_UP_SAFETY_CHARS -- open-brain/src` must print nothing (exit 1): if it prints a count,
   PR #1127 was merged after all; STOP, `BLOCKED t344b base already has t344`. In `open-brain`: `npm ci` (exit code),
   then `node -e "require('better-sqlite3')"`; on "Could not locate the bindings file" run
   `npm rebuild better-sqlite3` and say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes, any MCP config, `npm install`,
     anything under `docs/`, and the branch of PR #1127.
3. **Apply, in this order.**
   - `node docs/loops/t344b/apply.cjs . docs/loops/t344/edits.txt` must print exactly `APPLIED 28 edits to 7 files`.
   - `node docs/loops/t344b/apply.cjs . docs/loops/t344b/edits.txt` must print exactly `APPLIED 2 edits to 1 files`.
   - `git hash-object open-brain/src/pipelines/session-start/briefing.ts` must print
     `b3a38754e6c1442c2cf4f2f28f813596b29069ce` (the blob at the reviewed CAND). Anything else: STOP,
     `BLOCKED t344b source differs from CAND`, with the hash printed.
   - In `open-brain`: `npx tsc --noEmit` (exit 0), `npx tsc -p tsconfig.tests.json --noEmit` (exit 0), `npm run build`
     (exit 0).
4. **The twelve files.** In `open-brain`:
   `npx vitest run tests/pipelines/session-start/briefing-budget.test.ts tests/pipelines/session-start/t167-problem.test.ts tests/pipelines/session-start/handoff-by-checkout.test.ts tests/pipelines/session-start/missing-handoff.test.ts tests/pipelines/session-start/t302-merged-citations.test.ts tests/pipelines/sync/t316-s2.test.ts tests/pipelines/session-start/focus.test.ts tests/pipelines/session-start/standing-budget.test.ts tests/pipelines/session-start/t309-done-objective.test.ts tests/pipelines/session-start/t161-transcript.test.ts tests/pipelines/session-start/a2a-byte-identical.test.ts tests/s173h.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed. Paste `Test Files`, `Tests`, and the two measure lines: `T302-WORST lines=31 chars=4151` and
   `B1-MEASURE 30 lines 5799 chars` (the values the first build and the review both measured; a different value is not
   a STOP, paste it). A red row here: STOP, `BLOCKED t344b rows <rows>`, with each assertion message (expected vs
   received). The output carries non-ASCII characters: paste it as printed, and if you filter it use `grep -a`.
5. **Mutants**, each on the applied tree. Back up once from the clone root (Windows `$env:TEMP`, Linux `/tmp`):
   `open-brain/src/pipelines/session-start/briefing.ts` -> `t344b-br.bak`. Use `Copy-Item` or `cp`, never
   `Get-Content | Set-Content` (it mangles the file's non-ASCII characters).
   For each `docs/loops/t344b/mN.txt` (m1-m11): `node docs/loops/t344b/apply.cjs . docs/loops/t344b/mN.txt` (must print
   `APPLIED 1 edits to 1 files`), run step 4's command, paste the failed rows, restore the file from its backup (never
   git checkout). m1-m7 are the first build's files, copied unchanged. Predicted red (m1-m7: seen red in the first
   build, the T344-3 to T344-6 additions simulated standalone; m8-m11: simulated standalone, NOT run in vitest):

   | mutant | the one changed line (briefing.ts line at CAND) | predicted red |
   |---|---|---|
   | m1 | no total on WATCH OUT (365) | T312-1, "WORST CASE keeps the facts" |
   | m2 | `shownWatch` keeps the first three (300) | T312-2 |
   | m3 | the `none` line never prints (380) | T312-3, "prints `WAITING ON AARON: none`...", "reads each seat's CURRENT handoff only" |
   | m4 | the pick-up cap back at 400 (356) | T344-1, T344-3, T344-4, T344-5, t302 M6, t316-s2 R7, the plain and every-flag WORST CASE rows, the SIA-shaped row, A2A's real record for planner and qa, the first missing-handoff budget row, focus B1 |
   | m5 | the watch-out cut blind (366) | T344-2, T344-6 |
   | m6 | the back-off unbounded (266) | "a cut line says how long the text was", t309 D3 |
   | m7 | past 4000 the pick-up cut is blind (356) | T344-1, T344-5 |
   | m8 (review F) | `cutSentence`: `flat.length < limit` (283; the file carries the next line too, because `cutWord` has the same line at 264) | T344-3 |
   | m9 (review G) | `cutSentence`: `end > 0` in place of `end >= limit / 2` (286) | T344-4 |
   | m10 (review H) | `cutSentence`: the regex without the list-marker lookbehind (285) | T344-5 |
   | m11 (review J) | `cutWord`: `space > limit - CUT_BACKOFF` (266) | T344-6 |

   **A mutant with NO red row is a STOP** (`BLOCKED t344b <m> survives`). Other differences from the prediction are not
   a STOP: paste the rows and go on; the planner rules. After the last restore, rerun step 4: 0 failed.
6. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap). Expect 0
   failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook timeout is rerun
   alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole `Unhandled Errors` section if any.
   A red `tests/harness/checks.test.ts` D4 is not a STOP (the first build had it red too): paste its last stderr line
   and go on; CI judges it. Any other red row: STOP, `BLOCKED t344b suite <rows>`, with each assertion message.
7. **Sync.** From the clone root: `node open-brain/build/cli.js sync 2>&1 | grep -a -E "module-boundary|retirements"`
   (Windows: `Select-String -Pattern "module-boundary|retirements"`). Paste every line; both must be `[pass]`.
8. **Commit.** One commit, `T344: budgeted briefing prints the pick-up whole and totals its capped lists (T-344, T-312)`.
   - Stage exactly the 7 paths: `open-brain/src/pipelines/session-start/briefing.ts`,
     `open-brain/tests/pipelines/session-start/briefing-budget.test.ts`,
     `open-brain/tests/pipelines/session-start/handoff-by-checkout.test.ts`,
     `open-brain/tests/pipelines/session-start/missing-handoff.test.ts`,
     `open-brain/tests/pipelines/session-start/t302-merged-citations.test.ts`,
     `open-brain/tests/pipelines/sync/t316-s2.test.ts`,
     `open-brain/tests/pipelines/session-start/focus.test.ts`.
   - The message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - No git identity on the host and `git config` writes forbidden: commit with GIT_AUTHOR_*/GIT_COMMITTER_* env vars
     (Forge, melvenac@gmail.com).
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows those 7 paths, all `M`.
9. **Push and open the PR**, only on a host that can push. A host that cannot push (the Lenovo, read-only token) stops
   after step 8 and replies `HANDBACK t344b <sha40>`; the planner lands the commit with `job.mjs land`. Do not try to push there.
   - Push, never force. `git ls-remote origin refs/heads/build/t344b` must equal HEAD.
   - `gh pr create --base master --head build/t344b --title "T344: budgeted briefing prints the pick-up whole and totals its capped lists (T-344, T-312)" --body "Brief: docs/loops/t344b-brief.md. Supersedes #1127: same source, four more test rows."`.
   - Do not close PR #1127; the planner does.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Reply

- **First line:** `READY t344b <sha40> PR #<n>`, `HANDBACK t344b <sha40>` (no-push host, steps 1-8 all passed) or
  `BLOCKED t344b <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge. Name any HIGH, CRITICAL or UNKNOWN impact target from the launcher's
  prompt and say which rows cover its callers.

## After merge (not this run)

As in `docs/loops/t344-brief.md`: `sia-rebuild.sh <mergesha>` and the three live checks; greeting-metrics is left as it
is (`greeting_chars` is the full text, so the dashboard ratio can pass 4400 on a long pick-up); the three `start.md`
copies still say "WATCH OUT is every item" and a follow-up rewords them. Review nits left for a later task, none of
them in this run: past 4000 characters `cutSentence` can end inside a backtick-quoted command and treats `e.g.` as a
sentence end; the A2A real-record row subtracts the whole pick-up line, which is exact only while no note rides it.
