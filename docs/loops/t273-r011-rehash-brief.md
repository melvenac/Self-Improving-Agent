# T-273: db-v2's wrong archiveKnowledgeEntry parenthesis goes, and R-011 is rehashed

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. The change is comment text in one src file plus one
hash in `.agents/retirements.json`; no behaviour changes. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t273-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-273 (P3). **Tag:** `T-273`. **Size:** SMALL.
**Base:** `88b2c8d40645e9508a291bbb34c4e2c8d9badfc4` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: none — doc-comment text above archiveKnowledgeEntry (open-brain/src/db-v2.ts) and one line_hashes entry in .agents/retirements.json; no code changes
```

## Why

T-273 (read its note). T-022 (#669, merged 28043a55) found that the doc comment on `archiveKnowledgeEntry` in
`open-brain/src/db-v2.ts` says `ob_forget` uses the helper. It does not. `ob_forget` archives the note with
`archiveVaultNote` (`server.ts:1119`) and then DELETES the row (`server.ts:1124-1125`). R-011
(`.agents/retirements.json`) pins that line's hash, so #669's commit 885b4f82 kept the line verbatim under a
correction. Now the line goes, and R-011 is rehashed with the CLI's own command. G-050 forbids the check from
rehashing itself.

Planner-verified at the base:
- **No caller.** `archiveKnowledgeEntry` (`db-v2.ts:553`) has no caller. `server.ts:30` imports it and never calls it.
  Its last caller was the apoptosis path, which the Loop 10 cut removed (1a0b7085).
- **The first line is wrong too.** The function only runs an `UPDATE knowledge_index`. It never touches the note, so
  the comment's first line, "Archive an entry's note", is also false.
- **First-hand run.** The planner ran this whole change on a scratch clone of the base, with a temp HOME:
  - the rehash proposes exactly one change, at retirements.json line 687;
  - it writes nothing outside `.agents/retirements.json`, and the temp HOME stayed empty;
  - the six retirements test files pass (138 tests);
  - both mutants below turn `retirements-live` red.

## Ruling (exact)

1. **`open-brain/src/db-v2.ts`.** The five lines 530-534 at the base are the lines after `/**`, above
   `export function archiveKnowledgeEntry(`:
   ```
    * Archive an entry's note and mark its index row archived, without destroying
    * the note. No caller remains: `ob_forget` archives the note itself and
    * DELETES the row. The old parenthesis below is kept verbatim only because
    * R-011 pins its line hash; its first half was wrong:
    * (the helper `ob_forget` uses; apoptosis, which once also called it, is cut).
   ```
   They become exactly these three lines:
   ```
    * Mark an entry's index row archived, without touching its note. No caller
    * remains: `ob_forget` archives the note itself and DELETES the row, and
    * apoptosis, which once called it, is cut.
   ```
   Nothing else in the file changes. The ` *` line after them and the paragraph from `Replaces the DELETE FROM` on stay
   byte-identical. `git diff --stat` must show `open-brain/src/db-v2.ts | 8 +++-----`.
2. **Rehash** with the CLI's own command, run from the repository root: the dry run first, then `--write`.
   - The dry run must print exactly ONE proposal, headed `maturity lifecycle  open-brain/src/db-v2.ts`.
   - Its `-` and `+` lists must differ only in the 10th hash:
     `f3daf7054165cdd44cabf846419c8586962c4d55202e5e38a0109b9a796ddb4c` becomes
     `b8b4f34e17334c84b1ec2ec9de3051580d32748b04e72b9b5c1bcfe61d6c9877`.
   - The old hash is the deleted parenthesis line. The new one is ` * apoptosis, which once called it, is cut.`: it is
     still an obituary, so R-011 still allows it.
   - Any other proposal, or any other hash: STOP, `BLOCKED T-273 rehash proposed <what>`. It would bless a line
     nobody ruled on.
3. **`git diff .agents/retirements.json`** must show exactly one changed line, line 687 at the base, where the
   `f3daf705…` entry becomes `b8b4f34e…`. Any other change, whitespace included: STOP, BLOCKED. The file is LF under
   `.gitattributes`, and the rehash writes LF.
4. **Out of scope.** Do not touch these; name them in the reply:
   - `server.ts:30`'s unused `archiveKnowledgeEntry` import (server.ts is in open PRs tonight);
   - the stale line numbers in R-011's db-v2.ts `why` text.

## Existing tests (planner-run on a scratch clone of 88b2c8d4; verdicts)

- **`tests/pipelines/sync/retirements-live.test.ts`** is the only test that reads the real record and tree.
  - With the commit: **stays green**. Planner: 2 passed.
  - With the comment edited but the rehash not run: red, `new matching line hash b8b4f34e1733…`. That is mutant M1.
- **Fixture-based, untouched; stay green:** `tests/pipelines/sync/retirements-rehash.test.ts`, `checks.test.ts`,
  `t048-counts-parity.test.ts`, `t048-r1b.test.ts` and `t048-unreadable.test.ts`. They build their own records.
  Planner: all six files together, 138 passed.
- **No test quotes the comment text.** Planner: `git grep` over `open-brain/tests` for the old phrases found no hit.
- **Any other newly failing row:** STOP, `BLOCKED T-273 <row>`.

## Steps

1. **Reply path and Node.** PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t273-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`, otherwise BLOCKED.
2. **Start state.**
   - Work in the fresh clone the launcher named. If it named none, run
     `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t273-wt")` and
     `Set-Location` into it.
   - Run `git checkout -q -b fix/t273-r011-rehash 88b2c8d40645e9508a291bbb34c4e2c8d9badfc4`. `git rev-parse HEAD`
     must print that SHA and `git status --porcelain` must be empty, else STOP, BLOCKED.
   - Run `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"` there. On "Could not locate the bindings
     file", run `npm rebuild better-sqlite3`, say so, and re-check.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout,
     `npm run test:heavy`, killing any process by name, and any edit except ruling 1 and the rehash's own write.
3. **Edit** `open-brain/src/db-v2.ts` exactly as in ruling 1. Paste `git diff --stat`.
4. **Rehash**, from the repository root (not `open-brain/`). The rehash path writes nothing outside
   `.agents/retirements.json`: planner-checked with a temp HOME that stayed empty.
   - `node open-brain/node_modules/tsx/dist/cli.mjs open-brain/src/cli.ts sync --retirements-rehash`. Paste it and
     check ruling 2.
   - `node open-brain/node_modules/tsx/dist/cli.mjs open-brain/src/cli.ts sync --retirements-rehash --write`. Paste
     it; it ends `retirements-rehash: wrote <path>`.
   - `git diff .agents/retirements.json`. Paste it and check ruling 3.
5. **One commit.** Stage both files and commit with the message
   `T-273: drop db-v2's wrong archiveKnowledgeEntry parenthesis and rehash R-011`, then a blank line, then
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline 88b2c8d4..HEAD` shows 1 line, and
   `git status --porcelain` is empty.
6. **Tests**, in `open-brain`:
   - `npx vitest run tests/pipelines/sync/retirements-live.test.ts tests/pipelines/sync/retirements-rehash.test.ts tests/pipelines/sync/checks.test.ts tests/pipelines/sync/t048-counts-parity.test.ts tests/pipelines/sync/t048-r1b.test.ts tests/pipelines/sync/t048-unreadable.test.ts --no-file-parallelism --testTimeout=180000`.
     Expect `6 passed` files and `138 passed` tests (planner, same commit content); a different count is fine if all
     pass, but say so. Wall-clock cap 10 min. Paste it.
   - `npx tsc --noEmit` exits 0. Paste it.
7. **Mutants.** For each: swap in the file, run `retirements-live.test.ts` only (same flags), paste, restore. Never
   commit. `git status --porcelain` is empty after each.
   - **M1, the rehash undone:** `git checkout HEAD~1 -- .agents/retirements.json`. Expect `1 failed | 1 passed`, with
     `new matching line hash b8b4f34e1733…`. Restore with `git checkout HEAD -- .agents/retirements.json`.
   - **M2, the old comment back, new hashes kept:** `git checkout HEAD~1 -- open-brain/src/db-v2.ts`. Expect
     `1 failed | 1 passed`, with `new matching line hash f3daf7054165…`. Restore with
     `git checkout HEAD -- open-brain/src/db-v2.ts`.
   - Use `git checkout`, not `git show … > file`: PowerShell 5.1's `>` writes UTF-16 and would fail the test for the
     wrong reason.
8. **Scope.** `git diff --name-only 88b2c8d4..HEAD` must show exactly `.agents/retirements.json` and
   `open-brain/src/db-v2.ts`. Anything else: STOP, BLOCKED.
9. **Push and PR.**
   - `git push origin fix/t273-r011-rehash` (never force). `git ls-remote origin refs/heads/fix/t273-r011-rehash` must
     equal `git rev-parse HEAD`. If the push is rejected, STOP.
   - Then run `gh pr create --base master --head fix/t273-r011-rehash --title "T-273: drop db-v2's wrong archiveKnowledgeEntry parenthesis and rehash R-011" --body "Brief: docs/loops/t273-r011-rehash-brief.md. Comment text plus one R-011 line hash; no behaviour change."`.
   - Wait for CI with `gh pr checks <n> --watch --interval 30`, capped at 20 min, and paste the `test` conclusion.

## Reply

- **First line:** `READY T-273 <sha40> PR #<n>` or `BLOCKED T-273 <reason>`.
- **Then each command with its output:** the diff stat, both rehash runs, the retirements diff, the commit log, the
  test run, tsc, M1 and M2, the name-only diff, `ls-remote` = `rev-parse`, the PR URL and CI.
- **Paste test output with `grep -a`, or without grep.** Mark anything not run `NOT RUN`.
- **The out-of-scope items:** name them as in ruling 4.
- **Where the code differs from a quote:** follow the ruling's intent and say what differed. If the rehash's proposal
  differs, that is a STOP, not an intent call. Do not merge.
