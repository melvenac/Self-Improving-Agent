# T-188: ci-status reads gh's "no GitHub remote" hint as "not authenticated"

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: one-off (no hub key). Host: the QA PC or the desktop, clark's choice. Code only.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the host user's %TEMP% named t188-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-12, session 168. **Task:** T-188 (P3). **Tag:** `T-188`. **Size:** TINY.
**Base:** `d2208ae5f9603e11450741217b635c0d00d1846d`. If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: checkCiStatus (callers: sync/index.ts runSync; covered by tests/pipelines/sync/checks-state.test.ts)
```

## Why, and the exact text

`checkCiStatus` (`open-brain/src/pipelines/sync/checks-state.ts:152-155`) tests its error against
`/auth|login|token|HTTP 401/i` before anything else. The planner captured gh's real errors on the desktop
(gh `run list`, 2026-10-12):

- a repository whose only remote is not GitHub (the two backticks around `gh auth login` are part of gh's text):

  ```text
  failed to determine base repo: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  ```

- a repository with no remote at all:

  ```text
  failed to determine base repo: no git remotes found
  ```

The first one contains `auth login`, so `/sync` prints "gh is not authenticated" for a legitimate skip, which is a
false reason (QA 102 Open 6).

## Ruling

Insert one branch **between** the ENOENT test and the auth test:

```ts
: /point to a known GitHub host|no git remotes found/i.test(r.error) ? "no GitHub remote — this repository's remotes are not on GitHub"
```

Nothing else in the function changes.

## The existing test that pins this (planner-read)

`tests/pipelines/sync/checks-state.test.ts` "skips with the reason when gh is absent or not authenticated" (line ~172).
Its three cases (ENOENT, `gh auth login` without the remote text, `could not determine base repo`) keep their
messages. **Green, unedited.**

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t188-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else `BLOCKED T-188 node <v>`).
2. Fresh clone under `$env:TEMP\t188-wt`, then `git checkout -q -b fix/t188-ci-remote d2208ae5f9603e11450741217b635c0d00d1846d`.
   `git rev-parse HEAD` must print that SHA and `git status --porcelain` must be empty. Then `npm ci` in `open-brain`.
   **Forbidden:** stash, `reset --hard`, `--force`, rebase, amend, another checkout.
3. **Commit 1, `T-188: tests (red)`:** a new file `open-brain/tests/t188-ci-remote.test.ts`, using the same `runner()`
   stub shape as `checks-state.test.ts` (copy it). Each row expects `severity: "skip"`.
   - **C1:** the first error above, verbatim → message
     `skipped — no GitHub remote — this repository's remotes are not on GitHub; conclusion: unknown (absent is not green)`.
   - **C2:** the second error above → the same message.
   - **C3:** `To get started with GitHub CLI, please run:  gh auth login` → still `skipped — gh is not authenticated; …`.
   - **C4 (real gh):** a temp repo (`git init -q`, `git remote add origin file:///nonexistent/x.git`) with the real
     `execRunner`. If `gh` is not on PATH, `it.skip` with that reason. Otherwise the message contains `no GitHub remote`.
   Run the file: C1, C2 and C4 are red; C3 is green.
4. **Commit 2, `T-188: ci-status names a non-GitHub remote instead of claiming gh is unauthenticated`:** the ruling.
5. End both messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Afterwards
   `git log --oneline d2208ae5..HEAD` shows 2 lines and `git status --porcelain` is empty.
6. **Mutant:** reorder the new branch after the auth test. C1 must go red. Paste the result, then `git checkout -- <file>`.
7. Runs: `npx tsc --noEmit`, then
   `npx vitest run tests/t188-ci-remote.test.ts tests/pipelines/sync/checks-state.test.ts --no-file-parallelism --testTimeout=180000`.
8. `git diff --name-only d2208ae5..HEAD` shows exactly `open-brain/src/pipelines/sync/checks-state.ts` and
   `open-brain/tests/t188-ci-remote.test.ts`. Anything else: STOP, BLOCKED.
9. `git push origin fix/t188-ci-remote`. `git ls-remote origin refs/heads/fix/t188-ci-remote` must equal
   `git rev-parse HEAD`. Then
   `gh pr create --base master --head fix/t188-ci-remote --title "T-188: ci-status names a non-GitHub remote" --body "Brief: docs/loops/t188-ci-status-remote-brief.md."`.
   Never force-push.

## Reply

The first line is `READY T-188 <sha40> PR #<n>` or `BLOCKED T-188 <reason>`. Then each command with its output:
`node -v`, the start state, the red run, the mutant, tsc, vitest, the name-only diff, `ls-remote` = `rev-parse`, and
the PR URL. At most 2 attempts at a red. Never edit an existing test. Mark anything not run `NOT RUN`.
