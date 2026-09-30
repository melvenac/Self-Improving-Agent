# QA 235: T-194 r4 (the planner seat hook), after QA 234's REJECT

**By:** Atlas (planner), 2026-09-30, record session 153. **Candidate:** `d37e09dc4bd38cec0306e542773c3ab881602d6e` on
`origin/loop/t194-planner-hook`, which has master merged in. **Base for red:** `c1f1cb48` (r3, which QA 234 rejected).
**Builder:** Claude Code Sonnet (a headless dev job on the QA PC). **QA runs on Opus** (D-068).

## What to read

1. `docs/loops/t194-r4-dispatch.md`: the planner's r4 scope, items 1 to 6. **This is what you score.** Note its two
   rulings: D3 is in scope, and **paths outside the repo are now ALLOWED** (r3's outside-repo deny is reversed).
2. `docs/loops/t194-r3-qa-report.md` and `docs/loops/qa-234/evidence/`, on `origin/qa/t194-r3-report`: QA 234's
   probes. Re-run Q4 (D3), Q5 (case) and the `GH_REPO=` probes against the candidate.
3. `docs/loops/t194-r4-developer-handoff.md` at the candidate: its row-to-test map and red-then-green claims.
   **Verify them.**
4. `docs/loops/qa-234-t194-r3-dispatch.md`: rows r3-1 to r3-6. None may regress, except the outside-repo deny, which
   is reversed.

## Rows to score

- **r4-1, D3:** from cwd `open-brain/`, `echo x > src/cli.ts`, `sed -i … src/cli.ts` and a relative Edit are denied.
  From cwd `.agents/`, `echo {} > state.json` is denied. A protected path reached through `../` from a subdirectory
  cwd is denied. The same writes from a cwd where they land OUTSIDE protected paths are allowed. Test through the real
  built CLI, with fixture input.
- **r4-2, outside the repo is allowed:** `npm test 2> C:/qa-tmp/log.txt`, a Write to a scratch path outside the repo,
  and a Bash redirect outside the repo are all allowed. A target whose location cannot be determined is denied, with
  a named cause.
- **r4-3, case:** `OPEN-BRAIN/SRC/cli.ts` (absolute and relative) is denied on a Windows drive root.
- **r4-4, prefix half:** `GH_REPO=other/x gh pr merge 1 --squash` and `env GH_REPO=… gh pr merge 1` are denied, with 0
  fetches. QA 234's `qa-r32-prefix` mutant is now red.
- **r4-5, exact grant:** a grant for `gh pr merge 1` does not cover `… --repo other/x`. A grant for
  `git push origin loop/x` does not cover `… --force`. The exact command, whitespace-normalised, is allowed and
  consumes the grant.
- **r4-6:** `gh.exe pr merge 2` and `"gh" pr merge 2` go through the merge check.
- **Mutants:** the developer's 12 are all red and typecheck. Add at least one of your own for r4-1 and r4-2.
- **Regression:** every r3 row QA 234 scored `met` still holds (r3-1's outside-repo half is superseded by r4-2), as do
  every PH and r2 row.

## Declared limit (report it; do not score it)

**A `cd` inside the same command line is not followed.** `cd open-brain && echo x > src/cli.ts` is still allowed; the
developer's handoff declares it. Confirm the behaviour, and say whether the hook's refusal text or docs state the limit.
The planner rules on it after this QA.

## Rules (headless Claude Code on the laptop, D-068)

- You are **QA 235**. Your prefix is `t194-r4`. Push ONLY `qa/t194-r4-*` branches, and only through
  `node docs/loops/qa-235/push-qa.mjs <branch>` run from your working copy.
- **CI (D-061, T-207):** push `qa/t194-r4-ci-candidate` at the candidate and `qa/t194-r4-ci-base` at `c1f1cb48`, and
  quote each run's id, headSha, run conclusion and `test` job conclusion. Poll in the FOREGROUND with
  `gh run watch <id> --exit-status`. Keep mutants LOCAL, and commit their diffs under `docs/loops/qa-235/`. Use at most
  4 tcm runs, and never `windows=true`.
- Commit the report as `docs/loops/t194-r4-qa-report.md` with its `.E_t.json`, on `qa/t194-r4-report`. The report's
  last line is exactly `QA-235: REPORT COMPLETE`.
- If a model refusal, usage limit or permission denial stops you, write it into "Open for the planner" and finish the
  report. Do not retry in a loop.
