# T-254: the build line must describe the RUNNING process, not the disk

**By:** Atlas (planner), session 166, 2026-10-09. **Lane:** a D-143 small fix. Clark gave the GO on 10-09, after the
problem hit two seats that day.

**Defect:** `describeServingBuild` (`open-brain/src/pipelines/session-start/serving-build.ts:46`) reads
`build/build-info.json` from disk on every call. An open-brain MCP process that was loaded before a rebuild therefore
prints `Build a7443d3 · current` while it is still running the older code.

**Evidence:**
- Atlas's 22-hour-old process rendered the pre-#545 briefing under a7443d3's build line.
- Maker's session c28bf91a showed the same thing. It was a `/clear` inside a process started at 09:57 CDT, before the
  11:42 rebuild, and its `/mcp` reconnected only clerk.

**Consequence:** an SG-1 post-merge rebuild reaches no running seat, and the first line of the briefing hides that.

**The base SHA in the dispatch turn overrides §2's.** **Seat:** cursor-builder (checkout `sia-builder`, QA PC).
**Size:** LIGHT. **Written to:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: describeServingBuild
```

`readStampedCommit` and `LOADED_COMMIT` are new, so they are not impact targets.

**Out of scope, do not touch:** `briefing.ts`, `server.ts` (its call `describeServingBuild(args.serving_build_dir)`
stays exactly as it is), `SERVING_UPSTREAM`, `SERVED_PATHS`, the git-distance logic (lines 64–99), the hooks, and
`write-build-info.mjs`.

## 1. Shell and Node

Use PowerShell. Run these first and paste the output:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
```

If it prints `v24…`, STOP and reply `BLOCKED T-254 node v24`.

## 2. Start state

- **Checkout:** your own `sia-builder` worktree only.
- **Base:** `origin/master` at the 40-char SHA the dispatch turn names. That SHA must contain T-250's merge.

```powershell
git fetch origin
git switch -c fix/t254-stale-process <BASE_SHA>
git rev-parse HEAD
git status --porcelain
```

`git rev-parse HEAD` must print the base SHA, and `git status --porcelain` must print nothing. If either does not
match, STOP: `BLOCKED T-254 start state`.

## 3. Forbidden git

Do not use `git stash`, `reset --hard`, `--force`, rebase or amend, and do not `cd` into another seat's tree. Touch no PR
except the one you open (§10).

## The work (W1–W3), all in `serving-build.ts`

Every user-visible string below is exact.

### W1. `readStampedCommit` (new, exported)

```ts
/** The 40-hex `commit` stamped in `<buildDir>/build-info.json`, or null when the file is absent, unreadable, not JSON, or not stamped. Never throws. */
export function readStampedCommit(buildDir: string): string | null
```

Use `existsSync`, `readFileSync(…, "utf8")`, `JSON.parse` and the same `/^[0-9a-f]{40}$/` test as line 57, with the
whole function wrapped in try/catch so that any throw returns `null`.

### W2. `LOADED_COMMIT` (new, exported, module level)

Place this directly below `runningBuildDir()`:

```ts
/**
 * T-254: the build this PROCESS loaded, read ONCE when the module is evaluated. A stdio MCP server keeps its modules for
 * its whole life, so after a rebuild the disk stamp moves and this does not. Comparing the two is the only way the
 * first line can tell a reader that the code answering them is older than the code on disk.
 */
export const LOADED_COMMIT: string | null = readStampedCommit(runningBuildDir());
```

It must be a top-level `const` that is evaluated at import. Do not make it a function, a getter or a lazy cache.

### W3. `describeServingBuild`: the STALE PROCESS line

- **Signature:** `export function describeServingBuild(buildDir?: string, loadedCommit?: string | null): string`.
  - Its first statements are:
    ```ts
    const dir = buildDir ?? runningBuildDir();
    const loaded = loadedCommit !== undefined ? loadedCommit : buildDir === undefined ? LOADED_COMMIT : null;
    ```
  - Every later use of `buildDir` in the body becomes `dir`.
  - **Why the guard:** a caller that passes an explicit `buildDir`, such as a test fixture through
    `serving_build_dir`, is describing a different build from the one loaded. It must never be compared with this
    process's `LOADED_COMMIT`.
