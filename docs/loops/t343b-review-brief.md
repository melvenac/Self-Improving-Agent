# T343b review, round 2: the stale-tree warning reads content (PR #1131, supersedes #1125)

Runtime: CC (claude -p, Opus)
SEAT: job runner (QA PC or Lenovo), NOT the desktop. No hub key. **Read-only: no commit, no push, no PR, no PR comment,
no edit outside the launcher's clone.** Ends at a VERDICT, which decides an SG-1 merge. You are the QA judge; the build
was a separate run (job 1289).
REPLY: the absolute reply path the launcher names. Print it FIRST. Line 1 of the reply is `VERDICT: ACCEPT`,
`VERDICT: ACCEPT-WITH-NOTES` or `VERDICT: REJECT`; line 2 is `MODEL: <your model id>`.

**By:** Atlas (planner), 2026-11-17, session 178. **Task:** T-343. **Tag:** `t343b-review`.
**Spec:** `docs/loops/t343b-brief.md` and `docs/loops/t343-brief.md` (both in the launcher's clone).
**START:** `589cb66c01b5e4ff23336160d55e1b3b2debfb18`. **CAND:** `7486b537f4e07f192605d7c5dcc2595d6fa1f992` (one commit on START,
branch `loop/t343b`). Review CAND, never the launcher's own sha: `git fetch origin loop/t343b` and
`git checkout -q 7486b537f4e07f192605d7c5dcc2595d6fa1f992`.

```text
IMPACT-TARGETS: none: review only; no repository file is changed
```

## Round 1 and what changed

Round 1 (job 1285, on CAND caa04f4b) was REJECT on two findings, both accepted by the planner:
- F1: an uncommitted edit to a tracked `.agents/` file that keeps the revision got the calm or level line.
- F2: `--no-renames` and `-z` on the diff call were unpinned (mutants MA, MB' survived).
Round 1 found 2b (fallbacks), 2c (unchanged cases byte-identical), 2d (callers) and 2e (failed fetch) sound, and D4 in
`tests/harness/checks.test.ts` red at START too. Do not repeat those unless the round-2 diff touches them.

CAND now adds, in `behindContent` after the revision check:
`git status --porcelain -z --untracked-files=no -- .agents`; non-empty output or a failed call returns null (STALE).
**Planner ruling to judge against, not to re-argue:** untracked files do NOT force STALE. `ob_start` itself creates an
untracked `.agents/SESSIONS/Session_N.md` in repos that do not ignore session logs, and an untracked file cannot make
the record older than master. Rows T343-11 to T343-19 are new; m8 to m13 are new mutants.

## Already proved by the planner

- CAND is byte-for-byte START + `docs/loops/t343/edits.txt` + `docs/loops/t343b/edits.txt` + the copied test file.
- The build run: six step-4 files 61 passed; m1-m13 each red exactly as predicted, none survived; full suite 5021
  passed, 1 failed (D4, as before).

## Rules

- Do not read, copy or print `~/.claude.json`, `~/.claude/settings.json`, any `.mcp.json`, `.env` or key file.
- Paste each command with its output. Every number is pasted output. Mark anything not run NOT RUN, with the reason.
- A finding needs file:line at CAND and a concrete failing input (a repo state and the line printed).

## Steps

1. `node -v` must print `v22.*`. `git rev-parse HEAD` must print CAND. `git diff --name-status 589cb66c..HEAD` must print
   exactly the `M` source file and the `A` test file.
2. **Read** `behindContent` and both new `describe` branches at CAND. Answer, with the line:
   a. F1: with the round-1 fixtures (v) and (vi) rebuilt, does CAND print STALE? Is there any OTHER way for a tracked
      `.agents/` file to differ from the upstream ref's while the calm or level line prints (staged-only change, a
      deleted tracked file, a mode change, `assume-unchanged`, `skip-worktree`, a change outside the pathspec because
      the repo root is not the project root, i.e. `.agents` in a subdirectory of the git repo)?
   b. Is the `status` call's failure distinguishable from a clean result, and does failure return null?
   c. Does `git status --porcelain -z --untracked-files=no -- .agents` exit 0 with empty output when `.agents` does not
      exist, when it is empty, and in a detached checkout? (Run it.)
   d. Cost: the status call runs at every session start in a "behind" tree. Time it on this clone
      (`time git status --porcelain -z --untracked-files=no -- .agents`). Report the number; over 2 s is a NOTE.
3. **Run**, in `open-brain`: `npm ci`; `node -e "require('better-sqlite3')"`;
   `npx vitest run tests/pipelines/session-start --no-file-parallelism --testTimeout=180000`. Paste `Test Files`, `Tests`.
4. **Surviving mutants, again.** Re-apply round 1's MA and MB' (now expected red: say which row). Then name any NEW
   single-line change to `behindContent` or the two `describe` branches that the 19 T343 rows would not catch; apply,
   run the T343 file, paste, restore with `git checkout -- <file>`. Round 1's MD (the unreachable `files.length === 0`
   guard) may still survive: it is accepted as defensive and is not a REJECT.
5. **Live shape**, after `npm run build`, with plain-git fixtures and a direct `describeTreeCurrency` call (a schema v1
   record makes `cli.js start` exit 1 after the currency line, as round 1 found): (i) one `--no-ff` merge behind,
   identical tree; (ii) behind by one non-record file; (iii) case (ii) plus an untracked `.agents/SESSIONS/Session_9.md`
   (expect the calm line); (iv) case (ii) plus an uncommitted edit to tracked `.agents/TASKS/INBOX.md` (expect STALE).
   Paste the line(s) for each.

## Verdict

REJECT for: F1 or F2 not fixed, a tracked `.agents/` difference that still gets the calm or level line by a route a
seat could plausibly hit (say how), a failed status call that does not fall back to STALE, a row red at CAND, or a new
surviving mutant that moves a repo state between the three cases. `assume-unchanged` and `skip-worktree` on a record
file are deliberate local overrides: report them, they are NOTES. ACCEPT-WITH-NOTES for anything else.
