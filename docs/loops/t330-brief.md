# T330: SIA CI runs on the self-hosted tcm runners, always (Aaron 10-30)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-30, session 175. **Task:** T-330. **Tag:** `t330`.
**Size:** SMALL (`.github/workflows/ci.yml`, 4 edits; `open-brain/tests/pipelines/sync/ci-runs-on.test.ts`, 8 edits).
**Base:** the START sha the launcher names: `sim/t330`, which is origin/master plus one commit carrying this brief
and `docs/loops/t330/`. A docs-only PR cannot land it first: its `changed` job is on the hosted runner that is held.
So the PR carries 2 commits (the docs one and the code one), and that is expected.
**Authority:** Aaron, 2026-10-30, typed in clark's window: "use our own runners, not github" (verified with
relay-check). `.github/workflows` is an SG-1 exclusion: the merge needs Aaron naming the PR, after Atlas's QA ACCEPT.

## Why

GitHub-hosted jobs stopped starting on a billing hold ("recent account payments have failed or your spending limit
needs to be increased"). T-227 made `ubuntu-latest` the default for the `changed` and `test` jobs and the tcm runner a
`workflow_dispatch` opt-in (`inputs.tcm`), so every PR and master push now waits on a runner that never comes. The
change puts both jobs on `[self-hosted, linux, tcm]` for every event (tcm-1 and tcm-2 are online) and removes the
`tcm` dispatch input, which no longer selects anything. `test-windows` stays on the laptop. No step uses `gh`. The
egress self-check already runs whenever `runner.environment == 'self-hosted'`, so it now runs on every test job.

## The change, exactly

- **`docs/loops/t330/edits.txt`:** 12 edits. ci.yml: drop the `tcm` input; `changed` and `test` get
  `runs-on: [self-hosted, linux, tcm]`; the test job's comment. ci-runs-on.test.ts: the header line; `runsOn()`
  returns the raw value (now a list); the two T-227 hosted rows become two T-330 rows; the changed-equals-test row
  compares with `toEqual` (two lists); the egress row expects no `tcm` input.
- Applied to scratch copies of origin/master `8c70141e` by the planner: `APPLIED 12 edits to 2 files`; m1, m2, m3
  each `APPLIED 1 edits to 1 files` on the edited copy.

## Existing tests (verdicts)

Only `tests/pipelines/sync/ci-runs-on.test.ts` reads ci.yml (git grep of tests, src and scripts). Its other rows
(fetch-depth 0, no PR paths filter, concurrency, changed/skip logic) read jobs and keys this change leaves alone:
they stay green. The `tcm: null` fields in other rows' contexts are inert (no expression reads `inputs.tcm` any more).
Any other red existing row: STOP, `BLOCKED t330 <test name>`. Exception rule (T-292, shared QA PC): a red row or a
file-level hook timeout alongside `Timeout calling onTaskUpdate` or a timeout gets up to 3 re-runs of that file alone;
green on any run means paste every run and go on; red on all 3 means STOP. Known flaky under load: hub-presence,
state-import-r4, end-fix-q3, t159-fast-path N3, record-erasure R179, `tests/pipelines/session-start/latest-brief.test.ts`,
`tests/server.test.ts` handleSync `runs sync on project root`, `tests/shared/state-writer-notes.test.ts` T171-D1.

## Steps

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b build/t330`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci` (exit code). Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, `scripts/setup.mjs`, `git config` writes, any MCP config, `npm install`, `gh workflow run`, and
   anything under `docs/`.
3. **Red first (test edits only).** Back up ci.yml: `Copy-Item .github/workflows/ci.yml "$env:TEMP\t330-ci.bak"`.
   Apply all 12 edits (`node docs/loops/t330/apply.cjs . docs/loops/t330/edits.txt`, prints exactly
   `APPLIED 12 edits to 2 files`), then restore ONLY the workflow:
   `Copy-Item "$env:TEMP\t330-ci.bak" .github/workflows/ci.yml`. In `open-brain`:
   `npx vitest run tests/pipelines/sync/ci-runs-on.test.ts`. **Predicted: exactly 3 red rows**:
   - `T-330: the test job runs on the self-hosted tcm runners for every event, ...` (a string is not the list)
   - `T-330: no job runs on a GitHub-hosted runner, and test-windows stays on the laptop` (`changed` matches `ubuntu`)
   - `keeps the egress self-check on the test job and leaves test-windows opt-in` (`inputs.tcm` is defined)
   Paste the `Tests` line and each red row's first assertion line. Any other count or row: STOP, `BLOCKED t330 red-first`.
4. **Green.** Re-apply: `git checkout -- .github/workflows/ci.yml open-brain/tests/pipelines/sync/ci-runs-on.test.ts`,
   then `node docs/loops/t330/apply.cjs . docs/loops/t330/edits.txt` (`APPLIED 12 edits to 2 files`). In `open-brain`:
   the same vitest command: 0 failed. `npx tsc -p tsconfig.tests.json --noEmit` (exit 0). Paste `git diff --stat`.
5. **Mutants** (each on the green tree; back up ci.yml to `$env:TEMP\t330-ci.bak` first, restore with Copy-Item after
   each, never git checkout). For each: `node docs/loops/t330/apply.cjs . docs/loops/t330/<m>.txt` (`APPLIED 1 edits
   to 1 files`), then the ci-runs-on vitest command; paste `Tests` and the red row names.
   - **m1** (test job back on the T-227 expression): red = the two T-330 rows and
     `T-227: the changed job runs on the same runner expression as the test job`.
   - **m2** (the `tcm` input back): red = `keeps the egress self-check ...` only.
   - **m3** (`test-windows` on `windows-latest`): red = `T-330: no job runs on a GitHub-hosted runner, ...` only.
   After m3's restore, the file is green again (paste `Tests`). A mutant whose red rows differ from the prediction:
   STOP, `BLOCKED t330 <m> <rows>`.
6. **Wide run**, in `open-brain`: `npx vitest run tests/pipelines/sync --no-file-parallelism --testTimeout=180000`
   (30-minute cap). Expect 0 failed, subject to the exception rule. Paste `Test Files`, `Tests`, any `Errors` line.
7. **YAML parse.** From the clone root: `node -e "const y=require('./open-brain/node_modules/yaml');const d=y.parse(require('fs').readFileSync('.github/workflows/ci.yml','utf8'));for(const [k,j] of Object.entries(d.jobs))console.log(k,JSON.stringify(j['runs-on']));console.log('inputs',Object.keys(d.on.workflow_dispatch.inputs).join(','))"`.
   Expect `changed ["self-hosted","linux","tcm"]`, `test ["self-hosted","linux","tcm"]`,
   `test-windows ["self-hosted","Windows","laptop"]`, `inputs windows,step0,workers,cpu,disk,spawn`.
8. **Commit** (one commit, `T330: SIA CI runs on the self-hosted tcm runners, always (T-330)`): stage exactly the two
   files. The message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   `git log --oneline <START>..HEAD` shows 1 line; the status is empty.
   `git diff --name-status <START>..HEAD` shows exactly `M .github/workflows/ci.yml` and
   `M open-brain/tests/pipelines/sync/ci-runs-on.test.ts`.
9. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/build/t330` must equal HEAD.
   `gh pr create --base master --head build/t330 --title "T330: SIA CI runs on the self-hosted tcm runners (T-330)" --body "Brief: docs/loops/t330-brief.md. Aaron 10-30: use our own runners, not github."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion, and
   `gh run list --branch build/t330 --limit 3 --json databaseId,conclusion,status` plus, for the `test` job,
   `gh run view <id> --json jobs --jq '.jobs[] | [.name,.conclusion,.runnerName] | @tsv'` (the runner name must start
   `tcm`). A `test` that never starts after 30 min: paste the run's status and reply READY anyway, saying so.

## Reply

- **First line:** `READY t330 <sha40> PR #<n>` or `BLOCKED t330 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

No rebuild needed (no src change). Live check: the next master push's `test` job runs on a `tcm-*` runner and is green.
