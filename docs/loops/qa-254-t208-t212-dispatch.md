# QA 254: T-208 (fetch before currency) + T-212 (handoff check attributes by trailer)

**By:** Atlas (planner), 2026-10-02, record session 157. **Dev dispatch:** `docs/loops/session-157-dev-dispatches.md`,
the sia-forge section. Each task's acceptance text is its `note` in `.agents/state.json`.

**Candidates**, by sia-forge, base `79d1f5d9`:

- **T-208:** `e442b955` on `origin/loop/t208-fetch-first` (PR #289).
- **T-212:** `626f7d13`, stacked on T-208, on `origin/loop/t212-trailer-attribution` (PR #290). The tip `1e61ccb2` adds
  the handoff and a mutant diff only.

**Handoff:** `docs/loops/t208-t212-developer-handoff.md` on the T-212 branch.

**QA runs on Opus. Job class: LIGHT.** Touched test files, mutants on those files only, and `gh` reads. No full
suite. **Make no live Jev call.** Fixtures only: never fetch from or push to the real origin, except your own report
push.

## T-208 rows

1. **Confined.** `git diff 79d1f5d9...e442b955` touches `cli-bootstrap.ts`, `tree-currency.ts`, their test and a
   mutant diff only.
2. **Red then green.** Run the candidate's `tree-currency-fetch.test.ts` against the base source: it is red. Against
   the candidate: green. Quote the counts.
3. **Your own fixtures** (local bare repos as origin):
   - **(a) The origin moves after the last fetch.** Start reads `behind`, never `level`.
   - **(b) An unreachable origin** (a path that does not exist). Start prints
     `fetch FAILED: <cause>; currency is against a fetch from <time>`, and the word `level` does not appear after it.
   - **(c) A hanging remote** (for example an `ext::` or `file://` transport that never answers, or a wrapper that
     sleeps). Start returns within the 15 s bound plus a margin. Quote the wall time.
   - **(d) Prune.** A branch deleted on the origin is gone locally after start.
   - **(e) Resume.** The resume event takes the same path.
4. **Your own mutants:**
   - (a) skip the fetch;
   - (b) drop the timeout;
   - (c) say `level` after a failed fetch.

   Report which rows catch each one.
5. **`ob_start` still states the fetch time it compared against.** Quote it from a fixture run. **The /start text
   has no fetch step.** Run `git grep` and quote the result.

## T-212 rows

6. **Confined.** `git diff e442b955...626f7d13` touches `handoff-guard.ts`, `cli-session-end.ts` (one line, the only
   caller) and the test. Quote the `cli-session-end.ts` hunk.
7. **Red then green**, as in row 2, against `e442b955` source.
8. **Your own fixtures:**
   - **(a) Shared identity, no trailer:** UNATTRIBUTED, not blamed on this seat.
   - **(b) A trailer for another session:** not counted.
   - **(c) A trailer for this session:** counted, and the missing-handoff warning still fires when the handoff is
     absent.
   - **(d) No `bridge-session` line** in the transcript: `unknown`, never a pass.
   - **(e)** A trailer whose id is `session_<X>` when the transcript says `cse_<X>`: matched.
   - **(f)** A trailer with different case or whitespace. Report what happens and whether it matters.
9. **Your own mutant:** fall back to identity when no trailer exists. Report which row catches it.
10. **Regression check:** for a seat whose own commits carry trailers, the check still warns when the handoff is
    missing. This is the reason the check exists, so show that T-212 did not make it inert.

## Both

11. **Nothing else moved.** Run the touched tests and the `session-start`/`session-end` neighbours. Check that
    `tsc --noEmit` is 0 at both heads.
12. **CI on the heads (read only).** For `e442b955`, `626f7d13` and `1e61ccb2`: give the event, conclusion and `test`
    job for each run.

## Rules (headless Claude Code)

- You are **QA 254**, and your prefix is `t208-t212`. Push ONLY `qa/t208-t212-*` branches, and only through
  `node docs/loops/qa-254/push-qa.mjs <branch>`, run from `~/qa-scratch/qa254-wt`.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read CI.
- Commit `docs/loops/t208-t212-qa-report.md` with its `.E_t.json` on `qa/t208-t212-report`. Give each task its own
  verdict line. The last line is exactly `QA-254: REPORT COMPLETE`.
