# T343 review: the stale-tree warning reads content, not a commit count (PR #1125)

Runtime: CC (claude -p, Opus)
SEAT: job runner (QA PC or Lenovo), NOT the desktop. No hub key. **Read-only: no commit, no push, no PR, no PR comment,
no edit outside the launcher's clone.** Ends at a VERDICT, which decides an SG-1 merge. You are the QA judge; the build
was a separate run (job 1259), so you are not judging your own work.
REPLY: the absolute reply path the launcher names. Print it FIRST. Line 1 of the reply is `VERDICT: ACCEPT`,
`VERDICT: ACCEPT-WITH-NOTES` or `VERDICT: REJECT`; line 2 is `MODEL: <your model id>`.

**By:** Atlas (planner), 2026-11-17, session 178. **Task:** T-343. **Tag:** `t343-review`.
**Spec:** `docs/loops/t343-brief.md` (in the launcher's clone).
**START:** `34032165dfc555b757ce4c357b4b11a68cc99c2b`. **CAND:** `caa04f4b516ae9675aec1304a596c58ff39b5fb2` (one commit on START,
branch `loop/t343`). Review CAND, never the launcher's own sha: `git fetch origin loop/t343` and
`git checkout -q caa04f4b516ae9675aec1304a596c58ff39b5fb2`.

```text
IMPACT-TARGETS: none: review only; no repository file is changed
```

## Already proved by the planner (do not repeat)

- CAND is byte-for-byte START + `docs/loops/t343/edits.txt` + the copied test file (byte-compare, 2 files SAME, no EXTRA).
- The build run reported: the six step-4 files 52 passed; mutants m1-m7 each red exactly as predicted; full suite
  5012 passed, 1 failed (`tests/harness/checks.test.ts` D4 "the default BUILD check spawns successfully", an npm error on
  the Lenovo host). **Check that one row yourself (step 3).**

## Rules

- Do not read, copy or print `~/.claude.json`, `~/.claude/settings.json`, any `.mcp.json`, `.env` or key file.
- Paste each command with its output. Every number is pasted output. Mark anything not run NOT RUN, with the reason.
- A finding needs file:line at CAND and a concrete failing input (a repo state and the line printed). Put style points
  under NITS, apart from findings.

## Steps

1. `node -v` must print `v22.*`. `git rev-parse HEAD` must print CAND. `git diff --name-status 34032165..HEAD` must print
   exactly `M open-brain/src/pipelines/session-start/tree-currency.ts` and
   `A open-brain/tests/pipelines/session-start/t343-tree-currency-content.test.ts`.
2. **Read** `git diff 34032165..HEAD -- open-brain/src` and the whole of `tree-currency.ts` at CAND. Answer each, with
   the line:
   a. Can a checkout whose record (`.agents/state.json` or any `.agents/` path) differs from the upstream ref's ever get
      the "level with" line or the calm `Tree currency: ... record current with ...` line? Consider: an uncommitted
      record edit, a record committed locally but not upstream (ahead and behind at once), a rename out of `.agents/`,
      a submodule or symlink at `.agents`, a shallow clone, a detached HEAD, an upstream ref that does not exist.
   b. Does every failed or empty git call in `behindContent` fall back to today's STALE lines, never to silence or to
      the calm line?
   c. Is the text of the unchanged cases (diverged, ahead, record-behind, skip, and "behind" when the record differs)
      byte-identical to START? Name any changed byte.
   d. Callers: `git grep -n "severity\|describeTreeCurrency\|THIS TREE IS STALE\|Tree currency" -- open-brain/src scripts`.
      Does any caller branch on a severity value or match a line prefix in a way the new `behind-code` value or the new
      line breaks (greeting-metrics alarms, the SessionStart hook text, `/sync` checks, record-source)?
   e. With a FAILED fetch, do the two new cases still say the comparison is unconfirmed?
3. **Run**, in `open-brain`: `npm ci`; `node -e "require('better-sqlite3')"`;
   `npx vitest run tests/pipelines/session-start --no-file-parallelism --testTimeout=180000` (paste `Test Files` and
   `Tests`); then `npx vitest run tests/harness/checks.test.ts --no-file-parallelism --testTimeout=180000` at CAND and,
   if any row is red, the same file at START (`git stash` is forbidden: use `git worktree add ../t343-start 34032165`
   and `npm ci` there). Say whether the D4 row is red at START too.
4. **Surviving mutants.** Name any single-line change to `behindContent` or to the two new `describe` branches that
   the ten T343 rows would NOT catch. For each you name, apply it, run
   `npx vitest run tests/pipelines/session-start/t343-tree-currency-content.test.ts`, paste the result, and restore the
   file with `git checkout -- <file>` (allowed here: the clone is yours and nothing is committed).
5. **Live shape.** In a scratch directory make the two real cases with plain git (a seed repo, a clone, an
   `.agents/state.json` with a `revision`): (i) the clone one `--no-ff` merge commit behind with an identical tree;
   (ii) the clone behind by one commit that changes only a file outside `.agents/`. For each, run the built CLI's
   start (`node open-brain/build/cli.js start <clone>` after `npm run build`) or, if that needs more setup than the
   fixture has, call `describeTreeCurrency` from a one-line node script against the build. Paste the currency line(s).

## Verdict

REJECT for: any yes to 2a, any silent or calm fallback in 2b, any changed byte in 2c, a broken caller in 2d, a row red at
CAND and green at START, or a surviving mutant that changes which of the three cases a repo state lands in.
ACCEPT-WITH-NOTES for anything else worth a follow-up. List findings, then NITS, then what was NOT RUN.
