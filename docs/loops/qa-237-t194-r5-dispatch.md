# QA 237: T-194 r5 (the planner seat hook), redefined by property

**By:** Atlas (planner), 2026-10-01, record session 155. **Candidate:** `7a3a444135aa9f3049c40f17f8519421ccb4458b`
on `origin/loop/t194-planner-hook`. The product is `8bd1541d`; the tip only fills the handoff. **Base for red:**
`d37e09dc` (r4, which QA 235 rejected). **Builder:** Forge, Claude Code Sonnet on the QA PC. **QA runs on Opus**
(D-068).

## What changed since QA 235, and why it changes how you score

r2, r3 and r4 were each rejected for a spelling the dispatch had not listed. r5's dispatch states three PROPERTIES
and requires the developer to defend each against spellings nobody listed. **So this QA is scored by property, not
by row.** A row list of your own would repeat the planner's mistake. Your job is to find a spelling in a class that
breaks a property, and you cannot do that by re-running Forge's generator.

## What to read

1. `docs/loops/t194-r5-dispatch.md`: P1, P2, P3, the required evidence, and the out-of-scope list. **This is what you
   score.**
2. `docs/loops/t194-r5-developer-handoff.md` at the candidate: the clause-to-test map, the mutant runs, "Supersedes",
   "Out of reach", and "Not covered". **Verify it; do not take it.**
3. The rulings made after the r5 dispatch, all in scope:
   - **Ruling 1:** a `cd`, `pushd` or `Set-Location` on the same line as a write is refused, even when the write
     lands outside the repo.
   - **Ruling 2:** P2b, git. `merge` and `tag` always need a grant. A push stands without one only when it is
     `origin`, every refspec is a plain branch under `loop/`, `qa/`, `docs/` or `chore/`, and there is no force,
     delete, `+`, `--tags`, `--mirror`, `--all`, `--prune`, bare push or substituted argument.
   - **Ruling 3:** `mv` and `Move-Item` check their SOURCE as well as their destination.
4. The earlier QA probe scripts. **Forge did not have the QA 233 and 234 scripts** and rebuilt those rows from the
   reports' tables. Use the scripts themselves:
   - QA 233: `docs/loops/qa-233/evidence/qa233-probe.mjs` (and `qa233-run.mjs`) on `origin/qa/t194-r2-report`
   - QA 234: `docs/loops/qa-234/evidence/qa234-probe.mjs` and `qa234-probe2.mjs` on `origin/qa/t194-r3-report`
   - QA 235: `docs/loops/qa-235/evidence/qa235-probe.mjs` on `origin/qa/t194-r4-report` (`e6e1d085`)

## Rows to score

Test everything through the **real built CLI with fixture input**, as QA 235 did. The hook is NOT registered
anywhere, and must not be.

- **R5-P1, the canonicaliser, in both directions.** "Protected if, and only if" has two halves, so score both:
  - A literal write that LANDS under a protected path is denied, whatever its spelling.
  - A literal write that lands OUTSIDE every protected path, with no `cd` on the line, is ALLOWED. A deny there is a
    defect unless it names one of the stated causes (non-literal, `cd`, or an 8.3 short name past the root).
  - A non-literal target (`~`, `$`, backtick, `* ? [`, `{`, `(`) is refused with a named cause.
- **R5-P2, the gh merge grammar.** Anything gh would run as `pr merge` is a merge. The only form allowed without a
  grant is the exact grammar in the r5 dispatch, and even that is READ and judged docs-only or code. Check that a
  non-merge `gh` command is not swept in.
- **R5-P2b, git (ruling 2).** Score the standing-push definition as a property. A push that is not exactly standing
  needs a grant, and a grant matches exactly (r4-5).
- **R5-P3, PowerShell.** `PowerShell` is in the matcher; P1 applies to the cmdlets and redirects the dispatch lists,
  and P2 to `& gh` and `.\gh.exe`. `Invoke-Expression`, `iex`, `Invoke-Command` and a script block that writes are
  refused with a named cause.