- **The new branch:** put it directly after `const builtAt = …` (line 62) and before the `const tree = …` git block:
  ```ts
  if (loaded !== null && loaded !== commit) {
    return `Build ${loaded.slice(0, 7)} · STALE PROCESS: disk has ${short} (built ${builtAt}) → /mcp reconnect open-brain`;
  }
  ```
  - It names the LOADED commit first, because the loaded code is what is answering.
  - It runs before any git call, because the git distances describe the disk build, which this process is not running.
- **Nothing else changes.** When `loaded` is null or equals `commit`, the output is byte-identical to today's.

## 4. Commits (exactly two, in this order)

| # | Contents | Message |
|---|---|---|
| 1 | The new test file only (§6), red at this commit | `T-254: tests (red)` |
| 2 | W1–W3 | `T-254: the build line names the loaded build and says STALE PROCESS when disk differs` |

After each commit, paste `git status --porcelain` (it must be empty) and `git log --oneline <BASE_SHA>..HEAD` (1 line,
then 2).

## 5. Mutants (D-137; local only, never pushed; ALL of them are run, none `NOT RUN`)

Run each mutant like this:

1. `git switch -c mut-N <final head>`
2. Make the one edit.
3. `git commit -am "MUTANT N"`
4. Run §6's command.
5. Paste the red row and its assertion line.
6. `git switch fix/t254-stale-process`

The tree must be clean after each one.

