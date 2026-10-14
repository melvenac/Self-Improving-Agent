# T-287: latest-brief asks git log with one glob pathspec, and rows pin rootBriefOnDisk

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off (a WINDOWS host: row T287-1 is red at the base only on Windows), NOT the desktop. No hub
key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t287-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-287 (P3). **Tag:** `T-287`. **Size:** SMALL.
**Base:** the dispatch SHA clark names; it MUST contain #704's merge `ea5720429b7aad208aee06d9563332825767fca4`
(check `git merge-base --is-ancestor ea572042 <base>`, else BLOCKED). If clark names none, `origin/master` after the
fetch. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: latestBriefSelection (open-brain/src/pipelines/session-start/latest-brief.ts; callers describeLatestBrief and latestBriefPath, covered by latest-brief.test.ts and briefing-fix.test.ts)
```

## Why

T-277's Opus second review (ACCEPT at 5baed1b5, `~/Worktrees/t277-review-reply.md`, outside the repo), F1 and F2 (read
T-287's note):
- **F1.** `latestBriefSelection` passes every docs-root brief as its own `git log` pathspec (`...rootBriefs`), so argv
  grows with the brief count. At about 30 KB of argv Windows refuses the spawn: `Latest brief: not determined (git:
  spawnSync git ENAMETOOLONG)`, and `latestBriefPath` returns null, so READS OWED drops the brief. One glob pathspec
  gives the same result at a constant argv, because `present` already filters the names.
- **F2.** No row pins `rootBriefOnDisk`'s name test or its catch (review mutants S5 and S3 survive).

## Ruling (exact; `open-brain/src/pipelines/session-start/latest-brief.ts` only for src)

1. In `latestBriefSelection`, the line
   ``const log = run(["log", "--format=@%cI", "--name-only", "--no-renames", "HEAD", "--", `${BRIEF_DIR}/`, ...rootBriefs]);``
   becomes:
   ```ts
     // T-287: one glob pathspec for the docs root, not one argument per brief: argv stays constant however many briefs
     // there are (Windows refuses a spawn near 32 KB of arguments). `present` already filters the names, and a glob `*`
     // never crosses a `/`, so only docs-root files match.
     const rootSpec = rootBriefs.length > 0 ? [`:(glob)${ROOT_BRIEF_DIR}/loop-*.md`] : [];
     const log = run(["log", "--format=@%cI", "--name-only", "--no-renames", "HEAD", "--", `${BRIEF_DIR}/`, ...rootSpec]);
   ```
   A repository with no docs-root brief still runs the same `git log` as before T-277. Nothing else changes.

## New rows (commit 1; `open-brain/tests/pipelines/session-start/latest-brief.test.ts`, inside the T-277 describe, after T277-6; use the file's helpers)

```ts
  it("T287-1: 2,000 docs-root briefs still give a line (one glob pathspec, not 2,000 arguments)", () => {
    const root = bareRepo();
    mkdirSync(join(root, "docs"), { recursive: true });
    for (let i = 0; i < 2000; i++) writeFileSync(join(root, "docs", `loop-${String(i).padStart(4, "0")}-brief.md`), `${i}\n`);
    git(root, ["add", "-A"]);
    git(root, ["commit", "-q", "-m", "2000 briefs"], "2026-10-01T12:00:00+00:00");
    expect(describeLatestBrief(root)).toBe("Latest brief: docs/loop-1999-brief.md (2026-10-01)");
  }, 120_000);

  it("T287-2: outside git, a docs/ holding only a non-brief loop- file is no line (rootBriefOnDisk's name test)", () => {
    const root = mkdtempSync(join(tmpdir(), "latest-brief-"));
    made.push(root);
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "loop-notes.md"), "x");
    expect(describeLatestBrief(root)).toBeNull();
  });

  it("T287-3: outside git, a docs that is a FILE is no line (rootBriefOnDisk's catch)", () => {
    const root = mkdtempSync(join(tmpdir(), "latest-brief-"));
    made.push(root);
    writeFileSync(join(root, "docs"), "x");
    expect(describeLatestBrief(root)).toBeNull();
  });
