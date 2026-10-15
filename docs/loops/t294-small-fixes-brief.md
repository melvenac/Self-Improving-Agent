# T-294 + T-170 follow-ups: the registration snippet prints its own build and the ruled matcher; three small trigger fixes

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t294-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-15, session 171. **Tasks:** T-294 (P2), T-170 follow-ups 1–3. **Tag:** `T-294`.
**Size:** SMALL. **Base:** the dispatch SHA clark names (a master that contains this brief).
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: formatRegistrationSnippet plannerHookRegistration writeTriggerKeys (open-brain/src/planner-hook/registration.ts, src/trigger/keys-writer.ts; plus the script entries cli-planner-hook.ts, cli.ts, cli-session-end.ts and the COMMAND_SPECS table in cli-spec.ts)
```

## Why

- **T-294:** `cli-planner-hook.ts --print-registration` builds its path from `resolveHookProjectDir(process.cwd())`. Run
  from the planner checkout, which has no build, or from any non-repo directory, it prints a hook command that points at
  `<cwd>/open-brain/build/cli-planner-hook.js`, a file that does not exist (planner reproduced it on 0d5cab20). The
  snippet must name the build that is actually running.
- **D-157** (Aaron, T-194 option F) registers only the FILE half. The printed snippet still carries
  `Edit|Write|NotebookEdit|Bash|PowerShell`.
- **T-170 follow-ups** (planner review of #769):
  (1) `open-brain trigger-keys` has no `cli-spec` entry, so it ignores stray arguments;
  (2) at SessionEnd, a sidecar write that throws is reported as `trigger fires NOT RECONCILED`, though the reconcile
  succeeded;
  (3) a failed rename leaves `recall-trigger-keys.json.tmp-<pid>` behind. The planner reproduced this on Windows:
  `renameSync` onto a directory throws EPERM and the tmp file stays.

## Ruling (exact)

1. `open-brain/src/cli-planner-hook.ts`, the `--print-registration` branch: replace
   `const repoRoot = resolveHookProjectDir(process.cwd());` and `const openBrainDir = join(repoRoot, "open-brain");`
   with `const openBrainDir = dirname(dirname(fileURLToPath(import.meta.url)));` (ruling 2 sets the call below it). The running file sits in either
   `open-brain/src/` (tsx) or `open-brain/build/`, so two `dirname`s reach `open-brain`. Import `dirname` from
   `node:path` and `fileURLToPath` from `node:url`, and drop `resolveHookProjectDir`/`join` imports if nothing else in
   the file uses them.
2. `open-brain/src/planner-hook/registration.ts`: `plannerHookRegistration(openBrainDir: string, opts: { fileOnly?: boolean } = {})`
   uses matcher `"Edit|Write|NotebookEdit"` when `opts.fileOnly`, and otherwise the current
   `"Edit|Write|NotebookEdit|Bash|PowerShell"` (the default is UNCHANGED, so r5's P3 contract holds).
   `formatRegistrationSnippet(openBrainDir, opts = {})` passes `opts` through. When `opts.fileOnly` is set, its
   comment lines gain `# D-157: the file half only; --print-registration --all prints the Bash/PowerShell half too.`
   In `cli-planner-hook.ts`, the branch calls
   `formatRegistrationSnippet(openBrainDir, { fileOnly: !process.argv.includes("--all") })`.
3. `open-brain/src/cli-spec.ts`: add
   `triggerKeys: { name: "trigger-keys", booleans: [], values: {}, positionals: "none" },`.
   `open-brain/src/cli.ts`: the first line inside the `trigger-keys` branch is
   `parseOrRefuse(COMMAND_SPECS.triggerKeys, args.slice(1));`.
4. `open-brain/src/cli-session-end.ts`: move the two T-170 sidecar lines into their own `try`, inside the existing
   reconcile `try` and after the reconcile line, with
   `catch (err) { console.log(\`[session-end] trigger keys NOT REFRESHED: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}\`); }`.
5. `open-brain/src/trigger/keys-writer.ts`: wrap the rename as
   `try { renameSync(tmp, path); } catch (err) { try { unlinkSync(tmp); } catch { /* already gone */ } throw err; }`
   (import `unlinkSync`).
6. Nothing else in src changes.

## Rows (commit 1: new file `open-brain/tests/t294-small-fixes.test.ts`)

- **P1** Spawn `process.execPath, [TSX_CLI, <open-brain>/src/cli-planner-hook.ts, "--print-registration"]` with
  `cwd` = a fresh `mkdtemp` (not a repo) and `CLAUDE_PROJECT_DIR` removed from env. Drop the stdout lines starting
  `#`, then parse the rest as JSON. `hooks.PreToolUse[0].hooks[0].command` equals
  `` `node "${join(OPEN_BRAIN_ROOT, "build", "cli-planner-hook.js")}"` `` (OPEN_BRAIN_ROOT = the `open-brain`
  directory, as `tests/planner-hook/hook.test.ts` defines it).
- **P2** The same output's `hooks.PreToolUse[0].matcher` equals `"Edit|Write|NotebookEdit"`.
- **P3** The same spawn with `"--print-registration", "--all"` → matcher equals `"Edit|Write|NotebookEdit|Bash|PowerShell"`.
- **K1** Spawn `<open-brain>/src/cli.ts trigger-keys --bogus` via tsx with `KNOWLEDGE_V2_DB` = a path inside a fresh
  `mkdtemp` that does NOT exist (never the real store) → exit 2, stderr contains `trigger-keys refused` and
  `Nothing was run`.
