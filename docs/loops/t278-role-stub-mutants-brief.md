# T-278: the T-251 lines nothing tested get their tests (tests only)

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. TESTS ONLY: no file under `open-brain/src` changes.
Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t278-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-278 (P2). **Tag:** `T-278`. **Size:** SMALL.
**Base:** `1d8b8f5263de632e9c60db0a1a9d0d49962ef849` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: runCommit runDraft describeHandoffSeat (open-brain/src/pipelines/state-import/index.ts; read only, no src change; covered by tests/pipelines/t251-role-stubs.test.ts)
```

## Why

T-278 (read its note). The Opus second review of T-251 (accepted and merged in #672) found three mutants of T-251's
src lines that survive every test, and the planner confirmed each at 89d47d9d:
- **M-a:** in `runCommit`, replacing `{ role_stubs.missing.push(rel); continue; }` with a throw survives. No test runs
  `runCommit` with a `templateDir` that lacks a stub. The only `missing` assertion expects it empty.
- **M-b:** deleting the report's `L.push(describeHandoffSeat(r.handoff_seat))` survives. No test reads the seat line
  in `.agents/state.import-report.md`.
- **M-c:** deleting the CLI's `console.log(describeHandoffSeat(rep.handoff_seat))` survives (`cli.ts:734` at the
  base). The CLI's `Role files:` line (`cli.ts:758`) is untested as well.
The behaviour is right today (the T-251 live check printed both lines). These rows keep it right. The review's design
question, install-commands' dirty-path allowlist, is ruled NO CHANGE: the effect is a misleading status line, and
nothing can be lost.

## Ruling (exact)

**`open-brain/tests/pipelines/t251-role-stubs.test.ts` only**, four new rows using the file's own helpers
(`importProject`, `declare`, `TODAY`, `templateDir`):
- **K1 (kills M-a):** a temp template directory holding only `.agents/roles/shared.md` (a copy of the real stub).
  `si.runDraft(root, TODAY)`, then `si.runCommit(root, TODAY, { templateDir: <that dir> })` does not throw;
  `role_stubs` equals `{ installed: [".agents/roles/shared.md"], kept: [], missing: [".agents/roles/planner.md", ".agents/roles/developer.md", ".agents/roles/qa.md"] }`
  (in `ROLE_STUB_RELS` order); `.agents/roles/planner.md` does not exist afterwards.
- **K2 (kills M-b):** after `si.runDraft` alone (the commit moves the report away), `.agents/state.import-report.md`
  contains `Handoff seat: planner (the role .agents/AGENT.md or AGENT.local.md declares)` for
  `importProject(declare("planner"))`, and `Handoff seat: developer, ASSUMED: no role is declared in .agents/AGENT.local.md or AGENT.md`
  for `importProject(null)`.
- **K3 (kills M-c):** the CLI, spawned the way `tests/pipelines/bootstrap-fix-r3.test.ts` spawns it
  (`process.execPath` with tsx's `cli.mjs` and `src/cli.ts`). `state import --draft <dir>` on
  `importProject(declare("planner"))` prints the line `Handoff seat: planner (the role .agents/AGENT.md or AGENT.local.md declares)`.
- **K4 (kills the untested Role files line):** with the project's own `.agents/roles/planner.md` = `# mine\n` placed
  before the draft, the CLI's `state import --commit <dir>` prints exactly
  `Role files: installed .agents/roles/shared.md, .agents/roles/developer.md, .agents/roles/qa.md · kept .agents/roles/planner.md`.
If the CLI refuses on a project that is not a git repository, `git init` the fixture as the file's `gitProject`
helper does, and say so in the reply.

## Existing tests (planner-read at 1d8b8f52; verdicts)

- Every row already in `t251-role-stubs.test.ts` (N1-N6 and the seat rows): **stays green**.
- `tests/pipelines/bootstrap-fix-r3.test.ts` and `tests/pipelines/state-import`: **stay green** (untouched).
- No src file changes, so `retirements-live.test.ts` cannot move; run it anyway.
- Any other newly failing row: STOP, `BLOCKED T-278 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t278-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.** Work in the fresh clone the launcher named. If it named none, run
   `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t278-wt")` and
   `Set-Location` into it. Then `git checkout -q -b test/t278-role-stub-mutants 1d8b8f5263de632e9c60db0a1a9d0d49962ef849`.
   `git rev-parse HEAD` must print that SHA and `git status --porcelain` must be empty, else STOP, BLOCKED. Run
   `npm ci` in `open-brain`. **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other
   checkout, `npm run test:heavy`, and ANY edit under `open-brain/src` except a mutant (step 5), always reverted.
3. **One commit, `T-278: tests for the T-251 lines nothing tested`:** the four rows. Run
   `npx vitest run tests/pipelines/t251-role-stubs.test.ts tests/pipelines/bootstrap-fix-r3.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`
   in `open-brain`: all green (the rows pin today's correct behaviour; step 5 shows they bite). Paste it.
4. End the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline 1d8b8f52..HEAD`
   shows 1 line; `git status --porcelain` is empty. `npx tsc --noEmit` exits 0; paste it.
5. **Mutants** (edit, run the t251 file only, paste, `git checkout -- <file>`, clean tree; never commit):
   - M-a `state-import/index.ts`: `{ role_stubs.missing.push(rel); continue; }` → `{ throw new Error("MUTANT"); }` → K1.
   - M-b the report's `L.push(describeHandoffSeat(r.handoff_seat));` deleted → K2.
   - M-c `cli.ts`: `console.log(describeHandoffSeat(rep.handoff_seat));` deleted → K3.
   - M-d `cli.ts`: the `Role files:` line's ` · kept …` part deleted → K4.
6. `git diff --name-only 1d8b8f52..HEAD` must show only `open-brain/tests/pipelines/t251-role-stubs.test.ts`.
   Anything else: STOP, BLOCKED.
7. `git push origin test/t278-role-stub-mutants` (never force). `ls-remote` must equal `rev-parse HEAD`. Then
   `gh pr create --base master --head test/t278-role-stub-mutants --title "T-278: tests for the T-251 lines nothing tested" --body "Brief: docs/loops/t278-role-stub-mutants-brief.md. Tests only (no src)."`
   Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-278 <sha40> PR #<n>` or `BLOCKED T-278 <reason>`. Then each command with its output: the
run, tsc, the mutants, the name-only diff, `ls-remote` = `rev-parse`, the PR URL and CI. **Paste test output with
`grep -a`, or without grep.** Mark anything not run `NOT RUN`. If the code differs from a line this brief quotes, follow
the ruling's intent and say what differed. Do not merge.
