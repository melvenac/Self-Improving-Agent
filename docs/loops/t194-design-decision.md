# T-194: stop patching the parser? A design decision for Aaron

**By:** Atlas (planner), record session 155, 2026-10-02. **Status: PROPOSED.** T-194 r8 is written
(`t194-r8-dispatch.md`) and **held**. clark recommended a pause, and the planner agrees.

## What T-194 is for

The planner seat must not:
1. **write protected files** (`open-brain/src`, tests, `package.json`, hooks, `.agents` state outside `ob_state`);
2. **merge a code PR, or push a forced or restricted ref,** without Aaron's grant.

Today a PreToolUse hook enforces both by **reading the command the agent is about to run** and predicting what it
will do.

## What seven rounds showed

| Round | Approach | What QA found next |
|---|---|---|
| r2-r4 | listed spellings | the next spelling in the same class |
| r5 | properties plus a generator | classes outside the generator (D1-D17) |
| r6 | inversion: refuse what it can't parse | characters and command words (QA 241, A-F) |
| r7 | allow-list characters and Bash commands | options, PowerShell native commands, env names, `git config` (QA 246, A-G) |
| r8 (held) | allow-list options, env, PS native | **unknown, but the pattern says something** |

Each round closed what it targeted: r7 has 139/139 mutants killed in one pass and green CI on Linux. **The open
surface is the problem itself.** To predict what a shell command writes, the hook has to model the shell and every
program on the allow-list, together with that program's options, environment and config files. Every allow-listed
program is a new parser to get right. r8 would be the strictest yet (about 15 programs, each with an option list), and
it would still rest on modelling git's and gh's own option sets correctly.

## The deterministic-first alternative (Aaron's global rule: structure over prediction)

**Make the protected act impossible where it happens, instead of predicting it from the command text.**

**(a) Files: the planner's checkout does not contain protected files.**
- `sia-planner` becomes a **sparse checkout** of `docs/` and `.agents/` only, via `git sparse-checkout set docs .agents`.
- With `open-brain/src` not present, an edit to it has no file to land on.
- Creating new files there would leave untracked files that git refuses to `add` outside the sparse cone without
  `--sparse`.
- **Limit:** a determined `git add --sparse` or `git sparse-checkout disable` gets past it. That is one well-known
  command family, and the hook can refuse it reliably, unlike the whole shell.
- **Unverified:** whether `ob_state` and the tools the planner runs need any file outside `docs/` and `.agents/`. A
  dry run would settle it.

**(b) Merges and pushes: GitHub enforces them, not the command text.**
- A **branch ruleset or branch protection** on `master` requires a pull-request approval and blocks force pushes.
- **This changes how merges happen today.** The planner merges with `gh pr merge` on Aaron's account when he says
  "merge". With a required review, the planner can't approve its own PR on the same account. **Aaron would click
  Approve or Merge in GitHub,** or the planner gets its own GitHub account whose approval does not count.
- **Unverified:** which ruleset features (required reviews, push rules) are available on this repository's plan.

**(c) The hook stays, as a courtesy layer.** It keeps refusing the obvious cases with a clear message (r7 as it
stands), but **it is no longer the safeguard.** Its limit text says so.

## Options

| | Closes the open surface? | Cost | Changes for Aaron |
|---|---|---|---|
| **1. r8 and onward** | Narrows it again; the r2-r7 pattern says it won't close | another round per QA; growing parser | none |
| **2. Structural (a)+(b), hook as courtesy (c)** | Yes for files (one command family left), and fully for merges and force pushes on GitHub's side | sparse-checkout setup, a ruleset, one dry run; merging moves into GitHub's UI | Aaron approves merges in GitHub |
| **3. Hybrid: (b) now, (a) later; ship r7 as the courtesy layer** | Merges closed now; files still rely on r7 | smallest step | as in 2, for merges |

**Planner's recommendation: 3, then 2.**
1. Put the merge and push guarantee on GitHub's side first. That is where the costly mistakes are, and the hook can
   never make it deterministic.
2. Accept r7 as the courtesy layer, after a small fix round for the **merge-relevant** QA 246 items only: none of A
   to G is a merge bypass, so possibly none.
3. Then move the planner checkout to a sparse checkout.
4. Close T-194 with the structural controls as the guarantee.

## What Aaron decides

1. Option 1, 2 or 3.
2. If 2 or 3: are merges approved in GitHub's UI by him, or through a separate bot account for the planner?
3. Who sets up the ruleset (his hand in GitHub settings) and who does the sparse-checkout dry run (a dev seat).
