# T333: evidence-report across repos, an opt-in run resolver, and a test that no longer needs a P1 task (T-333)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-05, session 177. **Task:** T-333. **Tag:** `t333`. **Size:** SMALL (additive code in one
module, one CLI branch, one test guard). **Base:** the START sha the launcher names (a master that contains this brief).
**Authority:** the backlog (D-145); merge on Atlas's QA ACCEPT, sent to clark. No auth, deps, workflows or hooks.

```text
IMPACT-TARGETS: gitResolver, evidenceReport (pipelines/store/evidence-report.ts) - unchanged; new exports only, plus the CLI branch
```

## What changes

`docs/loops/t333/edits.txt`, 6 edits in 5 files, plus one new test file:

- **`open-brain/src/pipelines/store/evidence-report.ts`:** adds `reposUnder`, `repoSetResolver`, `renderResolverScope`
  and `ghRunResolver`. A pointer resolves when any repo holds it. An unreadable repo is skipped and named, none readable
  throws. A gh failure other than a 404 throws. `gitResolver`, `evidenceReport` and `renderEvidenceReport` do not change.
- **`open-brain/src/cli-spec.ts`, `cli-memory.ts`, `cli.ts`:** `--repos-under <dir>` and `--runs-repo <owner/name>`, and
  the usage line.
- **`open-brain/tests/pipelines/session-start/state-render.test.ts`:** drops `expect(active.length).toBeGreaterThan(0)`
  from the T183-3 row. It read the live record, so closing the last P1 task (T-181) failed CI on records PR #1091 (run
  41974917345). The row still checks every P0/P1 title there is.
- **New: `open-brain/tests/pipelines/store/t333-evidence-repos.test.ts`**, rows R1-R7.

## Existing tests that pin this behaviour (measured by SIM job 699, except the last row)

| file | verdict |
|---|---|
| tests/pipelines/store/t332-evidence-report.test.ts | 7/7 green, unchanged |
| tests/shared/cli-args.test.ts | SIM red on the usage row; the cli.ts edit, added after the SIM, fixes it |
| tests/harness/s4-guards.test.ts D1b | SIM red only because the new test was untracked; step 5 stages it first |
| tests/harness/checks.test.ts D4 | SIM red on the Linux runner (`npm ERR!` in a scratch repo), baseline unchecked; see step 7 |
| tests/pipelines/session-start/state-render.test.ts | not simulated; predicted green |

## Steps

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b build/t333`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci` (exit code), then `node -e "require('better-sqlite3')"`; on "Could not locate the
   bindings file" run `npm rebuild better-sqlite3` and say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes, any MCP config, `npm install`,
     and anything under `docs/`.
3. **Apply.** `node docs/loops/t333/apply.cjs . docs/loops/t333/edits.txt` must print exactly
   `APPLIED 6 edits to 5 files`. Then
   `Copy-Item docs/loops/t333/t333-evidence-repos.test.ts open-brain/tests/pipelines/store/t333-evidence-repos.test.ts`.
   In `open-brain`: `npx tsc --noEmit` (exit 0), `npx tsc -p tsconfig.tests.json --noEmit` (exit 0), `npm run build` (exit 0).
4. **The four files.** In `open-brain`:
   `npx vitest run tests/pipelines/store/t333-evidence-repos.test.ts tests/pipelines/store/t332-evidence-report.test.ts tests/shared/cli-args.test.ts tests/pipelines/session-start/state-render.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed. Paste `Test Files` and `Tests`.
5. **Stage.** From the clone root: `git add open-brain/tests/pipelines/store/t333-evidence-repos.test.ts`.
6. **Mutants**, each on the applied tree. Back up once:
   `Copy-Item open-brain/src/pipelines/store/evidence-report.ts "$env:TEMP\t333-er.bak" -Force`. For each `docs/loops/t333/mN.txt`:
   apply (must print `APPLIED 1 edits to 1 files`), in `open-brain` run
   `npx vitest run tests/pipelines/store/t333-evidence-repos.test.ts --no-file-parallelism --testTimeout=180000`, paste
   the failed rows, restore with Copy-Item (never git checkout). Predicted red, all confirmed by SIM job 699:
   m1 R2; m2 R2; m3 R2 and R7; m4 R6; m5 R4. Rows that differ: STOP, `BLOCKED t333 <m> <rows>`, with each assertion
   message. After the last restore, rerun step 4: 0 failed.
7. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap). Expect 0
   failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook timeout is rerun
   alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole `Unhandled Errors` section if any.
   A red `tests/harness/checks.test.ts` D4 is not a STOP: paste its last stderr line and go on; CI judges it. Any other
   red row: STOP, `BLOCKED t333 suite <rows>`.
8. **Sync.** From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`.
   Paste every line; both must be `[pass]`.
9. **Commit.** One commit, `T333: evidence-report resolves across repos, opt-in CI runs (T-333)`.
   - Stage exactly the 6 paths: `open-brain/src/pipelines/store/evidence-report.ts`, `open-brain/src/cli-spec.ts`,
     `open-brain/src/cli-memory.ts`, `open-brain/src/cli.ts`,
     `open-brain/tests/pipelines/session-start/state-render.test.ts`,
     `open-brain/tests/pipelines/store/t333-evidence-repos.test.ts`.
   - The message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows those 6 paths: 5 `M`, the new test `A`.
10. **Push and open the PR.**
    - Push, never force. `git ls-remote origin refs/heads/build/t333` must equal HEAD.
    - `gh pr create --base master --head build/t333 --title "T333: evidence-report resolves across repos, opt-in CI runs (T-333)" --body "Brief: docs/loops/t333-brief.md."`.
    - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Reply

- **First line:** `READY t333 <sha40> PR #<n>` or `BLOCKED t333 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild.sh <mergesha>`. Live check on the main build, read-only, against the live store:
`node open-brain/build/cli.js evidence-report --repos-under ~/Projects --runs-repo melvenac/Self-Improving-Agent`. The share
of new entries evidenced should rise from 4.3% toward the T-332 measure's 13.6%, and the scope line must name any skipped
repo. Then #1091's CI must go green on an update.
