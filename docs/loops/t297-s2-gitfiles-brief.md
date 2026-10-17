# T-297 step 2: `state import --commit` merges the template's gitignore and gitattributes, and template copies are LF

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t297s2-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-16, session 173. **Task:** T-297 (P2), items (3) and (6). **Tag:** `T-297-S2`.
**Size:** MEDIUM. The change writes outside `.agents/` (the project's own `.gitignore`/`.gitattributes`), and every edit
is given verbatim. **Base:** the dispatch SHA clark names (a master that contains this brief).
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: scaffold installCommands runCommit (bootstrap/index.ts gains mergeTemplateFiles + templateText; state-import --commit calls the merge as step 4c and restores the owner files on failure)
```

## Why

Both gaps were found reviewing the tarrantmailer migration (2026-10-16).

- **(3) The import path never merged `.gitignore`/`.gitattributes`.** `scaffold` does this, but `runCommit` does not.
  - The project kept no `.agents` allowlist, so the pre-migration snapshot and the session logs became tracked files.
  - `AGENT.local.md` was not ignored, so a seat's name could be committed.
  - `/.agents/** eol=lf` was missing.
  - Makerspace has the same gap.
  - project-template's bootstrap.md even said "`--commit` does not change `.gitignore`".
- **(6) CRLF.** The build is served from the SIA main checkout. There, `git ls-files --eol` shows `.claude/commands/sync.md`
  and `project-template/.claude/commands/sync.md` as `i/lf w/crlf`. `copyFileSync` copied those bytes, so the target got CRLF.

## The change, exactly

All the files are under `docs/loops/t297-s2/`:

- `edits.txt`: 15 exact-once replacements, applied with `apply.cjs`.
  - `open-brain/src/pipelines/bootstrap/index.ts`: two new exports.
    - `templateText(path)` reads a template file as LF.
    - `mergeTemplateFiles(root, templateDir)` holds scaffold's merge loop. If the template has no copy of a file, it records `skipped` instead of throwing (parity with T-251 K1).
    - `scaffold` calls `mergeTemplateFiles`. `scaffold` and `installCommands` write `templateText(...)` instead of `copyFileSync`.
  - `open-brain/src/pipelines/state-import/index.ts`: changes to `runCommit`.
    - It records the owner files (`absent`, `file` or `other`) before `migrate`.
    - Role stubs are written LF.
    - **New step 4c:** `mergeTemplateFiles`. Its result goes in `CommitResult.merged_files`.
    - On failure it restores the owner files before `rollBack`. A file goes back to its bytes; an absent path is removed again; a non-file path is left untouched.
  - `open-brain/src/shared/import-outputs.ts`: `STATE_IMPORT_COMMIT_OUTPUTS` gains `.gitignore` and `.gitattributes`, so `install-commands`' dirty-tree check accepts them.
  - `open-brain/src/cli.ts`: `--commit` prints a `Git files:` line.
  - `project-template/gitattributes` gains `/.claude/commands/*.md text eol=lf`.
  - `project-template/.claude/commands/bootstrap.md`: its sentence now says `--commit` merges.
- `test-edits.txt`: 2 replacements. These are the **only allowed existing-test edits**.
  - `tests/pipelines/import-cmds-r2-l1.test.ts`: the post-import status list gains `.gitattributes`.
  - `tests/pipelines/template-seed.test.ts`: the template's gitattributes rules become both lines.
- `state-import-t297s2.test.ts` → `open-brain/tests/pipelines/` (new, verbatim).

## Measured before dispatch (QA PC SIMs by clark at b4030c7c)

**SIM T297S2 (the first draft)** turned 3 existing rows red:
- `import-cmds-r2-l1` gained `.gitattributes`. Expected; now an allowed edit.
- `template-seed` pins the gitattributes lines. Expected; now an allowed edit.
- t251 K1: a template with no `gitignore` threw. That was a design gap: the merge now reports `skipped`.

**SIM T297S2-2 (these exact files).** Hashes: edits `d6f07a7525aaac4d…`, test-edits `64d5fa374baa4cb7…`, test `91f46ea02365f0f0…`.
- New file on the unpatched base: `5 failed (5)`.
- After apply: tsc 0, tests tsc 0. `tests/pipelines tests/shared tests/server.test.ts`: 156 files, `1984 passed`.
- Mutants:

  | Mutant | Red rows |
  |---|---|
  | m1 | G1, G2, G3 |
  | m2 | G3 |
  | m3 | G1, G4, C1 |
  | m4 | G4 |
  | m5 | t251 K1 (new file green) |

## Existing tests (verdicts)

- Changed: exactly the two rows edited by `test-edits.txt`.
- Unchanged: every other row in `tests/pipelines`, `tests/shared` and `tests/server.test.ts` (1984 total with the new file).
- Any other red row: STOP and report `BLOCKED T-297-S2 <test name>`.

## Steps

1. PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t297s2-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`; otherwise STOP.
2. Fresh clone into `(Join-Path $env:TEMP "t297s2-wt")` unless the launcher named one.
   - `git checkout -q -b fix/t297-s2-gitfiles <base>`.
   - Check that HEAD equals the base, that the porcelain is empty, and that `git ls-tree --name-only HEAD docs/loops/t297-s2/edits.txt` prints the path.
   - In `open-brain`: `npm ci`, then `node -e "require('better-sqlite3')"`. If that fails with "Could not locate the bindings file", run `npm rebuild better-sqlite3` and say so.
   - Forbidden:
     - `git stash`, `reset --hard`, `--force`, rebase, amend, or any other checkout;
     - `npm run test:heavy`;
     - killing processes by name;
     - any read or write of the real `~/.claude/open-brain/`;
     - editing a real `settings.json` or `.agents/SYSTEM/greeting.json`;
     - editing anything under `docs/`.
3. **Commit 1, `T-297-S2: rows for the gitignore/gitattributes merge on --commit and LF template copies`:**
   - `Copy-Item docs/loops/t297-s2/state-import-t297s2.test.ts open-brain/tests/pipelines/`. Commit only that file.
   - Run `$env:NO_COLOR='1'`, then, in `open-brain`, `npx vitest run tests/pipelines/state-import-t297s2.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect `5 failed (5)`. Paste the summary and the `x` rows.
4. **Commit 2, `T-297-S2: --commit merges the template's gitignore and gitattributes; template copies are LF`:**
   - From the clone root, `node docs/loops/t297-s2/apply.cjs . docs/loops/t297-s2/edits.txt`. It must print exactly `APPLIED 15 edits to 6 files`.
   - Then `node docs/loops/t297-s2/apply.cjs . docs/loops/t297-s2/test-edits.txt`. It must print exactly `APPLIED 2 edits to 2 files`. Anything else: STOP.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build` (exit 0).
   - Run `npx vitest run tests/pipelines tests/shared tests/server.test.ts --no-file-parallelism --testTimeout=180000` (25-minute cap).
   - Expect `1984 passed`. Paste the `Test Files` and `Tests` lines.
5. Both commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <base>..HEAD` shows 2 lines, and the status is empty.
6. **Mutants.** For each of `docs/loops/t297-s2/m1.txt` … `m5.txt`:
   - Run `node docs/loops/t297-s2/apply.cjs . <mN>`; it prints `APPLIED 1 edits to 1 files`.
   - Run the new test file. For m5, also run `npx vitest run tests/pipelines/t251-role-stubs.test.ts --no-file-parallelism --testTimeout=180000`.
   - Paste the summary and the `x` rows.
   - Restore with `git checkout -- open-brain/src/pipelines/bootstrap/index.ts open-brain/src/pipelines/state-import/index.ts`. The status must be empty.
   - Never commit a mutant.
   - Expected red rows:

     | Mutant | Red rows |
     |---|---|
     | M1 | G1, G2, G3 |
     | M2 | G3 |
     | M3 | G1, G4, C1 |
     | M4 | G4 |
     | M5 | t251 K1 only |
7. `git diff --name-only <base>..HEAD` shows exactly these 9 paths:
   - `open-brain/src/cli.ts`
   - `open-brain/src/pipelines/bootstrap/index.ts`
   - `open-brain/src/pipelines/state-import/index.ts`
   - `open-brain/src/shared/import-outputs.ts`
   - `open-brain/tests/pipelines/import-cmds-r2-l1.test.ts`
   - `open-brain/tests/pipelines/state-import-t297s2.test.ts`
   - `open-brain/tests/pipelines/template-seed.test.ts`
   - `project-template/.claude/commands/bootstrap.md`
   - `project-template/gitattributes`
8. Push (never force). Check that `git ls-remote origin refs/heads/fix/t297-s2-gitfiles` equals HEAD.
   - Run `gh pr create --base master --head fix/t297-s2-gitfiles --title "T-297-S2: --commit merges the template's gitignore and gitattributes; template copies are LF" --body "Brief: docs/loops/t297-s2-gitfiles-brief.md."`.
   - Run `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T-297-S2 <sha40> PR #<n>` or `BLOCKED T-297-S2 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply.
- Every number is pasted output, with its command shown above it. Mark anything not run `NOT RUN`.
- Do not merge.
