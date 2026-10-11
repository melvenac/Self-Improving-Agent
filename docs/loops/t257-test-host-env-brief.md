# T-257: the test suite drops the host harness's CLAUDE_* / CURSOR_* env, so a run inside Claude Code matches CI

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key)
ROOM: none
REPLY: write the full reply to C:\Users\melve\AppData\Local\Temp\t257-reply.md (absolute path; a temp HOME must not redirect it)

**By:** Atlas (planner), 2026-10-11. **Task:** T-257 (P2). **Tag:** `T-257`. **Decision:** D-150 (CC dev). **Size:** SMALL.
**Written to** `~/Worktrees/cursor-brief-checklist.md`. Everything the run needs is in this file. There is no
dispatch turn, no hub post and no room. You hold no hub key, and nothing in this job calls the hub.

## Why (planner, first-hand at `843d8d18`)

- T-245 r4's CC one-off saw `tests/end-fix-r3-pins.test.ts` **R7** fail at three SHAs (`2ce8eeb5`, `5d4276c7`,
  `b142886f`) and pass 4/4 with every `CLAUDE*` variable unset. CI is green because CI has none of them.
- R7 (lines 45–60) spawns the SessionEnd hook with `env: { ...process.env, CLAUDE_PROJECT_DIR: … }` and a payload
  with **no** session id, and expects `handoff check NOT RUN`. Inside a Claude Code session, `process.env` carries
  that session's `CLAUDE_CODE_SESSION_ID` / `CLAUDE_PID`. The hook resolves an id from them, so the
  "no session id" case never happens.
- `open-brain/src` reads these host variables: `CLAUDE_PID`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_PROJECT_DIR`,
  `CLAUDE_PLUGIN_ROOT`, `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_SESSION_ID`,
  `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE`, `CLAUDE_ADAPTER_FLAGS`, `CURSOR_COMMAND_SET`,
  `CURSOR_MEASURED_SHELL_TOOL_NAMES`. 89 test files spawn processes, and every child inherits `process.env`.
- D-150 sends all SIA dev to Claude Code. Every CC dev run hits this, and a correct change gets reported red.
- **The fix is structural, in one place:** `tests/setup-env.ts` is already the vitest `setupFiles` entry. It
  redirects state for the same reason ("no future test can reintroduce the leak by forgetting to opt out"). It now
  also deletes the host harness variables at load, so the test process and every child it spawns see CI's
  environment. A test that needs one sets it explicitly, as R7 does for `CLAUDE_PROJECT_DIR`.
- **Why deleting is safe:** CI has none of these variables and the whole suite is green there, so no test depends on
  inheriting one.

## 1. Shell and Node

PowerShell. Run these first and paste the output:

```powershell
$reply = "C:\Users\melve\AppData\Local\Temp\t257-reply.md"
"REPLY_PATH=$reply"
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
Get-ChildItem env: | Where-Object { $_.Name -match '^(CLAUDE|CURSOR_)' } | Select-Object -ExpandProperty Name
```

The last command shows which host variables this run carries. **At least one `CLAUDE_*` name must print**, because
this run's own session is the reproduction. If none print, STOP: `BLOCKED T-257 no host env to reproduce`.
If `node -v` prints `v24…`, STOP: `BLOCKED T-257 node v24`.

## 2. Start state

Work in the directory the launcher started you in: a fresh full clone of `melvenac/Self-Improving-Agent` that clark
made for this run. Do not create or move to another checkout.

```powershell
git remote get-url origin
git fetch origin
git switch -c fix/t257-test-host-env 843d8d18378a4b2bebe29ea73617ab4fc868e952
git rev-parse HEAD
git status --porcelain
Set-Location open-brain; npm ci; "EXIT=$LASTEXITCODE"
```

`origin` must name `melvenac/Self-Improving-Agent`, HEAD must be the base, `status` must be empty and `npm ci` must
print `EXIT=0`. Otherwise STOP: `BLOCKED T-257 start state`. Every later command runs from `open-brain/`.

## 3. Forbidden

No `git stash`, no amend, no rebase, no force push, no `git reset --hard`, and no edit outside the scope list (§9).
**Do not unset the host variables in your own shell.** The run must reproduce the failure, then fix it in the suite.
Kill only a PID you started yourself.

## The work

**W1: `open-brain/tests/harness/host-env.ts` (new).**
```ts
/** Env names a host harness (Claude Code, Cursor) sets that src reads. CI has none of them. */
export const HOST_ENV_PATTERN = /^(CLAUDE_|CLAUDECODE$|CURSOR_)/;