| N | Edit | Must turn red |
|---|---|---|
| 1 | Delete the `if (loaded !== null && loaded !== commit)` branch | SP-1 |
| 2 | In `readStampedCommit`, drop the 40-hex test (return any string `commit`) | SP-5 |
| 3 | `export const LOADED_COMMIT` becomes `export function loadedCommitNow() { return readStampedCommit(runningBuildDir()); }`, and the default uses `loadedCommitNow()` (the lazy read that is today's bug) | SP-6 |
| 4 | The default becomes `loadedCommit !== undefined ? loadedCommit : LOADED_COMMIT` (the `buildDir === undefined` guard is dropped) | SP-6 |

## 6. Tests

**New file:** `open-brain/tests/pipelines/session-start/stale-process.test.ts`.

- It is hermetic: every build dir is `mkdtempSync(join(tmpdir(), "t254-"))` holding a hand-written `build-info.json`,
  and no git is needed for SP-1–SP-5.
- Constants: `A = "a".repeat(40)`, `B = "b".repeat(40)`, `BUILT = "2026-10-09T16:42:00Z"`.

| Row | Setup | Asserts |
|---|---|---|
| SP-1 | dir with `{"commit":B,"builtAt":BUILT}` | `describeServingBuild(dir, A) === "Build aaaaaaa · STALE PROCESS: disk has bbbbbbb (built 2026-10-09T16:42:00Z) → /mcp reconnect open-brain"` |
| SP-2 | the same dir | `describeServingBuild(dir, B)` does not contain `STALE PROCESS` |
| SP-3 | the same dir | `describeServingBuild(dir, null)` and `describeServingBuild(dir)` do not contain `STALE PROCESS`, and the two strings are equal |
| SP-4 | no `builtAt` in the file | `describeServingBuild(dir, A)` contains `(built an unrecorded time)` |
| SP-5 | four dirs: no file; `not json`; `{"commit":"abc"}`; `{"commit":B}` | `readStampedCommit` returns `null`, `null`, `null`, `B` |
| SP-6 | source pin: `readFileSync` of `src/pipelines/session-start/serving-build.ts` | matches `/^export const LOADED_COMMIT: string \| null = readStampedCommit\(runningBuildDir\(\)\);$/m`, AND matches `/buildDir === undefined \? LOADED_COMMIT : null/` |

**Command** (PowerShell, from `open-brain/`), using the T-250 block with these files:

```powershell
$iso = Join-Path $env:TEMP ("t254-home-" + [guid]::NewGuid().ToString("N")); New-Item -ItemType Directory $iso | Out-Null
$env:HOME = $iso; $env:USERPROFILE = $iso
$files = "tests/pipelines/session-start/stale-process.test.ts tests/pipelines/session-start/serving-build.test.ts tests/pipelines/session-start/briefing.test.ts"
$p = Start-Process -FilePath "npx.cmd" -ArgumentList "vitest run $files --no-file-parallelism --testTimeout=20000" -NoNewWindow -PassThru -RedirectStandardOutput "$iso\vitest.out" -RedirectStandardError "$iso\vitest.err"
if (-not $p.WaitForExit(600000)) { taskkill /PID $p.Id /T /F; "BLOCKED: 10-minute cap, killed PID $($p.Id) tree only" } else { "EXIT=$($p.ExitCode)" }
Get-Content "$iso\vitest.out"
```

- Paste the vitest summary and the `EXIT=` line separately (G-042).
- Kill only with `taskkill /PID <the recorded PID> /T`.
- No test spawns a waker or an agent.
- Afterwards, paste `Get-ChildItem $iso -Recurse -Name`.
- No watch mode, and never the whole suite.

## 7. Known red

If a file you did not change fails:

1. `git switch --detach <BASE_SHA>`
2. Run that one file.
3. `git switch fix/t254-stale-process`
4. Paste both outputs.

If the failure is identical at the base, it was already there: name it and go on. You get at most **2** fix attempts on
your own failures, then STOP with `BLOCKED T-254 <test>`.

## 8. Typecheck

`npx tsc --noEmit; echo "EXIT=$LASTEXITCODE"` → `EXIT=0`.

## 9. Scope

Run `git diff --name-only <BASE_SHA>..HEAD`. Only these files may appear:

```
open-brain/src/pipelines/session-start/serving-build.ts
open-brain/tests/pipelines/session-start/stale-process.test.ts   (new)
```

Anything else means STOP. These are forbidden: `.agents/state.json`, `package.json`, `CHANGELOG.md` and `.github/`.

## 10. Push and PR

```powershell
git push origin fix/t254-stale-process
git ls-remote origin refs/heads/fix/t254-stale-process
git rev-parse HEAD
```

The two SHAs must be equal. Never use `--force`. Then:

```powershell
gh pr create --base master --head fix/t254-stale-process --title "T-254: build line says STALE PROCESS when the loaded build differs from disk" --body "Brief: docs/loops/stale-process-build-line-brief.md. D-143 small fix. Reviewed by the planner before QA."
```

## 11. STOP rules

At most 2 attempts at any failing step. A STOP still posts a reply whose line 2 is `BLOCKED T-254 <reason>`.

## 12. Reply

Post with the same hub-talk block as `t250-default-branch-brief.md` §12: as `cursor-builder` in room
`k575sfwr9wcx3r8fw83g3bc00x8fmar3`, with `--say-file`. The exit-code rules and the 9,000-character limit are the same.

- **Line 1:** `TASK: T-254 READY, stale-process build line (fix/t254-stale-process)`.
- **Line 2:** `READY T-254 <sha40>` or `BLOCKED T-254 <reason>`.
- **Then, in order:**
  1. `node -v`
  2. The start state
  3. The commit log
  4. The test command, the vitest summary and `EXIT=`
  5. The pasted `git diff <BASE_SHA>..HEAD -- open-brain/src` (the diff itself, not a description)
  6. `tsc` `EXIT=`
  7. The scope diff
  8. Mutants 1–4, every one run
  9. The push readback
  10. The PR number
  11. IMPACT: name every HIGH, CRITICAL or UNKNOWN target, with the grep of its callers and the tests that cover them.
- Every number is pasted command output, with the command shown above it.

## 13. RAM and time

Use one test process, with no real sleeps.

## Acceptance

| # | Check |
|---|---|
| T254-A1 | SP-1…SP-6 pass at the head; `tsc` 0; scope as §9; existing `serving-build.test.ts` and `briefing.test.ts` unchanged and green |
| T254-A2 | **A real process:** run `npm run build`, then copy `open-brain/build/` to a temp dir. A node process imports the COPIED `pipelines/session-start/serving-build.js`, then rewrites the copy's `build-info.json` commit to another 40-hex value, then calls `describeServingBuild()` with no arguments. The result starts with `Build <original7> · STALE PROCESS: disk has <new7>` |
| T254-A3 | Mutants 1–4 are each red on their named row |
| T254-A4 | **Note on rollout:** the first rebuild that contains T-254 cannot protect processes started before it, because they do not have the check. The protection starts with the rebuild after that. Clark's "running seats must /mcp reconnect open-brain" rebuild note stays in force until every seat has reconnected once after T-254's rebuild |