```

Check the `git(root, args, date)` helper's signature at the base (`:21`) and fit the call to it; if it cannot commit
with a date, use `commitAt`'s pattern. All 2,000 files share one commit date, so the tie rule (`path > best[0]`) picks
`docs/loop-1999-brief.md`.

**Expected at commit 1 (the base src):** T287-1 RED on this Windows host (`not determined (... ENAMETOOLONG)` or
another spawn error; paste it). On Linux CI it would pass at the base too; that is why the build runs on Windows.
T287-2 and T287-3 GREEN (they pin correct behaviour). Every existing row green. Any other outcome: STOP, BLOCKED.

## Existing tests (verdicts)

- `latest-brief.test.ts` T210-*, T233-C, T277-1..6: **stay green** (same selection; T277-2a/2b still mix both places).
- `briefing-fix.test.ts` BF-R1..R5: **stay green**.
- `tests/pipelines/sync/retirements-live.test.ts`, `tests/harness/s4-guards.test.ts`: **stay green**.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t287-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. **Start state.** Fresh clone into `(Join-Path $env:TEMP "t287-wt")` unless the launcher named one;
   `git checkout -q -b fix/t287-latest-brief-glob <base>`; `rev-parse HEAD` = base; porcelain empty; the ancestor
   check above. `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"` (else `npm rebuild better-sqlite3`).
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
   `npm run test:heavy`, killing any process by name.
3. **Commit 1, `T-287: rows for the latest-brief argv limit and rootBriefOnDisk`:** the three rows. In `open-brain`:
   `npx vitest run tests/pipelines/session-start/latest-brief.test.ts --no-file-parallelism --testTimeout=180000`.
   Exactly T287-1 red. Paste.
4. **Commit 2, `T-287: one glob pathspec for docs-root briefs`:** ruling 1. Run
   `npx vitest run tests/pipelines/session-start/latest-brief.test.ts tests/pipelines/session-start/briefing-fix.test.ts tests/pipelines/sync/retirements-live.test.ts tests/harness/s4-guards.test.ts --no-file-parallelism --testTimeout=180000`
   (all green) and `npx tsc --noEmit` (exit 0). Paste both.
5. End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline <base>..HEAD`
   shows 2 lines; porcelain empty.
6. **Mutants** in `latest-brief.ts` (edit, run the latest-brief file only, paste failing rows, `git checkout -- <file>`,
   porcelain empty; never commit one):
   - **M1:** `...rootSpec` → `...rootBriefs`. Expect T287-1 red.
   - **M2:** in `rootBriefOnDisk`, `ROOT_BRIEF_NAME.test(name)` → `name.startsWith("loop-")`. Expect T287-2 red.
   - **M3:** in `rootBriefOnDisk`, the catch's `return false;` → `return true;`. Expect T287-3 red.
   - **M4:** `:(glob)${ROOT_BRIEF_DIR}/loop-*.md` → `${ROOT_BRIEF_DIR}/` (no glob). Paste the result: the existing rows
     T277-4 `sub/loop-3-brief.md` must stay green either way (present filters), so say whether anything goes red.
7. `git diff --name-only <base>..HEAD` shows exactly `open-brain/src/pipelines/session-start/latest-brief.ts` and
   `open-brain/tests/pipelines/session-start/latest-brief.test.ts`. Anything else: STOP, BLOCKED.
8. `git push origin fix/t287-latest-brief-glob` (never force); `ls-remote` = `rev-parse HEAD`. Then
   `gh pr create --base master --head fix/t287-latest-brief-glob --title "T-287: latest-brief asks git log with one glob pathspec" --body "Brief: docs/loops/t287-latest-brief-glob-pathspec-brief.md. Code PR (src): needs a QA ACCEPT and Aaron's word naming it."`
   and `gh pr checks <n> --watch --interval 30` (cap 20 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T-287 <sha40> PR #<n>` or `BLOCKED T-287 <reason>`.
- Then each command with its output. Mark anything not run `NOT RUN`. Do not merge.