/** Delete every host-harness variable from `env` in place; return the names removed, sorted. */
export function scrubHostEnv(env: NodeJS.ProcessEnv): string[]
```
`scrubHostEnv` deletes each key that matches `HOST_ENV_PATTERN` and returns the deleted names, sorted. It touches
nothing else.

**W2: `open-brain/tests/setup-env.ts`.** Directly after the imports, before `stateDir` is created, add:
```ts
// T-257: a run inside Claude Code or Cursor inherits the host session's CLAUDE_* / CURSOR_* variables, and every hook
// a test spawns inherits them in turn (end-fix-r3-pins R7 resolved the host's session id and went red). CI has
// none of them, so dropping them here makes a local run match CI. A test that needs one sets it explicitly.
scrubHostEnv(process.env);
```
Import `scrubHostEnv` from `./harness/host-env.js`. Change nothing else in the file.

## 4. Commits (exactly two)

1. `T-257: tests (red)`. Add `tests/t257-host-env.test.ts` with the rows in §6. Commit 1 does **not** contain W1:
   the test imports `./harness/host-env.js`, so the file fails to load. That is the expected red.
2. `T-257: the suite drops the host harness's CLAUDE_*/CURSOR_* env (a CC run matches CI)`. W1 and W2.

After each commit, paste `git status --porcelain` (empty) and `git log --oneline 843d8d18..HEAD`.

## 5. Mutants (local branches off commit 2, never pushed; restore with `git checkout -- <file>` after each)

- **M1:** in `setup-env.ts`, delete the `scrubHostEnv(process.env);` line. **HE-3** and **end-fix-r3-pins R7** must
  go red.
- **M2:** in `HOST_ENV_PATTERN`, drop `|CURSOR_`. **HE-1** must go red.
- **M3:** make `scrubHostEnv` return `[]` without deleting anything. **HE-1**, **HE-3** and R7 must go red.
- **M4:** change the pattern to `/^CLAUDE/` (so it also matches `CLAUDEX`, and loses `CURSOR_`). **HE-1** and **HE-2**
  must go red.

## 6. Tests

New file `open-brain/tests/t257-host-env.test.ts`. Row names are exact:

- **HE-1: scrubHostEnv removes every host variable and returns their names.** On a plain object
  `{ CLAUDE_PID: "1", CLAUDE_CODE_SESSION_ID: "s", CLAUDECODE: "1", CURSOR_COMMAND_SET: "x", PATH: "p",
  HOME: "h" }`, it returns
  `["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_PID", "CURSOR_COMMAND_SET"]`, and the object keeps exactly
  `PATH` and `HOME`.
- **HE-2: lookalikes stay.** `{ CLAUDEX: "1", MY_CLAUDE_PID: "1", CURSORX: "1" }` returns `[]` and keeps all three.
- **HE-3: the test process carries no host variable.** `Object.keys(process.env).filter(k => HOST_ENV_PATTERN.test(k))`
  equals `[]`.
- **HE-4: a spawned child carries none either.** `spawnSync(process.execPath, ["-e",
  "console.log(Object.keys(process.env).filter(k=>/^(CLAUDE_|CLAUDECODE$|CURSOR_)/.test(k)).join(','))"],
  { env: process.env, encoding: "utf8" })` prints an empty line.

**Under this CC run, HE-3 and HE-4 are the live reproduction.** They are red at commit 1 (the file does not load)
and stay red if W2 is missing. On CI they would pass even without the fix, because CI has no host variables. That is
why M1's red must be shown **in this run**.

