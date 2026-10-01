# QA 241: T-194 r6 (the planner seat hook, inverted by a parse gate)

**By:** Atlas (planner), 2026-10-01, record session 155. **Candidate:** `9cf8c7eb427f732022c23baefa8092571d94daca` on
`origin/loop/t194-planner-hook` (a fast-forward from r5 `7a3a4441`, with master merged in). **Base for red:**
`7a3a4441` (r5, REJECTED by QA 237). **Builder:** Forge (sia-forge), Claude Code Sonnet 5.5. **QA runs on Opus**
(D-068). **This QA runs on the LAPTOP:** it needs real Git Bash and Windows PowerShell 5.1, as QA 237 had.

## What to read

1. `docs/loops/t194-r6-dispatch.md`: P0, the parse gate, and the rulings on QA 237's open items (D-081). **This is
   what you score.**
2. `docs/loops/t194-r5-qa-report.md` and `docs/loops/qa-237/` on `origin/qa/t194-r5-report` (`1a658b39`): QA 237's
   defects D1 to D17, generators and probes.
3. `docs/loops/t194-r6-developer-handoff.md` at the candidate, and `docs/loops/t194-r6/` (the cost list, the
   QA 237 row extractor, mutants and logs). **Verify them.**

## What the builder disclosed (score these directly)

- **The mutants were never run in one pass against the final tests.**
  - The full pass was stopped for low memory, so the mutants were run in 14 batches against tests that kept growing.
  - **Re-run all 105** (`docs/loops/t194-r6/mutants/`) **in one sequential pass** at the candidate.
  - Report killed, survived and typecheck failures. Any survivor is a test gap.
- **Nothing ran on Linux or in CI.** Use CI for the candidate (below).
- **The parser did not get smaller.** The gate is about 750 lines in front of r5's code, and r5's paths are kept but
  are now mostly unreachable through the hook. **Score the property, not the size.** Report whether any r5 path is
  still reachable through the hook in a way P0 should have refused.
- **The PowerShell 5.1 parameter tables are the builder's own.** An unknown parameter is refused, which fails closed.
  Find any **known** parameter whose value the tables mishandle.
- **Bash has no allow-list of command words.** An inline-code runner is not refused by name, for example
  `node -e …`, `python -c …`, `perl -e …`, `ruby -e …`, or `awk '…system(…)…'`. **Judge this:**
  - such code that writes a protected file is either refused, or stated in the limit text as out of reach;
  - a silent allow is a defect.

## Rows to score

- **R6-P0, the gate.** Use YOUR OWN generator, not the builder's, built from the r6 dispatch's refused and accepted
  lists.
  - At least 300 refused cases, each refused as `not statically parseable` and naming its construct.
  - At least 150 accepted cases that then go through P1 to P3.
  - **Confirm every fail-open in a real shell**, as QA 237 did.
  - Aim at what the gate might mis-tokenise: quotes inside words, `-Param:"value"` forms, unquoted commas,
    `;` vs newline, CRLF, Unicode lookalikes (fullwidth `＞`, NBSP), and PowerShell's backtick escape.
- **R6-rulings:**
  - D8: unquoted `#N` is refused, and a quoted `'#7'` reads PR 7.
  - D9: a foreign pull URL needs a grant and is not read.
  - Non-merge: decided by gh's first two positional words.
  - `git -c` with `alias.`, `remote.`, `url.`, `include.`, `includeIf.` or `core.` needs a grant.
  - The limit text, in both directions.
- **QA 237's rows:** re-run QA 237's own scripts (`gen-p*.mjs`, `probe-holes*.mjs`, `probe-merge-async.mjs`,
  `probe-comma.mjs`, `fail-closed.mjs`) against the candidate. **Every D1 to D17 fail-open must now be refused or
  decided correctly.** List what changed.
- **Fail-closed cost:** check `cost-list.txt` against what a working planner types. Name any common command it makes
  impossible to express at all, not merely harder to write.
- **Mutants:** all 105 in one pass, plus **at least one of your own per P0 refusal family** (Bash quoting, comments
  and keywords, wrappers, shells fed code, PowerShell parameters, PowerShell dynamic code).
- **Regression:** r5's met rows (non-literal, file tools, standing push, exact grant) still hold. The r4 test files
  `hook.test.ts` and `r3.test.ts` are unchanged. Every changed earlier test is listed in the handoff's "Supersedes",
  and you confirm each change follows a ruling.

## Rules (headless Claude Code on the laptop, D-068)

- You are **QA 241**. Your prefix is `t194-r6`. Push ONLY `qa/t194-r6-*` branches, and only through
  `node docs/loops/qa-241/push-qa.mjs <branch>` run from your dispatch working copy.
- **CI (D-061, T-207):** push `qa/t194-r6-ci-candidate` at the candidate, and quote the run id, headSha, run conclusion
  and `test` job conclusion, polling in the FOREGROUND with `gh run watch <id> --exit-status`. Use at most 2 tcm runs,
  never `windows=true`. Say which OS the `test` job ran on.
- **Memory:** run the mutants sequentially, and check free RAM before you start.
- Commit `docs/loops/t194-r6-qa-report.md` with its `.E_t.json` on `qa/t194-r6-report`. The last line is exactly
  `QA-241: REPORT COMPLETE`.
- Never register the hook in any settings file. Make no live Jev call, and make no live GitHub merge or call (use a
  fake fetch).
- If a model refusal, usage limit or permission denial stops you, write it into "Open for the planner" and finish the
  report.