- **K1b** The same without `--bogus` → exit 1, stdout contains `trigger keys: no store at` (unchanged behaviour).
- **K2** Use the end-to-end SessionEnd harness of `tests/trigger/t159-fast-path.test.ts` N7: a temp store with
  `trigger_fires`. Before running SessionEnd, create a DIRECTORY at `recall-trigger-keys.json` beside the store.
  SessionEnd's stdout contains `trigger keys NOT REFRESHED` and contains no `NOT RECONCILED`; exit 0.
- **K3** `writeTriggerKeys(db, p)`, where `p` is an existing DIRECTORY (fresh temp store, schema initialised), throws.
  Afterwards `p`'s parent holds no entry whose name contains `.tmp-`.

**Expected at commit 1 (the base):** P1, P2, K1, K2 and K3 RED; **P3 and K1b green** (the base prints the full
matcher for any argument, and the absent-store path is unchanged).

## Existing tests (verdicts)

- `tests/planner-hook/hook.test.ts`, row "--print-registration emits PreToolUse matcher and build path": its last
  expectation `expect(r.stdout).toContain("Edit|Write|NotebookEdit|Bash");` becomes, in **commit 2**,
  `expect(r.stdout).toContain('"matcher": "Edit|Write|NotebookEdit"'); expect(r.stdout).not.toContain('"matcher": "Edit|Write|NotebookEdit|Bash');`
  (not a bare `"Bash"`: the new comment line names the Bash half).
  This is the ONLY existing change. The planner's token grep at 5072f68d also found `tests/planner-hook/r5.test.ts`
  P3 ("the registration snippet's matcher names PowerShell"). It calls `plannerHookRegistration("C:/x/open-brain")`
  with no options, so it keeps the full matcher and stays green UNCHANGED. `t159-fast-path` N7c (a reconcile that
  throws prints `NOT RECONCILED`) stays green, because the reconcile still throws before the sidecar step.
- Everything else in `tests/planner-hook/`, `tests/trigger/` and `tests/shared/cli-args.test.ts` stays green.
  Any other red row: STOP, `BLOCKED T-294 <test name>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t294-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must print `v22.*`).
2. Fresh clone into `(Join-Path $env:TEMP "t294-wt")` unless the launcher named one;
   `git checkout -q -b fix/t294-small-fixes <base>`; `rev-parse HEAD` = base; porcelain empty;
   `git ls-tree --name-only HEAD docs/loops/t294-small-fixes-brief.md` prints the path. `npm ci` in `open-brain`.
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into another checkout,
   `npm run test:heavy`, killing any process by name, and any read or write of `~/.claude/open-brain/`.
3. **Commit 1, `T-294: rows for the registration snippet and the T-170 follow-ups`:** the new test file only.
   `$env:NO_COLOR='1'`; in `open-brain`:
   `npx vitest run tests/t294-small-fixes.test.ts --no-file-parallelism --testTimeout=180000`. Exactly P1, P2, K1, K2 and K3 red.
4. **Commit 2, `T-294: the snippet prints its own build and the file-half matcher (D-157); trigger-keys refuses stray
   args; SessionEnd names a sidecar failure; no tmp left on a failed rename`:** rulings 1–5 plus the hook.test.ts
   change. Run
   `npx vitest run tests/t294-small-fixes.test.ts tests/planner-hook tests/trigger tests/shared/cli-args.test.ts --no-file-parallelism --testTimeout=180000`
   (all green), then `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), and `npm run build` (exit 0).
5. Both messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; 2 commits; porcelain empty.
6. **Mutants** (run `npx vitest run tests/t294-small-fixes.test.ts --no-file-parallelism --testTimeout=180000` each,
   paste the summary and the `x` rows and the mutant's `git diff` line, `git checkout -- <file>`, never commit):
   - **M1** cli-planner-hook.ts: `openBrainDir` back to `join(resolveHookProjectDir(process.cwd()), "open-brain")`. Expect **P1** red.
   - **M2** cli-planner-hook.ts: pass `{ fileOnly: false }` always. Expect **P2** red.
   - **M3** cli.ts: delete the `parseOrRefuse(COMMAND_SPECS.triggerKeys, …)` line. Expect **K1** red.
   - **M4** cli-session-end.ts: remove the inner `try`/`catch` (the sidecar lines back in the reconcile `try`). Expect **K2** red.
   - **M5** keys-writer.ts: delete the `unlinkSync(tmp)` call. Expect **K3** red.
7. `git diff --name-only <base>..HEAD` shows exactly: `open-brain/src/cli-planner-hook.ts`, `open-brain/src/cli-session-end.ts`,
   `open-brain/src/cli-spec.ts`, `open-brain/src/cli.ts`, `open-brain/src/planner-hook/registration.ts`,
   `open-brain/src/trigger/keys-writer.ts`, `open-brain/tests/planner-hook/hook.test.ts`, `open-brain/tests/t294-small-fixes.test.ts`.
8. `git push origin fix/t294-small-fixes` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr create --base master --head fix/t294-small-fixes --title "T-294 + T-170 follow-ups: the registration snippet prints its own build and the D-157 matcher; three small trigger fixes" --body "Brief: docs/loops/t294-small-fixes-brief.md. Code PR (src): needs a QA ACCEPT and Aaron's word naming it."`;
   `gh pr checks <n> --watch --interval 30` (cap 25 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T-294 <sha40> PR #<n>` or `BLOCKED T-294 <reason>`.
- Then each command with its output. Mark anything not run `NOT RUN`. Do not merge.
