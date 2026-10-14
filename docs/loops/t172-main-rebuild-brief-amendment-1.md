# T-172 amendment 1: the cli-flags allowance is retired, S4-9.2b tests a fixture, master merged in

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code only. Ends at READY with PR #676 updated, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t172-r2-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-172 (P1). **Tag:** `T-172`. **Size:** SMALL.
**Branch:** `feat/t172-main-rebuild` at `634f7a8d78c38ce468c3d3dacd689cce743b8b60` (PR #676). **Master to merge:**
`c1975286aa8edad4a3d2ed7e00f6564e490bba11`. If clark re-pins either at launch, that SHA wins.
**The brief's rulings stand:** `docs/loops/t172-main-rebuild-brief.md`. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: testCountFindings (tests/harness/s4-guards.test.ts; test code only, no src symbol changes in this round)
```

## Why

Round 1 came back BLOCKED (`T-172-reply.md`, 2026-10-13 14:16). CI `test` failed on one row,
`tests/harness/s4-guards.test.ts > S4-9.2`: "stale allowance for open-brain/tests/cli-flags.test.ts: expected 19 -> 18,
found 19 -> 19". **The guard is right.** The brief's `main-rebuild --dry-rn` row brings cli-flags.test.ts back to its
BASE count of 19, and S4-9.2 (ruled in session 157) does not let an allowance outlive the loss it records. **The row
stays.** A mistyped `--dry-run` on the one command that rebuilds the serving checkout must be refused end to end.
Removing the entry breaks `S4-9.2b`, because it destructures `const [x, y] = ALLOWED_TEST_LOSSES` and so tests the live
table's length instead of `testCountFindings`. PR #676 also conflicts with master, so GitHub ran no pull_request CI.

## Ruling (exact; paths under `open-brain/`)

1. **`tests/harness/s4-guards.test.ts`:**
   a. Delete the `open-brain/tests/cli-flags.test.ts` entry (19 -> 18) from `ALLOWED_TEST_LOSSES`. The
      `ranking.test.ts` entry stays as it is.
   b. In `S4-9.2b`, replace `const table = ALLOWED_TEST_LOSSES;` with this, and change nothing else in the row:
      ```ts
      // A fixture, not the live table: this row tests testCountFindings, and the live table shrinks as losses are
      // restored (T-172 restored cli-flags.test.ts to its base count).
      const table: readonly TestLossAllowance[] = [
        { file: "open-brain/tests/fixture-a.test.ts", before: 19, after: 18, reason: "fixture" },
        { file: "open-brain/tests/fixture-b.test.ts", before: 11, after: 9, reason: "fixture" },
      ];
      ```
2. **Merge master in, never rebase:** `git merge --no-ff c1975286aa8edad4a3d2ed7e00f6564e490bba11`. Resolve the conflicts below exactly as
   listed. Any other conflict means STOP and reply `BLOCKED T-172 <file>`.
   - `open-brain/src/pipelines/sync/checks.ts`, the import block, which is the only conflict (master's two lines
     against the branch's one). Keep all three, in this order:
     ```ts
     import { resolveDocPath } from "../../shared/doc-path.js";
     import { greetingFlag } from "../session-start/greeting-flags.js";
     import { isMainCheckout } from "../../shared/main-checkout.js";
     ```
   - `cli.ts` and `cli-spec.ts` merge without a conflict (planner-checked with `git merge-tree` against c1975286, after #677;
     nothing else conflicts).
3. Make no src change beyond that resolution. If `tsc` then fails on code master brought in, STOP and reply
   `BLOCKED T-172 tsc <file:line>`.

## Existing tests (planner-read at `c1975286aa8edad4a3d2ed7e00f6564e490bba11`; verdicts)

- `S4-9.2` (the live check, `testCountFindings(rows, ALLOWED_TEST_LOSSES)`): green after 1a. cli-flags at 19 -> 19
  needs no allowance, and ranking at 11 -> 9 still matches its entry.
- `S4-9.2b`: green after 1b, with its assertions unchanged.
- `ALLOWED_TEST_LOSSES` has no other user (the definition, S4-9.2b and S4-9.2 are all in this file).
- The rest of `s4-guards.test.ts` and every round-1 row stay green.
- Any other newly failing row: STOP, `BLOCKED T-172 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t172-r2-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.** Work in the fresh clone the launcher named. If it named none, run
   `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t172-r2-wt")` and
   `Set-Location` into it. Then run `git checkout -q -b feat/t172-main-rebuild origin/feat/t172-main-rebuild`.
   `git rev-parse HEAD` must print `634f7a8d78c38ce468c3d3dacd689cce743b8b60` and `git status --porcelain` must be
   empty, else STOP, BLOCKED. Run `npm ci` in `open-brain`. **Forbidden:** `git stash`, `reset --hard`, `--force`,
   rebase, amend, `cd` into any other checkout, `npm run test:heavy`, `docs/loops/machine-lease.ps1`.
3. **Red at the head** (in `open-brain`):
   `npx vitest run tests/harness/s4-guards.test.ts --no-file-parallelism --testTimeout=180000`. S4-9.2 must fail with
   the stale-allowance line. Paste it.
4. **Commit 1, `T-172 r2: S4-9.2b tests a fixture; the cli-flags allowance is retired`:** ruling 1. Run step 3's
   command again (green) and paste it.
5. **Commit 2, the merge:** `git merge --no-ff c1975286aa8edad4a3d2ed7e00f6564e490bba11 -m "T-172 r2: merge master c1975286"`, resolved as ruling 2
   says. Paste `git diff --name-only --diff-filter=U` before resolving, and the resolved hunks.
6. End both commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (for the merge, a second
   `-m`). `git log --oneline 634f7a8d..HEAD --first-parent` shows 2 lines; `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), then
   `npx vitest run tests/harness/s4-guards.test.ts tests/pipelines/main-rebuild.test.ts tests/cli-flags.test.ts tests/shared tests/pipelines/sync/staleness.test.ts tests/pipelines/session-start/serving-build.test.ts tests/pipelines/session-start/stale-process.test.ts tests/pipelines/detach.test.ts tests/harness/spawn-sites.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste both.
8. **Mutants** (edit `open-brain/tests/harness/s4-guards.test.ts`, run step 3's command, paste,
   `git checkout -- open-brain/tests/harness/s4-guards.test.ts`, `git status --porcelain` empty; never commit):
   - M1: put the cli-flags entry back. S4-9.2 must go red (stale allowance).
   - M2: `const table = ALLOWED_TEST_LOSSES;` back in S4-9.2b. S4-9.2b must go red.
9. `git diff --name-only c1975286aa8edad4a3d2ed7e00f6564e490bba11 HEAD` must show exactly the 8 files of round 1 plus
   `open-brain/tests/harness/s4-guards.test.ts`. Anything else: STOP, BLOCKED.
10. `git push origin feat/t172-main-rebuild` (never force). `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr view 676 --json mergeable,mergeStateStatus` must not say CONFLICTING. Wait for CI
    (`gh pr checks 676 --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-172 <sha40> PR #676` or `BLOCKED T-172 <reason>`. Then each command with its output: the
red run, the green run, the conflict list and the resolved hunks, tsc, step 7's run, the mutants, the name-only diff,
`ls-remote` = `rev-parse`, mergeability and CI. **Paste test output with `grep -a`, or without grep:** a raw control
character in output makes grep print "Binary file matches" and the evidence is lost (T-270). At most 2 attempts at a
red. Mark anything not run `NOT RUN`. If the code differs from a line this amendment quotes, follow the ruling's
intent and say what differed. Do not merge.
