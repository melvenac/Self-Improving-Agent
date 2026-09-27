# T-192 replay: Composer 2.5 as a developer seat (record 184)

**By:** Atlas (planner), record session 147 · 2026-09-27. **To:** `cursor-infra`, a FRESH Cursor chat on **Composer
2.5**, in `~/Worktrees/sia-infra`. Transport: A2A-Hub room `k5702788wctxj75begyt4x2k5x8f6mav` only, always with
`--as cursor-infra --session k5702788wctxj75begyt4x2k5x8f6mav`.

## Why this round exists

**Aaron asked whether Composer 2.5 should be tested as a developer model** (planner session 147). This is that test:
a **replay** of a round another seat has already built. Your result will be compared with that one on the same
criteria. **Build it as if it were new work**, because to you it is.

## The replay rules (they are what make the comparison mean anything)

- **Base: `7243fd5`.** Branch `loop/t192-replay-composer` from it. Do not merge or rebase onto any later commit.
- **Read ONLY:**
  - this file, with `git show origin/docs/session-100-qa99-dispatch:docs/loops/t192-replay-composer-brief.md`;
  - `.agents/roles/shared.md` and `.agents/roles/developer.md`;
  - the code and files **at `7243fd5`**.
- **Do NOT read:**
  - any `loop/t192-*` branch;
  - `docs/loops/t192-*` (except this file);
  - `docs/loops/qa-183/`;
  - `.agents/state.json` or `docs/loops/session-147-dispatches.md` at any commit newer than `7243fd5`.

  They hold the other seat's answer or the planner's findings on it. If you open one by accident, say so in your
  handoff; that is recorded, not penalised.
- **Report as you go:** the time you started, the time of each push, your model, and the token usage if Cursor
  shows it.

The brief itself follows. It is the same text the other seat received, copied unchanged. Its branch and handoff
names are replaced: use **`loop/t192-replay-composer`** and **`docs/loops/t192-replay-composer-handoff.md`**.

## Common rules

- Red first on tcm, at most 6 runs. **No `windows=true` CI:** the laptop is a QA machine.
- `npx tsc --noEmit -p .` before every push.
- Commit checkpoints as you go, and keep a running handoff so a fresh chat could resume.
- Push only `loop/t192-replay-composer*`. **Push the handoff before posting to the hub**, and read it back with
  `ls-remote`. Never push master, never force push, never tag. No `/end`. Never write the live `.agents/state.json`.
- After posting, run `--wait` in your room and act on the next atlas turn. Run exactly one listener at a time.

## The brief (record 181, verbatim)

**Aaron's ruling, planner session 147, verbatim:** "move master's CI to tcm". **Why:** GitHub refuses the
`ubuntu-latest` job on master pushes for billing, so master has had no push CI since #171 (T-192; this file, "master's
push CI has not run since #171").

**The site, read at `c4845b9`:** `.github/workflows/ci.yml:43`:
`runs-on: ${{ ((github.event_name == 'push' && github.ref == 'refs/heads/master') || inputs.hosted) && 'ubuntu-latest' || fromJSON('["self-hosted", "linux", "tcm"]') }}`,
plus the comment above it at `:40-42`. `/sync`'s check is `ci-status` in
`open-brain/src/pipelines/sync/checks-state.ts`. The planner found it by `grep` and has not read the function.

**Do:**
1. **A master push runs on tcm.** Only `inputs.hosted == true` selects `ubuntu-latest`, as the fallback when tcm is
   down. Update the comment, and keep the job name `test` (D-032's gate reads it).
2. **`ci-status` names a job that never started as its own state,** not as `failure`. The signature seen on all six
   master runs from `36303132573` to `36304185040`: conclusion `failure`, zero steps, no log, and a check-run
   annotation beginning "The job was not started because". Say what the check reads to tell the two apart, and state
   the limit in its output.

**Done means:**
- Item 1: a test that parses `ci.yml` (a YAML parser, never a regex; `shared.md`) and asserts the `runs-on`
  expression's result for four cases: master push → tcm; dispatch → tcm; dispatch with `hosted=true` →
  `ubuntu-latest`; push to a non-master branch → tcm. Evaluate the expression with a small evaluator you name, or pin
  the exact string and say why that is enough. Mutant: restore the master-push clause, and the first case goes red.
- Item 2: red-first rows for "never started", a real failure, and a success, on recorded `gh` responses. One mutant
  that folds never-started back into failure.
- **Preserve:** the egress self-check runs on every tcm job, and so on master pushes now. `test-windows` stays
  opt-in. Dispatch inputs are unchanged.
- **Not observable before merge:** the first real master push landing on tcm. After Aaron merges, the planner reads
  that run's runner name, and that read is the acceptance.
- Handoff at `docs/loops/t192-replay-composer-handoff.md`. Branch `loop/t192-replay-composer` from `7243fd5`. _(The only line changed from the original, which named `loop/t192-ci-tcm` from `origin/master`.)_

