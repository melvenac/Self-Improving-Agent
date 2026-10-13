# T-249: a worktree's knowledge belongs to its repository, and `relocate --worktrees` can fold the split history

Runtime: CC (claude -p, Opus 5.5)
SEAT: laptop one-off (any Windows host works). No hub key. Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t249-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 168. **Task:** T-249 (P2). **Tag:** `T-249`. **Size:** MEDIUM.
**Base:** `304d56392c8e2fdab33b08a66daae96ece46ab5d` (origin/master; its code equals 399121cd). If clark re-pins it at
launch, that SHA wins. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: canonicalizeProjectDir projectDisplayName handleSetSession handleRecall handleStore handleList handleStoreChunk planRelocate (callers in server.ts; covered by tests/shared/paths.test.ts, tests/relocate.test.ts, tests/server.test.ts, tests/session-provenance.test.ts, tests/t003-*.test.ts, tests/cli-args.test.ts)
```

## Why

T-249 (read its note in `.agents/state.json`): SIA's sessions carry one `project_dir` per CHECKOUT (sia-planner,
sia-forge, main, …) because `canonicalizeProjectDir` (`src/shared/paths.ts:5`) only normalises slashes and case, and
`projectDisplayName` (`:38`) takes the last path segment. Knowledge stored from a worktree is scoped to that worktree,
and its vault notes land in a folder named after it. Planner-measured live (read-only): 16 knowledge rows sit under
worktree keys against 72 under the main repo, and 123 sessions under 11 worktree keys. `open-brain relocate` already
folds ONE `--from` onto ONE `--to` (dry run unless `--apply`), but nothing resolves a worktree to its repo and nothing
finds every worktree key. This run builds both. **Folding Aaron's live DB is NOT part of this run.**

## Ruling (exact names; paths under `open-brain/`)

1. **`src/shared/paths.ts`:**
   - `export function mainWorktreeRoot(rawDir: string): string`: reads files only, never throws, never spawns. If
     `<rawDir>/.git` is a FILE whose first line is `gitdir: <p>`, resolve `<p>` against `rawDir`, read
     `<gitdir>/commondir` and resolve it against `gitdir`. Return `rawDir` unchanged when there is no `.git` file, no
     `commondir` file (a submodule or separate git dir), when the common dir's basename is not `.git` (a bare repo), or on
     any read error. Otherwise return `dirname(commonDir)`. Do NOT walk up parent directories: a nested project without
     its own `.git` is never merged into its parent. Tolerate CRLF and an absolute `commondir`.
   - `export function projectIdentity(raw: string): string` = `canonicalizeProjectDir(mainWorktreeRoot(raw))`.
   - `export function projectIdentityName(raw: string, fallback?: string): string` =
     `projectDisplayName(mainWorktreeRoot(raw), fallback)`.
   - `canonicalizeProjectDir` and `projectDisplayName` themselves do not change.
2. **`src/server.ts`, switch to the identity functions:** `ob_set_session`'s `recordSession` (`~:683`), `ob_recall`'s scope
   (`~:722`), `ob_store`'s `project_dir` and Experiences folder (`~:889`, `~:894`), `ob_list`'s scope (`~:1098`),
   `ob_store_chunk`'s row, Checkpoints filename and `project:` frontmatter (`~:1344`, `~:1350`; this covers its
   `recordSession` `~:1400`). **Keep** `ob_store_chunk`'s `working_dir:` frontmatter (`~:1374`) as
   `canonicalizeProjectDir(project_dir)`: it names the checkout.
3. **Must NOT switch** (each keeps the checkout): `cli-bootstrap.ts:263` (the per-checkout active-session slot: merging
   would let one worktree overwrite another's live slot), `end-record-store.ts:17`, `db-v2.ts:35`
   (`migrateProjectDirToCanonical`), `planRelocate`, `state-schema.ts` `checkoutOf` (`sessions[].checkout`), the
   Summaries name derivations (`cli-session-end.ts:246`, `server.ts:439`: first-writer-wins would drop summaries),
   `fleet.ts`.
4. **`open-brain relocate --worktrees [--apply]`** (`src/relocate.ts`, `src/cli.ts`, `src/cli-spec.ts`):
   - `export function planWorktreeFolds(db, vaultDir): RelocatePlan[]`: the distinct `project_dir` values in
     `knowledge_index` and `sessions`; fold a value `v` when `projectIdentity(v) !== v`, using `planRelocate(v, root)`.
   - Dry run by default (prints each fold and its row, session and note counts). `--apply` first runs
     `await db.backup("<db path>.bak-<YYYYMMDD-HHmmss>-relocate")` and refuses (exit 1, nothing changed) if that fails;
     then `applyRelocate` per plan. A second `--apply` prints `nothing to fold`.
   - `--worktrees` together with `--from`/`--to` refuses before the DB is opened. Update the boolean flags in
     `cli-spec.ts` and the usage line (`cli.ts:~723`).
   - Pruned worktrees (no longer on disk) cannot be resolved and are not folded by `--worktrees`; the dry run lists them
     as `unresolvable (not on disk): <dir>` so they can be folded with `--from`/`--to`.

## Existing tests (planner-researched; verdicts)

- `tests/cli-args.test.ts:228` and `:237` pin the relocate usage line: **update** to the new line.
- Stay green: `tests/shared/paths.test.ts:12-42`; `tests/relocate.test.ts:49-151`; `tests/session-provenance.test.ts`
  `:34 :50 :57 :64`; `tests/t003-session-proof.test.ts:60` (it already pins the slot key from
  `canonicalizeProjectDir(cwd)`: the must-not in ruling 3); every `handleSetSession` row with a tmp `project_dir` (no
  `.git` there) in `server.test.ts`, `t003-session-proof`, `t003-r2`, `qa142-t003`; `t235-p2-3-cursor-proof.test.ts:197,202`;
  `briefing-fix.test.ts:404` (BF-F6), `t252-briefing-followups.test.ts:50,58`; `cli-args.test.ts:160,203`;
  `cli-flags.test.ts:311,322-334`.
- Any other newly failing row: STOP, `BLOCKED T-249 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t249-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t249-wt")`, `Set-Location`
   into it, `git checkout -q -b fix/t249-worktree-identity 304d56392c8e2fdab33b08a66daae96ece46ab5d`. HEAD must print that
   SHA and the tree must be clean, else STOP, BLOCKED. `npm ci` in `open-brain`. **Forbidden:** `git stash`,
   `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout, and running `relocate` against the real
   `~/.claude/open-brain/knowledge-v2.db` or the real vault in any form. Every test sets a temp `KNOWLEDGE_V2_DB` and
   `OPEN_BRAIN_VAULT_DIR`.
3. **Base run** (in `open-brain`, 30-minute cap):
   `npx vitest run tests/shared tests/relocate.test.ts tests/server.test.ts tests/session-provenance.test.ts tests/t003-session-proof.test.ts tests/t003-r2.test.ts tests/qa142-t003.test.ts tests/cli-args.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste the summary and every failing row; anything red is pre-existing (`cli-flags*` R185-8 is environmental and not
   in this run).
