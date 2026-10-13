# T-172 (half 2): `open-brain main-rebuild` updates, rebuilds and verifies the serving checkout, or refuses and changes nothing

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t172-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 168. **Task:** T-172 (P1). **Tag:** `T-172`. **Size:** MEDIUM-LARGE.
**Base:** `50c112d71747648c81912ffb26509b902582178a` (origin/master; its code equals 399121cd). If clark re-pins it at
launch, that SHA wins. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: isMainCheckout (moves to shared) describeServingBuild readStampedCommit fetchOrigin COMMAND_SPECS (covered by tests/shared/cli-args.test.ts, tests/cli-flags.test.ts, tests/pipelines/sync/staleness.test.ts, tests/pipelines/session-start/serving-build.test.ts)
```

## Why

T-172 (read its note): the main checkout's build serves EVERY session's hooks and MCP servers. Half 1 is done (#345,
#373: the greeting names the serving build and its distance from origin/master). Half 2, "one refusing command must
update, rebuild and verify it", does not exist. Today's stand-in is the coordinator's untracked
`clark-ops/scripts/sia-rebuild.sh`, which (planner-researched) decides "already at" by HEAD rather than the build stamp,
checks out over a dirty tree, runs `npm ci` (the main-checkout rule is `npm install`: running servers hold
`better_sqlite3.node`), ignores the build's exit code with no restore, and never verifies the stamp.

## Ruling (exact names; paths under `open-brain/`)

1. **Command:** `open-brain main-rebuild [<sha>] [--dry-run] [--no-fetch]`. No `<sha>` means origin/master's tip after
   the fetch. Spec `{ name: "main-rebuild", booleans: ["--dry-run", "--no-fetch"], values: {}, positionals: "any" }`; the
   module refuses more than one positional. A usage line in `cli.ts` and the LINES table like every other command.
2. **Module** `src/pipelines/main-rebuild/index.ts`: `export async function mainRebuild(tree: string, opts, deps)`, where
   `deps = { git, npm, node, startTimeOf, processTable, now }`. Default runners use `execFileSync`/`spawnSync` with
   argument arrays, never a shell; npm is located with `harness/checks.ts`'s `resolveNpm()`. **Static imports only** (the
   CLI runs from the build it is about to replace); a test pins that the module has no dynamic `import(`. Move
   `isMainCheckout` (`pipelines/sync/checks.ts:~2462-2468`, private) to `src/shared/` and import it from both places.
3. **Refusals, in this order.** Each prints `main-rebuild REFUSED: <reason>` then `Nothing was changed.` and exits 1:
   1. `<tree> is a linked worktree, not the main checkout (<main>): only the main checkout's open-brain/build serves the hooks and MCP servers.`
   2. `the working tree is not clean, so the build would be stamped <sha7> while carrying changes that are not in it:` + the paths (untracked files count).
   3. `HEAD carries <n> commit(s) that origin/master does not have: checking out <sha7> would leave them reachable only through the reflog.`
   4. (unless `--no-fetch`) `git fetch origin failed (<cause>): refusing to compare against a reference that may be stale. --no-fetch uses the last fetch (<time>).` (use `fetchOrigin`, `tree-currency.ts:~120`).
   5. `<sha7> is not on origin/master (fetch <time>): only merged code may serve every session.`
   6. Against the build stamp (`readStampedCommit`): no stamp → `the serving build carries no stamp, so <sha7> cannot be shown to be ahead of it.`; not a descendant → `<sha7> is not ahead of the serving build <built7>: this would roll every session back.`; equal → `the serving build is already <sha7>: nothing to do.` (exit 0).
   7. The lock diff built..sha changes `better-sqlite3` → `open-brain/package-lock.json changes better-sqlite3 (<a> -> <b>); every running open-brain server holds its native module and Windows will not replace it. Close every session first. Ask Aaron.`
   8. `npm could not be located (set npm_execpath).`
   `--dry-run` runs every refusal, prints what it WOULD do (backup path, checkout, install yes/no, build), changes nothing,
   exits 0.
4. **Steps:** (1) `cpSync` `open-brain/build/` to `<git common dir>/open-brain-build-backups/<built7>-<UTC>` (outside the
   work tree; keep the newest 3, delete older ones); (2) `git checkout --detach <sha>`; (3) `npm install` in `open-brain`
   ONLY if `open-brain/package.json` or `open-brain/package-lock.json` differs between the built commit and `<sha>`; never
   `npm ci`; (4) `npm run build`.
5. **Verification, in fresh child processes:** V1 the new `build-info.json` commit equals `<sha>`; V2
   `node --input-type=module -e "await import('<build/server.js file URL>')"` exits 0 (importing does not start the server;
   it loads the native binding); V3 a child imports the NEW build's serving-build module and prints `describeServingBuild()`'s
   line, classified: `^Build <sha7> · current( \(\d+ records-only commits? behind\))?$` → success; `Build <sha7> · STALE: …`
   → keep the build, exit 5 `REBUILT <sha7>, but origin/master now has <n> code commits past it: run main-rebuild again.`;
   anything else → restore, exit 3.
6. **On a failure after step (1):** restore in this order: checkout the old HEAD, remove `build/`, copy the backup back,
   `npm install` again if it ran, read the stamp back. Exit 3: `main-rebuild FAILED at <step>: <cause>` +
   `RESTORED: HEAD <old7>, open-brain/build is the backup (stamp <built7>).` If the restore itself fails, exit 4:
   `RESTORE FAILED: <cause>. Hooks and new MCP servers in EVERY session will fail. By hand: git checkout --detach <old>; copy <backup> to open-brain/build. Tell Aaron.`
7. **On success:** `REBUILT: serving build <sha7> · current (fetch <time>).`, then
   `RECONNECT: <n> live sessions run an open-brain server started before this build; in EACH run /mcp reconnect open-brain:`
   with one line per live session (`pid <p>  session <id8>  <project>`). A session is live when its by-pid proof's
   `proc_start` equals `startTimeOf(claude_pid)` (the server's own test; `shared/process-session.ts`). With none, the line
   says `RECONNECT: no live session found`; never silent. Then
   `Sessions with no proof are not listed; their greeting says STALE PROCESS until they reconnect.`
8. **Out of scope:** retiring `sia-rebuild.sh` and `merge-release.md` (after merge, by the coordinator), the QA PC's main
   checkout, a `--force` for unstamped builds (refused, by hand), changing `serving-build.ts`'s strings (the 17 exact rows
   in `serving-build.test.ts` stay byte-identical).

## Existing tests (planner-researched; verdicts)

- **Update:** `tests/shared/cli-args.test.ts:158` (exact command list: add `main-rebuild`), `:200-215` and `:224` (LINES and
  "a usage line for every command"). Add a `main-rebuild --dry-rn` typo row beside the others in `tests/cli-flags.test.ts`.
- Stay green: `cli-args.test.ts:228,237` (flags documented equal declared); `tests/pipelines/session-start/serving-build.test.ts:85-221`;
  `stale-process.test.ts:67` (SP-6); `tests/harness/spawn-sites.test.ts:101` (no runner lands in `src/harness`);
  `tests/harness/checks.test.ts:192`; `tests/pipelines/detach.test.ts`; `tests/pipelines/sync/staleness.test.ts:188,196`
  (guards the `isMainCheckout` move); `tests/t003-session-proof.test.ts`; the module-boundary check.
- Any other newly failing row: STOP, `BLOCKED T-172 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t172-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t172-wt")`, `Set-Location`
   into it, `git checkout -q -b feat/t172-main-rebuild 50c112d71747648c81912ffb26509b902582178a`. HEAD must print that SHA
   and the tree must be clean, else STOP, BLOCKED. `npm ci` in `open-brain` (this is a fresh clone, not the main
   checkout). **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout, and
   running `main-rebuild` (or anything else) against `C:\Users\melve\Projects\Self-Improving-Agent` or any real main
   checkout. Every test uses temp repositories.
3. **Base run** (in `open-brain`, 30-minute cap):
   `npx vitest run tests/shared tests/cli-flags.test.ts tests/pipelines/sync/staleness.test.ts tests/pipelines/session-start/serving-build.test.ts tests/pipelines/session-start/stale-process.test.ts tests/pipelines/detach.test.ts tests/harness/spawn-sites.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste the summary and every failing row (`cli-flags*` R185-8 is environmental on the desktop).
4. **Commit 1, `T-172: tests (red)`.** New file `open-brain/tests/pipelines/main-rebuild.test.ts` (namespace import). A
   temp bare "origin" plus a clone as the "main checkout"; a FAKE npm (injected) that writes `build/build-info.json` from
   HEAD and records its argv; fake `startTimeOf`/`processTable` for sessions:
   - **R1:** a linked worktree (`git worktree add`) → refusal 1; HEAD unchanged; npm never called.
   - **R2:** a tracked edit, and separately an untracked file → refusal 2 naming the paths; no backup directory created.
   - **R3:** an unpushed local SHA, and an `origin/feature`-only SHA → refusal 5; HEAD with commits origin lacks → refusal 3.
   - **R4:** build at C1, HEAD at C3, `<sha>` C3 → proceeds; build at C2, `<sha>` C1 → "not ahead"; `<sha>` equal to the
     build → "nothing to do", exit 0.
   - **R5:** a src-only change → npm calls exactly `[["run","build"]]`; a lock change → `[["install"],["run","build"]]`
     with cwd `open-brain`; HEAD already past a lock change but the build older → install still runs; `ci` never appears;
     a better-sqlite3 version change in the lock → refusal 7.
   - **R6:** the happy path: HEAD detached at `<sha>`, the stamp equals `<sha>`, V3 classified current, the backup holds
     the OLD stamp, at most 3 backups kept; the classifier as a table (current, current with records-only commits, STALE
     → exit 5, garbage → restore).
   - **R7:** a fake build that exits 0 but leaves the OLD stamp, and one that exits 1 after writing `junk.js` → exit 3,
     `build/` byte-equal to the original, HEAD restored.
   - **R8:** proofs: live, reused pid (start time differs), dead, unreadable → exactly one RECONNECT line for the live
     one; with none live → `RECONNECT: no live session found`.
   - **R9:** `--dry-run` on a case that would proceed prints the plan and changes nothing (HEAD, build/, backups).
   - **R10:** the module source contains no dynamic `import(`.
   Run the file: all red. Paste it.
5. **Commit 2, `T-172: open-brain main-rebuild updates, rebuilds and verifies the serving checkout, or refuses`:** the
   ruling, plus the `cli-args.test.ts` and `cli-flags.test.ts` rows.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline 50c112d7..HEAD`
   shows 2 lines; `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), the main-rebuild file, then step 3's command again. Paste all three.
8. **Mutants** (edit, run the main-rebuild file only, paste, `git checkout -- <file>`, clean tree; never commit):
   - M1: the worktree check dropped → R1 red. M2: `--untracked-files=no` in the dirty check → R2 red.
   - M3: compare against HEAD instead of the build stamp → R4 red. M4: `npm ci` instead of install → R5 red.
   - M5: trust the build's exit code (skip V1) → R7 red. M6: restore `build/` but not HEAD → R7 red.
   - M7: no liveness filter on proofs → R8 red.
9. `git diff --name-only 50c112d7..HEAD` must show only `open-brain/src/pipelines/main-rebuild/index.ts`, `open-brain/src/cli.ts`,
   `open-brain/src/cli-spec.ts`, `open-brain/src/shared/<the new isMainCheckout module>.ts`,
   `open-brain/src/pipelines/sync/checks.ts`, `open-brain/tests/pipelines/main-rebuild.test.ts`,
   `open-brain/tests/shared/cli-args.test.ts`, `open-brain/tests/cli-flags.test.ts`. Anything else: STOP, BLOCKED.
10. `git push origin feat/t172-main-rebuild` (never force); `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr create --base master --head feat/t172-main-rebuild --title "T-172: open-brain main-rebuild updates, rebuilds and verifies the serving checkout, or refuses" --body "Brief: docs/loops/t172-main-rebuild-brief.md. After merge the coordinator retires sia-rebuild.sh."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-172 <sha40> PR #<n>` or `BLOCKED T-172 <reason>`. Then each command with its output: base
run, red run, tsc, the main-rebuild run, the second run, the mutants, the name-only diff, `ls-remote` = `rev-parse`, the
PR URL and CI. At most 2 attempts at a red. Mark anything not run `NOT RUN`. If the code differs from a line this brief
quotes, follow the ruling's intent and say what differed. Do not merge.
