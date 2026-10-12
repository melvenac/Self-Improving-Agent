# T-188 fix 1: C4 must not use `it.skip` (the S4-9.2 guard is red in CI)

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: one-off (no hub key). Host: any, clark's choice. Code only.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the host user's %TEMP% named t188-fix-1-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-12, session 168. **Task:** T-188. **Tag:** `T-188-fix-1`. **Parent:**
`docs/loops/t188-ci-status-remote-brief.md`; its rules hold (Node 22, forbidden git ops, never force-push). **Size:** TINY.

```text
IMPACT-TARGETS: none — test file only
```

## Ruling on the reply (`T-188-reply.md`)

**ACCEPT** the build (PR #620 at `b164fdf9`), the em-dash reading, and the mutant result. **One defect, and it is the
planner's:** the brief told C4 to `it.skip` when `gh` is not on PATH. CI's `tests/harness/s4-guards.test.ts`
"S4-9.2 no skip, todo, skipIf or runIf is added" fails on the line `const c4 = ghOnPath() ? it : it.skip;`
(`expected [ Array(1) ] to deeply equal []`). That guard is the repository's rule, and it is right.

## The one commit: `T-188 fix 1: C4 asserts on both sides of gh's presence instead of skipping`

Start from branch `fix/t188-ci-remote` at `b164fdf9824b97a242458e3a9c939da45f584d5b`, in a fresh clone under `$env:TEMP`
(`git checkout -q fix/t188-ci-remote`; `git rev-parse HEAD` must print that SHA; `npm ci` in `open-brain`). If the head
has moved (for example, clark refreshed it), use the head `gh pr view 620 --json headRefOid` reports and say so.

Edit only `open-brain/tests/t188-ci-remote.test.ts`:

- Delete `const c4 = ghOnPath() ? it : it.skip;` and declare the row with plain `it("C4 (real gh): …", …)`.
- Inside it, keep the temp repo setup. Then:
  - if `ghOnPath()`: the existing two asserts (`severity` `"skip"`, message contains `no GitHub remote`);
  - else: `severity` `"skip"` and message equals
    `skipped — gh is not installed; conclusion: unknown (absent is not green)`.
- Nothing else changes.

End the message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Afterwards `git status --porcelain`
is empty, and `git log --oneline b164fdf9..HEAD` shows exactly 1 line.

## Runs

```powershell
npx tsc --noEmit; "tsc exit $LASTEXITCODE"
npx vitest run tests/t188-ci-remote.test.ts tests/pipelines/sync/checks-state.test.ts tests/harness/s4-guards.test.ts --no-file-parallelism --testTimeout=180000
git diff --name-only b164fdf9..HEAD     # exactly open-brain/tests/t188-ci-remote.test.ts
```

All three files must be green. `s4-guards` must be green **in this clone**: it diffs against its own base. If it is
red locally for a reason other than this file, paste the finding. Do not edit `s4-guards.test.ts`.

Then `git push origin fix/t188-ci-remote` (no force). `git ls-remote origin refs/heads/fix/t188-ci-remote` must equal
`git rev-parse HEAD`. Wait for CI (`gh pr checks 620 --watch`) and paste the final `test` conclusion.

## Reply

The first line is `READY T-188-fix-1 <sha40> PR #620` or `BLOCKED T-188-fix-1 <reason>`. Then each command with its
output, and the CI result. At most 2 attempts at a red. Mark anything not run `NOT RUN`.