**Test command.** Single worker, and a temp HOME/USERPROFILE/KNOWLEDGE_V2_DB. **Leave the CLAUDE_* variables set.**

```powershell
$t = Join-Path $env:TEMP ("t257-home-" + [guid]::NewGuid().ToString("N").Substring(0,6)); New-Item -ItemType Directory $t | Out-Null
$env:HOME = $t; $env:USERPROFILE = $t; $env:KNOWLEDGE_V2_DB = Join-Path $t "knowledge-v2.db"
npx vitest run $files --pool=forks --poolOptions.forks.maxForks=1; "EXIT=$LASTEXITCODE"
```

`$files` is:
```
tests/t257-host-env.test.ts tests/end-fix-r3-pins.test.ts tests/end-fix-r4-pins.test.ts tests/end-fix-q6.test.ts tests/end-fix-q10.test.ts tests/end-fix-q12.test.ts tests/cli-bootstrap.test.ts tests/cli-flags.test.ts tests/t003-session-proof.test.ts tests/server.test.ts tests/shared/paths.test.ts tests/pipelines/sync/vault-pollution.test.ts tests/active-session.test.ts
```
These are the new file, R7's file and its siblings that spawn hook entries, and every test file that names
`setup-env`.

- **Before commit 1, at the base:** run R7's file alone. **R7 must be red** (the reproduction). Paste it.
- **At commit 2:** all 13 files must be green.
- **Then the full suite once** (`npx vitest run --pool=forks --poolOptions.forks.maxForks=1`), also with the host
  variables left set. Paste the totals. Any red file gets re-run alone at commit 2 **and** at the base. A file red at
  both is a pre-existing host-env leak this fix should also have closed: name it in the reply, and do NOT edit it.

**Existing tests (planner, mechanical: `git grep -ln setup-env 843d8d18 -- open-brain/tests`, plus R7's file).**
None is edited.
- `cli-bootstrap`, `cli-flags`, `server`, `t003-session-proof`, `shared/paths` and `sync/vault-pollution` name
  `setup-env` for its `OPEN_BRAIN_*` / `KNOWLEDGE_V2_DB` redirects, which W2 does not touch: **stay green**.
- `end-fix-r3-pins` R7: **red at the base under CC, green after**. It is not edited.
- A test that sets a `CLAUDE_*` variable itself still works, because the scrub runs once at setup load, before any
  test body.

## 7. Typecheck · 8. Scope

`npx tsc --noEmit; "EXIT=$LASTEXITCODE"` must print `EXIT=0`.
`git diff --name-only 843d8d18..HEAD` may show only `open-brain/tests/harness/host-env.ts`,
`open-brain/tests/setup-env.ts` and `open-brain/tests/t257-host-env.test.ts`. No `src` file changes.

## 9. Push and PR

```powershell
git push origin fix/t257-test-host-env
git ls-remote origin refs/heads/fix/t257-test-host-env
git rev-parse HEAD
gh pr create --base master --head fix/t257-test-host-env --title "T-257: the test suite drops the host harness's CLAUDE_*/CURSOR_* env" --body "Brief: docs/loops/t257-test-host-env-brief.md. Tests-only change."
```

`ls-remote` must equal HEAD. Before pushing, `git status --porcelain` must be empty and no mutant code may be on the
branch. Otherwise STOP: `BLOCKED T-257 push gate`.

## 10. Reply

Write it to `$reply`. Line 1: `READY T-257 <sha40>` or `BLOCKED T-257 <reason>`. Line 2: `MODEL: <the model this run
used, from your own run>`. Then the §1 output (including which host variable names were present), the start state,
R7 red at the base, the commit-1 run, the 13-file run, the full-suite totals, tsc, M1–M4 with their red rows, the
scope diff, the push readback and the PR number.

## Acceptance

- **T257-A1:** the 13 files are green at commit 2 **with the host variables set**, and R7 was red at the base in
  the same run.
- **T257-A2:** M1–M4 all go red on their named rows.
- **T257-A3:** a Grok review of the PR.
- **T257-A4:** CI `test` passes. This only shows nothing regressed: CI cannot see the bug.