4. **Commit 1, `T-249: tests (red)`.** New file `open-brain/tests/t249-worktree-identity.test.ts` (namespace imports).
   Temp dirs go through `realpathSync.native` (8.3 short names on some hosts).
   - **WT-1 (real git):** a main repo directory named `Repo-Main` with one commit, plus `git worktree add ../wt-x` →
     `projectIdentity(wt) === projectIdentity(main) === canonicalizeProjectDir(main)`, `projectIdentityName(wt) ===
     "Repo-Main"`, and main itself unchanged.
   - **WT-2 (hand-made files):** `.git` = `gitdir: ../main/.git/worktrees/w` with `commondir` = `../..` → main; the same
     with a CRLF line ending, and with an absolute `commondir`.
   - **WT-3 (fail-safe):** unchanged, no throw, for: a submodule-shaped gitdir with no `commondir`; a bare `repo.git`
     common dir; a malformed `.git` file; a `.git` DIRECTORY (a normal repo); a missing path.
   - **WT-4 (server, from the worktree):** `handleStoreChunk` called with the worktree as `project_dir` → the DB row
     carries the main key; the Checkpoints file name and `project:` use `Repo-Main`; `working_dir:` is the worktree's
     key; `handleRecall` scoped from a SECOND worktree finds it; `ob_store` (through the handler the stdio tests use)
     writes under `Experiences/Repo-Main/`.
   - **WT-5 (must-not):** cli-bootstrap run with the worktree as cwd writes the slot key from
     `canonicalizeProjectDir(<worktree>)`; `endRecordProjectDir(wt) !== endRecordProjectDir(main)`.
   - **WT-6 (relocate):** a temp DB with rows and sessions under a worktree key plus notes under
     `Experiences/wt-x/`: the dry run changes neither the DB nor the notes; `--apply` creates the `.bak-…-relocate`
     backup and folds rows, sessions and notes onto `Repo-Main`; a second `--apply` prints `nothing to fold`; the main
     key and a plain non-git directory are never folded.
   - **WT-7:** `relocate --worktrees --from a` refuses, exit non-zero, and the DB file is never created.
   Run the file: all red except what the existing relocate already satisfies (say which). Paste it.
5. **Commit 2, `T-249: worktree identity resolves to the repository; relocate --worktrees folds the split history`:**
   the ruling, plus the `cli-args.test.ts` usage-line update.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline 304d5639..HEAD`
   shows 2 lines; `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), the t249 file, then step 3's command again. Paste all three.
8. **Mutants** (edit, run the t249 file only, paste, `git checkout -- <file>`, clean tree; never commit):
   - M1: `mainWorktreeRoot` returns `rawDir` always → WT-1, WT-4 red.
   - M2: return `dirname(gitdir)`, skipping `commondir` → WT-1, WT-2 red.
   - M3: drop the `commondir`-exists check → WT-3 red.
   - M4: resolve the gitdir against `process.cwd()` → WT-2 red.
   - M5: put the resolver inside `canonicalizeProjectDir` → WT-5 red.
   - M6: skip the backup before `--apply` → WT-6 red.
9. `git diff --name-only 304d5639..HEAD` must show only `open-brain/src/shared/paths.ts`, `open-brain/src/server.ts`,
   `open-brain/src/relocate.ts`, `open-brain/src/cli.ts`, `open-brain/src/cli-spec.ts`,
   `open-brain/tests/t249-worktree-identity.test.ts`, `open-brain/tests/cli-args.test.ts`. Anything else: STOP, BLOCKED.
10. `git push origin fix/t249-worktree-identity` (never force); `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr create --base master --head fix/t249-worktree-identity --title "T-249: worktree identity resolves to the repository; relocate --worktrees folds the split history" --body "Brief: docs/loops/t249-worktree-identity-brief.md. The live fold (relocate --worktrees --apply on the real DB) is NOT part of this PR and needs Aaron's word after merge."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-249 <sha40> PR #<n>` or `BLOCKED T-249 <reason>`. Then each command with its output: base
run, red run, tsc, the t249 run, the second run, the mutants, the name-only diff, `ls-remote` = `rev-parse`, the PR URL
and CI. At most 2 attempts at a red. Mark anything not run `NOT RUN`. If the code differs from a line this brief
quotes, follow the ruling's intent and say what differed. Do not merge.
