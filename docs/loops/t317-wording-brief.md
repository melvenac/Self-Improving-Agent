# T317-WORDING: the RECORD NOT UPDATED advice names only this session's set_handoff

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-21, session 174. **Task:** T-317 follow-up (closed task; wording only). **Tag:**
`t317-wording`. **Size:** TINY (1 string in 1 file, 1 new test file). **Base:** the START sha the launcher names (a master
that contains this brief).

```text
IMPACT-TARGETS: describeRecordNotUpdated (text only; signature and every caller unchanged)
```

## Why

Since T-317 S1 (#888) a sessions[] row no longer satisfies the /end record gate on the new layout; only this session's
`ob_state set_handoff` does. `describeRecordNotUpdated` (open-brain/src/shared/end-record-guard.ts) still advises
"ob_state ops that write sessions[]", which now cannot clear the refusal.

## The change, exactly

Files under `docs/loops/t317-wording/`.
- **`edits.txt`:** 1 edit in `open-brain/src/shared/end-record-guard.ts`: the advice becomes
  `Update the record (ob_state set_handoff for this session, or next-session.md on the old layout), or pass record_ok with a reason to close anyway.`
  plus a one-line comment.
- **`t317-wording.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/shared/t317-wording.test.ts`. W1.
- **`m1.txt`:** puts the old advice back.

## Measured before dispatch

Not SIM'd: the change is one string and no existing test pins the advice text (`git grep` at the base: the text
occurs only in end-record-guard.ts; `describeRecordNotUpdated` is called only from server.ts). Both files dry-applied
on a copy of the base. sha256 prefixes: edits `b0966904fa1711c9`, m1 `fb5c92a438f1012d`, test `505a304751045329`.
Predicted: W1 red before the fix, green after; m1 reds W1. Any other outcome is a STOP.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| everything in step 4's run | stays green | Nothing asserts the advice wording. |

Any red existing row means STOP and report `BLOCKED t317-wording <test name>`. Exceptions, from T-292 load on the
shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in
files other than `t317-wording.test.ts`, with that error or a hook timeout: re-run each such file alone; green alone
means paste both runs and go on, red alone means STOP.

## Steps

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b fix/t317-wording`. HEAD must equal START and the porcelain
   must be empty. In `open-brain`: `npm ci`. Run `apply.cjs` from the CLONE ROOT. Forbidden: stash, reset --hard,
   force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real `~/.claude/`,
   and anything under `docs/`.
3. **Commit 1** (`T317-WORDING: W1 pins the RECORD NOT UPDATED advice`).
   - `Copy-Item docs/loops/t317-wording/t317-wording.test.ts open-brain/tests/shared/t317-wording.test.ts`.
   - In `open-brain`: `npx vitest run tests/shared/t317-wording.test.ts --no-file-parallelism --testTimeout=180000`.
     Expect `1 failed (1)`: W1 red. Paste the summary and the `x` row with its assertion message.
4. **Commit 2** (`T317-WORDING: RECORD NOT UPDATED advises only this session's set_handoff (T-317)`).
   - `node docs/loops/t317-wording/apply.cjs . docs/loops/t317-wording/edits.txt` prints exactly `APPLIED 1 edits to 1 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - `npx vitest run tests/shared tests/server.test.ts tests/end-fix --no-file-parallelism --testTimeout=180000`
     (30-minute cap). Expect 0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutant**, on the COMMITTED fix: `node docs/loops/t317-wording/apply.cjs . docs/loops/t317-wording/m1.txt` prints
   `APPLIED 1 edits to 1 files`; run the new test file; paste the `x` row (expected: W1); restore with
   `git checkout -- open-brain/src` and re-run it: `1 passed (1)`. Never commit the mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 2 paths:
   `M open-brain/src/shared/end-record-guard.ts` and `A open-brain/tests/shared/t317-wording.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/fix/t317-wording` must equal HEAD.
   `gh pr create --base master --head fix/t317-wording --title "T317-WORDING: RECORD NOT UPDATED advises only this session's set_handoff" --body "Brief: docs/loops/t317-wording-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t317-wording <sha40> PR #<n>` or `BLOCKED t317-wording <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`; the next /end refusal on the new layout names only `ob_state set_handoff for this session`.