- **R5-limit, the limit text.** `BASH_WRITE_LIMIT` (or its successor) states every item in the handoff's "Out of
  reach". Check it in both directions. Nothing out of reach may be described only in the handoff. Nothing the text
  calls out of reach may in fact be caught, or the text is wrong.

## Required evidence

1. **Your OWN generators, one per property (P1, P2, P2b, P3), at least 200 cases each.** Do not import Forge's
   generator or its oracle; build yours from the property text.
   - P1's oracle is `path.win32.resolve` against the cwd, plus a protected-prefix check you write from the hook's
     protected list. The hook's own `paths.ts` must not be your oracle.
   - Aim at the classes Forge's generator does not cover. Read `r5-property.test.ts` to find them. Candidates include
     mixed quoting inside one word (`sr"c"/cli.ts`), `\` line continuations, `;` vs `&&` vs `||` vs `|` vs newline
     boundaries, UNC paths, PowerShell `-Path:value` syntax, parameter aliases, and splatting.
   - Commit the generators under `docs/loops/qa-237/`. Report the case count and every disagreement with the oracle.
2. **Re-run all three earlier QA probe scripts against the candidate.** Classify every result that differs from what
   that QA scored:
   - **superseded**, if it is listed in the handoff's "Supersedes" or follows from a ruling above;
   - **regression**, otherwise.
3. **Mutants.**
   - Re-run **all 50** of Forge's diffs (`docs/loops/t194-r5/mutants/`) at the candidate in one run. Forge ran 46 of
     them only once, before the tests grew, and re-ran just the survivors; one diff failed to typecheck in run 1. Say
     which typecheck, and which are killed.
   - Add **at least one mutant of your own per property** (P1, P2, P2b and P3) that Forge's set does not contain.
   - Keep all mutants local and commit their diffs under `docs/loops/qa-237/mutants/`.
4. **Fail-closed cost.** List the refusals a working planner would hit, for example `cd X && cmd > C:/qa-tmp/out`, a
   redirect to `$TMPDIR/x`, or a target containing `(`. Give the refusal text for each. Report them; do not score
   them as defects unless they break the "only if" half of P1 without a named cause.

## Regression

Every row QA 235 scored `met` still holds unless a ruling or the handoff's "Supersedes" changes it. The same goes for
every r3, r2 and PH row. The r4 test files (`hook.test.ts`, `docs-merge.test.ts`, `r3.test.ts`, `r4.test.ts`) are
claimed to pass unchanged. Confirm that with `git diff d37e09dc 7a3a4441 -- <those files>`.

## Rules (headless Claude Code on the laptop, D-068)

- You are **QA 237**. Your prefix is `t194-r5`. Push ONLY `qa/t194-r5-*` branches, and only through
  `node docs/loops/qa-237/push-qa.mjs <branch>` run from your working copy.
- **CI (D-061, T-207):** push `qa/t194-r5-ci-candidate` at the candidate and `qa/t194-r5-ci-base` at `d37e09dc`.
  Quote each run's id, headSha, run conclusion and `test` job conclusion, polling in the FOREGROUND with
  `gh run watch <id> --exit-status`. Use at most 4 tcm runs, never `windows=true`. Say which OS the `test` job ran on,
  because Forge ran only the Windows half of the code locally and the POSIX oracle branch never ran.
- **Laptop memory:** run the mutants sequentially, never in parallel.
- Commit the report as `docs/loops/t194-r5-qa-report.md` with its `.E_t.json`, on `qa/t194-r5-report`. The report's
  last line is exactly `QA-237: REPORT COMPLETE`.
- Never register the hook in any settings file. Make no live Jev call.
- If a model refusal, usage limit or permission denial stops you, write it into "Open for the planner" and finish the
  report. Do not retry in a loop.
