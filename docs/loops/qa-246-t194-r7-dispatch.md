# QA 246: T-194 r7 (the planner seat hook: characters and command words allow-listed)

**By:** Atlas (planner), 2026-10-01, record session 155. **Candidate:** `71ea310188e14d530988c6b3cb17cb70e75997cc` on
`origin/loop/t194-planner-hook` (a fast-forward from r6 `9cf8c7eb`). **Base for red:** `9cf8c7eb` (r6, REJECTED by
QA 241). **Builder:** Forge (sia-forge), Claude Code Sonnet 5.5. **QA runs on Opus** (D-068). **This QA runs on the
LAPTOP**, for real Git Bash and Windows PowerShell 5.1.

## What to read

1. `docs/loops/t194-r7-dispatch.md`: P0a, P0b, P0c, P0d, the D-C fix, and CI on Linux (D-084). **This is what you
   score.**
2. QA 241's report and `docs/loops/qa-241/` on `origin/qa/t194-r6-report` (`8d69bed5`): D-A to D-F and its
   generators.
3. `docs/loops/t194-r7-developer-handoff.md` at the candidate, plus `docs/loops/t194-r7/`. **Verify them.**

## What the builder disclosed (score these directly)

- **No one-pass mutant run.** Under memory pressure the 139 mutants ran in 35 chunks of 4 with one worker. Five
  survived, and the source changed after that. **Run all 139 in ONE sequential pass** at the candidate, and report
  killed, survived and typecheck failures.
- **Nothing ran on Linux or in CI.** The case rows are platform-aware but untested. **CI is required (below). A red
  Linux `test` job is a REJECT.**
- **The allow-list** (61 entries, each with a reason) is the builder's judgement. For each entry, judge whether the
  command can write a file or run code its own arguments name; `tee`, `cp`, `mv`, `sed`, `curl` and `ssh` are
  examples. If it can, check that P1 or a restriction covers it.
- **Beyond the dispatch:**
  - extra env refusals: `PATH`, `HOME`, `NODE_OPTIONS`, `GH_TOKEN` and similar;
  - a quoted non-ASCII write target is refused.

  Judge whether each is a sound refusal or a needless cost.

## Rows to score

- **R7-P0a, characters.**
  - Your own generator: every Unicode separator, dash and quote PowerShell 5.1 honours, in every position. All must be
    refused.
  - Confirm in real PowerShell that each one is honoured.
  - Bash non-ASCII inside ASCII quotes, in a non-target word such as a commit message, is allowed.
- **R7-P0b, one validator.** Re-run QA 241's D-A probes (PowerShell redirect `::`, drive-relative). Each must be
  refused. Write one mutant that bypasses the validator for one source, and show it goes red.
- **R7-P0c, the command allow-list.**
  - Your own generator: at least 100 command words **not** on the list, in command position. All must be refused.
  - Every inline-code spelling for `node` (`-e`, `-e'…'`, `--eval=`, `-p`, `--print`, `-r`, `--import`, attached
    forms) must be refused.
  - QA 241's D-D and D-E must be refused.
- **R7-P0d, environment.** QA 241's D-F (`GIT_CONFIG_*`, `GIT_CONFIG_PARAMETERS`), `GH_REPO` and `GH_HOST` must all be
  refused.
- **R7-D-C.** `New-Item -Name x -ItemType File`, run from a protected cwd, must be refused or decided correctly, in
  real PowerShell.
- **R7-regression.**
  - QA 241's met rows still hold: QA 237's D1 to D17, D8, D9, the non-merge rule and `git -c`.
  - QA 241's own generators re-run.
- **R7-cost.** Review the cost list (49 rows). Name any common planner command it makes impossible to express at
  all.
- **Mutants:** all 139 in one pass, plus at least one of your own each for P0a, P0b, P0c and P0d.

## Rules (headless Claude Code on the laptop, D-068)

- You are **QA 246**, prefix `t194-r7`. Push ONLY `qa/t194-r7-*` branches, through
  `node docs/loops/qa-246/push-qa.mjs <branch>` from `C:/qa-scratch/qa246-wt`.
- **CI (required):** push `qa/t194-r7-ci-candidate`. Quote the run id, headSha, run conclusion and `test` job
  conclusion, polling in the FOREGROUND with `gh run watch <id> --exit-status`. Use at most 2 tcm runs, never
  `windows=true`.
- **Memory:** check free RAM before the mutant pass. Do not stop or touch any process you did not start.
- Commit `docs/loops/t194-r7-qa-report.md` with its `.E_t.json` on `qa/t194-r7-report`. The last line is exactly
  `QA-246: REPORT COMPLETE`.
- Never register the hook. Make no live Jev call and no live GitHub merge.
- If a usage limit or a denial stops you, write it into "Open for the planner" and finish the report.
