# T-289: the heavy suite's two output files are ignored by git

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off, NOT the desktop. No hub key. **Config only** (SG-1: `.gitignore` plus one test row;
merges on green CI after the planner's ACCEPT). Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t289-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-289 (P3). **Tag:** `T-289`. **Size:** TINY.
**Base:** the dispatch SHA clark names; if none, `origin/master` after the fetch. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: none: .gitignore and one new test file; no src symbol changes
```

## Why

The s171 QA PC verification (`~/Worktrees/qapc-verify-reply.md`, outside the repo) ran `SUITE_DRY_RUN=1 npm run
test:heavy` in a clean clone and left it dirty: `?? open-brain/suite-run-meta.json`. `cli-suite-run.ts:217` writes
`suite-run-meta.json` into the cwd, and T-283's `SUITE_VITEST_REPORT` (`suite-vitest.json`, `src/suite-vitest.ts`) goes
there too on a real run. `git check-ignore` matches neither. A records PR that stages broadly, or a builder's
"porcelain must be empty" check after a heavy run, trips on them.

## Ruling (exact)

1. **`.gitignore`** (the repository root's): append, at the end, exactly:
   ```text
   # T-289: written into open-brain/ by `npm run test:heavy` (cli-suite-run.ts, suite-vitest.ts); run outputs, never tracked.
   /open-brain/suite-run-meta.json
   /open-brain/suite-vitest.json
   ```
   If the file does not end with a newline, add one first. Change nothing else in it.
2. **New test file `open-brain/tests/t289-suite-outputs-ignored.test.ts`**, exactly:
   ```ts
   import { describe, it, expect } from "vitest";
   import { spawnSync } from "node:child_process";
   import { join } from "node:path";

   const repoRoot = join(import.meta.dirname, "..", "..");

   describe("T-289 the heavy suite's outputs are ignored by git", () => {
     it.each(["open-brain/suite-run-meta.json", "open-brain/suite-vitest.json"])("%s is ignored", (rel) => {
       const r = spawnSync("git", ["check-ignore", "-q", "--no-index", rel], { cwd: repoRoot });
       expect(r.status).toBe(0);
     });

     it("a source file beside them is not", () => {
       const r = spawnSync("git", ["check-ignore", "-q", "--no-index", "open-brain/package.json"], { cwd: repoRoot });
       expect(r.status).toBe(1);
     });
   });
   ```

**Expected at commit 1 (the test file only):** both `it.each` rows RED (exit 1), the third GREEN. Then commit 2
(`.gitignore`) turns them green.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t289-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. Fresh clone into `(Join-Path $env:TEMP "t289-wt")` unless the launcher named one;
   `git checkout -q -b config/t289-suite-outputs-ignored <base>`; `rev-parse HEAD` = base; porcelain empty. `npm ci`
   in `open-brain`. **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `npm run test:heavy`, a `cd`
   into any other checkout.
3. **Commit 1, `T-289: rows for the heavy suite's outputs being ignored`:** the test file. In `open-brain`:
   `npx vitest run tests/t289-suite-outputs-ignored.test.ts --no-file-parallelism`: exactly the two `it.each` rows red.
   Paste.
4. **Commit 2, `T-289: ignore the heavy suite's two output files`:** ruling 1. Run
   `npx vitest run tests/t289-suite-outputs-ignored.test.ts tests/harness/s4-guards.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`
   (all green). Paste. End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
5. **Mutant:** delete the `/open-brain/suite-vitest.json` line; run the t289 file; the `suite-vitest.json` row goes
   red. Paste; `git checkout -- .gitignore`; porcelain empty.
6. `git diff --name-only <base>..HEAD` shows exactly `.gitignore` and `open-brain/tests/t289-suite-outputs-ignored.test.ts`.
7. `git push origin config/t289-suite-outputs-ignored` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr create --base master --head config/t289-suite-outputs-ignored --title "T-289: ignore the heavy suite's two output files" --body "Brief: docs/loops/t289-suite-outputs-ignored-brief.md. Config + test only (SG-1)."`;
   `gh pr checks <n> --watch --interval 30` (cap 20 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T-289 <sha40> PR #<n>` or `BLOCKED T-289 <reason>`.
- Then each command with its output. Mark anything not run `NOT RUN`. Do not merge.
