# T-263: the harness runtime's commits carry the caller's identity when the caller's env sets GIT_AUTHOR_*/GIT_COMMITTER_*

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key). Code only. Overnight-safe: ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t263-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-12, session 168. **Task:** T-263 (P3). **Tag:** `T-263`. **Size:** SMALL.
**Base:** `10034c5a0328c6a2e44057290ff66ea0edcd4121` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: runtimeGitEnv (one caller: the runtime's git spawn in src/harness/git.ts:226; covered by tests/harness/config-channel.test.ts and the new t263 file)
```

## Why

`runtimeGitEnv` (`open-brain/src/harness/git.ts:171-195`) drops the variables that REDIRECT git
(`REDIRECTING_GIT_VARS`, line 93) but passes `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME` and
`GIT_COMMITTER_EMAIL` through. Git ranks those above `-c user.name/user.email`, so when the caller's env sets them
(the desktop one-off launcher does), the runtime commits under the caller's identity instead of
`RUNTIME_IDENTITY` ("HoH harness runtime"). CA-4c in `tests/harness/config-channel.test.ts` (line ~221) asserts that
identity and is therefore **red on the desktop at the base**. The planner reproduced it: with the four variables unset
CA-4c passes; with only `GIT_AUTHOR_NAME=x` set, the author is `x`.

## Ruling (exact code)

In `open-brain/src/harness/git.ts`, directly below `MACHINE_CONFIG_VARS` (line 96), add:

```ts
/**
 * Inherited IDENTITY variables. Git ranks them above `-c user.name/user.email`, so a caller whose environment
 * sets them would sign the runtime's commits with its own name (T-263). Removed whoever set them, machine read
 * included. The two *_DATE variables are kept: they do not change who signs.
 */
const IDENTITY_GIT_VARS = /^GIT_(AUTHOR|COMMITTER)_(NAME|EMAIL)$/;
```

In `runtimeGitEnv`'s loop, make this the FIRST statement after `const K = k.toUpperCase();`:

```ts
    if (IDENTITY_GIT_VARS.test(K)) continue;
```

Then extend the module header's last layer bullet (line ~46-48, "Inherited environment variables that REDIRECT
git …") with one sentence: `Inherited identity variables (GIT_AUTHOR_NAME/EMAIL, GIT_COMMITTER_NAME/EMAIL) are removed
too, because git ranks them above -c (T-263).` Nothing else in `src/` changes.

## Existing tests that pin this behaviour (planner-read, with verdicts)

- `config-channel.test.ts` "CA-4c: a GLOBAL filter.p.clean …" asserts the candidate commit's `%an%n%ae` is the runtime
  identity. **Red at base on the desktop (environment), must be GREEN after the fix.** This is the acceptance row.
- `config-channel.test.ts` "CA-4c R19 …" and the rest of that file: unaffected, green before and after.
- `tests/harness/git.test.ts`: tests the deny list and argument handling, not the env. Green, unedited.
- No other file under `src/` or `tests/` calls `runtimeGitEnv` (planner grep at base).

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t263-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else `BLOCKED T-263 node <v>`).
   Paste `Get-ChildItem env:GIT_AUTHOR_*, env:GIT_COMMITTER_*` (names and values) in the reply.
2. Fresh clone `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t263-wt")`,
   `Set-Location` into it, `git checkout -q -b fix/t263-runtime-identity 10034c5a0328c6a2e44057290ff66ea0edcd4121`.
   `git rev-parse HEAD` must print that SHA, `git status --porcelain` must be empty, else STOP, BLOCKED. Then `npm ci`
   in `open-brain`. **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout.
3. **Base proof:** in `open-brain`, run
   `npx vitest run tests/harness/config-channel.test.ts -t "CA-4c" --no-file-parallelism --testTimeout=180000` and paste
   the result (expected: CA-4c red with an author that is not "HoH harness runtime", if step 1 showed the variables set).
4. **Commit 1, `T-263: tests (red)`.** A new file `open-brain/tests/harness/t263-runtime-identity.test.ts`, importing
   `runtimeGitEnv` from `../../src/harness/git.js`:
   - **I1:** `runtimeGitEnv({ PATH: "p", GIT_AUTHOR_NAME: "x", GIT_AUTHOR_EMAIL: "x@x.invalid", GIT_COMMITTER_NAME: "x", GIT_COMMITTER_EMAIL: "x@x.invalid" })`
     has none of the four keys, and `PATH` is `"p"`.
   - **I2:** the same with mixed-case keys `Git_Author_Name` and `git_committer_email`: neither is in the result.
   - **I3:** `runtimeGitEnv({ GIT_AUTHOR_NAME: "x", GIT_COMMITTER_EMAIL: "x@x.invalid" }, null, true)` (machine read):
     neither key is in the result.
   - **I4:** `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` set to `"2020-01-01T00:00:00Z"` are KEPT unchanged.
   And ONE new row in `tests/harness/config-channel.test.ts`, inside the describe `"CA-4c/4e/4g — …"`, directly after the
   `"CA-4c R19 …"` row, named `"CA-4c T-263: the runtime's commits carry its identity when the caller's env sets GIT_AUTHOR_*/GIT_COMMITTER_*"`.
   Copy CA-4c's shape: `prepareFilterTarget()`, then
   `const restore = withEnv({ GIT_AUTHOR_NAME: "Caller", GIT_AUTHOR_EMAIL: "caller@x.invalid", GIT_COMMITTER_NAME: "Caller", GIT_COMMITTER_EMAIL: "caller@x.invalid" });`,
   `runLoop({ ...withDeveloper(touchA), developerAllowlist: ["a.txt", "artifacts/iterations/t001/"] })` in a try/finally
   that calls `restore()`, then `expect(r.failure, r.failure?.reason).toBeNull()` and
   `expect(rawGit(repo.root, ["log", "-1", "--format=%an%n%ae%n%cn%n%ce", r.candidateSha!])).toBe("HoH harness runtime\nharness-runtime@sia.invalid\nHoH harness runtime\nharness-runtime@sia.invalid")`.
   **No existing row is edited.** Run both files (command in step 7): I1, I2, I3 and the new CA-4c T-263 row are red;
   I4 is green. Paste it.
5. **Commit 2, `T-263: the runtime drops the caller's GIT_AUTHOR_*/GIT_COMMITTER_* so its commits carry its own identity`:**
   the ruling above.
6. End both messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Afterwards
   `git log --oneline 10034c5a..HEAD` shows 2 lines and `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), then
   `npx vitest run tests/harness/t263-runtime-identity.test.ts tests/harness/config-channel.test.ts tests/harness/git.test.ts --no-file-parallelism --testTimeout=180000`
   with a 15-minute wall-clock cap. All green, **including CA-4c**.
8. **Mutants** (edit `src/harness/git.ts`, run step 7's vitest line, paste, `git checkout -- open-brain/src/harness/git.ts`,
   confirm `git status --porcelain` is empty; never commit or push a mutant):
   - M1: delete the `if (IDENTITY_GIT_VARS.test(K)) continue;` line → I1 and CA-4c T-263 red.
   - M2: change the regex to `/^GIT_AUTHOR_(NAME|EMAIL)$/` → I1 red (the committer keys remain).
   - M3: move the identity line inside an `if (!machineRead)` → I3 red.
9. `git diff --name-only 10034c5a..HEAD` must show exactly `open-brain/src/harness/git.ts`,
   `open-brain/tests/harness/config-channel.test.ts` and `open-brain/tests/harness/t263-runtime-identity.test.ts`.
   Anything else: STOP, BLOCKED.
10. `git push origin fix/t263-runtime-identity` (never force). `git ls-remote origin refs/heads/fix/t263-runtime-identity`
    must equal `git rev-parse HEAD`. Then
    `gh pr create --base master --head fix/t263-runtime-identity --title "T-263: harness runtime drops the caller's git identity env" --body "Brief: docs/loops/t263-runtime-identity-brief.md."`.
    Wait for CI with `gh pr checks <n> --watch --interval 30` (cap 20 min) and paste the `test` conclusion.

## Known red on the desktop

`tests/cli-flags*.test.ts` R185-8 is environmental; do not run it. Do not run the full suite. CA-4c is red at base by
design of this task (step 3) and must be green after commit 2.

## Reply

The first line is `READY T-263 <sha40> PR #<n>` or `BLOCKED T-263 <reason>`. Then each command with its output:
`node -v`, the env listing, the start state, the base proof, the red run, tsc, vitest, the three mutants, the name-only
diff, `ls-remote` = `rev-parse`, the PR URL and the CI conclusion. At most 2 attempts at a red. Mark anything not run
`NOT RUN`. Do not merge.
