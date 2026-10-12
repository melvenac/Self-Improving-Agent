# T-260: three tests that go red only on the developer desktop

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key). The reds reproduce on the desktop, so the run must be there.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t260-reply.md. Resolve and print that absolute path FIRST (§1).

**By:** Atlas (planner), 2026-10-12, session 168. **Task:** T-260 (P3). **Tag:** `T-260`. **Size:** SMALL.
**Tests only.** **Base:** `d2208ae5f9603e11450741217b635c0d00d1846d`. If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: none — test files only
```

## Why

CI is green on all three tests. On the desktop, each one has been red at every base since T-257's run (2026-10-11).
That costs every local dev run a base re-check, and every brief carries a "known reds" paragraph because of them.
Each one reads something on the developer machine that CI does not have. **The fix belongs in the test (isolate it
from the machine), never in `src/`.**

| # | Test | Red seen on the desktop | Planner's read |
|---|---|---|---|
| H1 | `tests/harness/config-channel.test.ts` "CA-4c: a GLOBAL filter.p.clean + work-tree attribute…" (line ~206) | the runtime commit's author is the desktop user's identity (`Aaron Melven / melvenac@…`), not `HoH harness runtime / harness-runtime@sia.invalid` | The test sets `HOME`/`USERPROFILE`/`XDG_CONFIG_HOME` and unsets `GIT_CONFIG_GLOBAL`. The desktop's identity is only in `C:/Users/melve/.gitconfig` (`git config --list --show-origin`), and there is no system `user.*`. So the identity reaches the runtime some other way: an inherited `GIT_AUTHOR_*` / `GIT_COMMITTER_*` / `EMAIL` variable, or Git for Windows resolving the global file without `HOME`. **Find which one; do not guess.** |
| H2 | `tests/suite-run-meta.test.ts` "cli: a lease already held by the same owner runs without take" (line ~392) | `expected 2 to be 0`: the owned run exits 2 | Something on the desktop makes the owned CLI run refuse. Likely a real peer census or lease, despite `SUITE_CENSUS_FIXTURE`. Find what the exit-2 path reads. |
| H3 | `tests/server.test.ts` "briefing_budget ON prints the budgeted block through ob_start…" (line ~606) | 5 s timeout, intermittent | It calls `ob_start` five times under the default 5 s test timeout. A loaded desktop exceeds it. |

## Rulings

| # | Ruling |
|---|---|
| R1 | **H3:** give that one `it(…)` an explicit timeout of `60_000`. Nothing else in `server.test.ts` changes. |
| R2 | **H1 and H2: diagnose first, then fix in the test file.** For each one: (a) reproduce it at the base and paste the red; (b) find the exact input from the machine that causes it: print the relevant env, config origin or file path from inside a temporary debug edit, which is never committed; (c) fix by isolating the test from that input: set or unset the variable in the test's own env, or point the lookup at a temp fixture. The planner prefers the narrowest change, scoped to that one `it` or `describe`. |
| R3 | **If the cause is in `src/`** (the code really reads the machine where it should not): do NOT fix `src/`. Commit nothing for that item, and report it as `SRC-CAUSE <file:line> <one line>`. The planner opens a task. |
| R4 | A fix that weakens what the test asserts (deleting an `expect`, loosening an expected value) is forbidden. The test must still prove what its title says. |

## 1. Shell, Node and the reply path

```powershell
$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t260-reply.md"))
"REPLY_PATH=$reply"
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
Get-ChildItem env: | Where-Object { $_.Name -match '^(GIT_|EMAIL$)' } | ForEach-Object { $_.Name }
```

Paste the variable **names** only, never their values. If `node -v` is not `v22.*`: STOP, `BLOCKED T-260 node <version>`.

## 2. Start state

```powershell
$wt = Join-Path $env:TEMP "t260-wt"
git clone -q https://github.com/melvenac/Self-Improving-Agent.git $wt
Set-Location $wt
git checkout -q -b fix/t260-host-reds d2208ae5f9603e11450741217b635c0d00d1846d
git rev-parse HEAD; git status --porcelain
Set-Location open-brain; npm ci
```

Any mismatch: STOP, BLOCKED. **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into another
checkout, and **any change to the real `~/.gitconfig` or to machine env**.

## 3. Reproduce (before any edit)

```powershell
npx vitest run tests/harness/config-channel.test.ts tests/suite-run-meta.test.ts tests/server.test.ts --no-file-parallelism --testTimeout=180000
```

Paste the summary and each failing row's name. Note: `--testTimeout=180000` may hide H3. Also run
`npx vitest run tests/server.test.ts -t "briefing_budget ON" --no-file-parallelism` (default timeout) **3 times** and
paste each summary. **An item that is not red in §3 gets no fix:** report it `NOT REPRODUCED` with the output.

## 4. Commits (one per fixed item, in the order H1, H2, H3)

Messages: `T-260: CA-4c isolates <what> from the machine`, `T-260: suite-run-meta same-owner row isolates <what>`,
`T-260: briefing_budget row gets a 60 s timeout`. End each with
`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Each commit touches only its own test file.
`git status --porcelain` is empty after each commit.

**Proof per item:** after its commit, run its file **3 times** and paste each summary; the row is green each time.
For H1 and H2, also show that the fix bites: temporarily revert just the fix (`git show HEAD~0 -- <file> | git apply -R`),
run the row and paste it red, then `git checkout -- <file>` and confirm a clean tree.

## 5. Runs and scope

```powershell
npx tsc --noEmit; "tsc exit $LASTEXITCODE"
npx vitest run tests/harness/config-channel.test.ts tests/suite-run-meta.test.ts tests/server.test.ts --no-file-parallelism --testTimeout=180000
git diff --name-only d2208ae5..HEAD
```

The allowed paths are a subset of: `open-brain/tests/harness/config-channel.test.ts`, `open-brain/tests/suite-run-meta.test.ts`,
`open-brain/tests/server.test.ts`. Any other path: STOP, BLOCKED.

```powershell
git push origin fix/t260-host-reds
git ls-remote origin refs/heads/fix/t260-host-reds   # must equal git rev-parse HEAD
gh pr create --base master --head fix/t260-host-reds --title "T-260: three desktop-only test reds isolated from the machine" --body "Brief: docs/loops/t260-host-reds-brief.md. Tests only."
```

If nothing was committed (every item is `NOT REPRODUCED` or `SRC-CAUSE`): no push, no PR. The first line is then
`BLOCKED T-260 nothing to commit`, followed by the per-item findings.

## 6. STOP rules and reply

- At most 2 fix attempts per item; then report that item `UNFIXED <cause found so far>` and continue to the next.
  Never touch `src/`. A STOP still writes the reply.
- The reply's first line is `READY T-260 <sha40> PR #<n>` or `BLOCKED T-260 <reason>`. Then: the env variable names,
  the start state, the §3 reproduction, and per item: **cause (the exact input from the machine, with evidence)**, the
  fix, the 3 green runs and the bite proof. Then tsc, the final run, the name-only diff, `ls-remote` = `rev-parse`, and
  the PR URL. Mark anything not run `NOT RUN`.
