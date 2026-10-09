# T-250: resolve the remote's default branch instead of hardcoding `origin/master`

**By:** Atlas (planner), session 166, 2026-10-09. **Lane:** D-143 small fix, not a loop. Clark asked for it on Aaron's
behalf. **Evidence:** the Makerspace planner session c28bf91a (`~/Worktrees/makerspace-planner`,
`melvenac/melvenac-makerspace`, default branch `main`) started at 15:22 CDT. Its FLAGS read "Tree currency was not checked.
This checkout has no origin/master". So for any repo whose default branch is not `master`, the currency check, the record
source and role-file freshness never run. **The base SHA in the dispatch turn overrides §2's.** **Seat:** whichever Cursor
seat clark dispatches (default `cursor-builder`, checkout `sia-builder`, QA PC). **Size:** LIGHT (named test files only, no
HEAVY lease). **Written to** `~/Worktrees/cursor-brief-checklist.md`, with sections numbered after the checklist items.

```text
IMPACT-TARGETS: describeTreeCurrency resolveRecordSource describeRoleFiles isBehindUpstream
```

`resolveUpstreamRef` is a new function and nothing calls it yet, so it is not an impact target.

**Out of scope, do not touch:** `serving-build.ts` (`SERVING_UPSTREAM` describes SIA's own build, which really is on
master), `pipelines/detach/`, `harness/brief-plan-gate.ts`, `harness/shadow-merge.ts`, `harness/cli.ts`, and every
comment that mentions `origin/master`. Comments stay as they are. Makerspace briefs living in `.agents/plans/` (no
`Latest brief:` line) is also out of scope. It is not a defect: the line is correctly absent.

## 1. Shell and Node

PowerShell. Run first and paste the output:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
```

If it prints `v24…`, STOP and reply `BLOCKED T-250 node v24`.

## 2. Start state

- **Checkout:** your own seat worktree only.
- **Base:** `origin/master` at **`3650ca12ef632b2a907ab6babf5dc66feb2fb825`**, unless the dispatch turn names a different
  40-char SHA. In that case use the dispatch turn's SHA.

```powershell
git fetch origin
git switch -c fix/t250-default-branch <BASE_SHA>
git rev-parse HEAD
git status --porcelain
```

`git rev-parse HEAD` must print the base SHA, and `git status --porcelain` must print nothing. On any mismatch, STOP:
`BLOCKED T-250 start state`.

## 3. Forbidden git

Do not use `git stash` (every worktree shares it), `reset --hard`, `--force`, rebase or amend, and do not `cd` into
another seat's tree. Touch no PR except the one you open (§10).

## The work (W1–W4)

### W1. New module `open-brain/src/pipelines/session-start/upstream-ref.ts`

```ts
import { execFileSync } from "node:child_process";

/** Fallback when the remote's default branch cannot be resolved; keeps SIA's behaviour and skip texts unchanged. */
export const FALLBACK_UPSTREAM = "origin/master";

/**
 * T-250: the remote-tracking ref of origin's DEFAULT branch, as of the last fetch. No network.
 * 1. `git symbolic-ref --quiet --short refs/remotes/origin/HEAD` → e.g. "origin/main", accepted only if it starts
 *    with "origin/" AND `git rev-parse --verify --quiet <ref>^{commit}` succeeds;
 * 2. else "origin/main" if it verifies as a commit;
 * 3. else "origin/master" if it verifies;
 * 4. else FALLBACK_UPSTREAM (so the existing "does not exist in this checkout" skip line still fires, naming it).
 */
export function resolveUpstreamRef(projectRoot: string): string
```

- Run git with `execFileSync("git", args, { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000, windowsHide: true })`
  and `.trim()` the output. Any throw counts as "no answer" for that step. **Pass args as an array, never as a shell
  string**: `^{commit}` loses its `^` to cmd.exe (see `tree-currency.ts:462`).
- It never throws.
- Do NOT add `git ls-remote` (T-250's note mentions it). The SessionStart hook has already fetched, and the startup path
  must stay network-free beyond that fetch.

### W2. `tree-currency.ts`: the default ref

At `compare()` (line 227), `options.upstreamRef ?? "origin/master"` becomes `options.upstreamRef ?? resolveUpstreamRef(projectRoot)`.
The `/** Defaults to origin/master. */` comment on line 88 becomes `/** Defaults to resolveUpstreamRef(projectRoot) (T-250). */`.
Nothing else in this file changes. The message builders already print `d.upstreamRef`.

### W3. `record-source.ts`: the default ref

Line 57, `resolveRecordSource(projectRoot: string, upstreamRef = "origin/master")`, becomes
`resolveRecordSource(projectRoot: string, upstreamRef = resolveUpstreamRef(projectRoot))`. Nothing else changes.

### W4. `role-files.ts`: role-file freshness

- **WARNING:** line 239 contains a literal NUL byte inside a string (`log.split("<NUL>")`). Your editor must keep it
  byte-for-byte. After committing, `git diff <BASE_SHA>..HEAD -- open-brain/src/pipelines/session-start/role-files.ts`
  must show no change on that line. Paste that diff.
- `function isBehindUpstream(projectRoot: string, rel: string): boolean` (line 316) becomes
  `export function isBehindUpstream(projectRoot: string, rel: string, upstreamRef: string): boolean`, and line 318 uses
  `` `${upstreamRef}:${rel}` `` in place of `` `origin/master:${rel}` ``.
- The caller at line 302 passes `resolveUpstreamRef(projectRoot)` as the third argument.
- In the label string at line 206, `"behind origin/master"` becomes `"behind upstream"`. That text is shown to users;
  check that no test pins the old wording with `git grep -n "behind origin/master" -- open-brain/tests`, and update any
  test that does.

## 4. Commits (exactly two, in this order)

| # | Contents | Message |
|---|---|---|
| 1 | §6's new test file only; it must be red at this commit | `T-250: tests (red)` |
| 2 | W1–W4 product code, plus any test that pinned `behind origin/master` | `T-250: resolve origin's default branch for tree currency, record source and role-file freshness` |

After each commit, paste `git status --porcelain` (must be empty) and `git log --oneline <BASE_SHA>..HEAD` (1 line, then 2).

## 5. Mutants (D-137; local only, never pushed)

For each mutant: `git switch -c mut-N <final head>`, make the one edit, `git commit -am "MUTANT N"`, run §6's command,
paste the test that turned red and its assertion line, then `git switch fix/t250-default-branch`. The tree must be clean
after each one.

| N | Edit | Must turn red |
|---|---|---|
| 1 | `resolveUpstreamRef` returns `FALLBACK_UPSTREAM` unconditionally | UR-1, UR-6 |
| 2 | Drop step 1 (the symbolic-ref lookup) | UR-5 |
| 3 | In `isBehindUpstream`, hardcode `` `origin/master:${rel}` `` again | UR-8 |
| 4 | `resolveRecordSource`'s default back to `"origin/master"` | UR-7 |

## 6. Tests

**New file:** `open-brain/tests/pipelines/session-start/upstream-ref.test.ts`. It is hermetic: every repo lives under
`mkdtempSync(join(tmpdir(), "t250-"))` and is built with `execFileSync("git", [...])` (array args). Set
`user.name` / `user.email` with `-c` on each commit. Nothing reads the live repo.

Fixture: `git init --bare -b main remote.git`. Push one commit to `main` from a seed clone. Then `git clone remote.git work`.
The clone sets `origin/HEAD → origin/main`.

| Row | Setup | Asserts |
|---|---|---|
| UR-1 | `work` as cloned | `resolveUpstreamRef(work) === "origin/main"` |
| UR-2 | `git -C work remote set-head origin -d` (origin/HEAD removed; origin/main still there) | `=== "origin/main"` |
| UR-3 | The same fixture built with `-b master` | `=== "origin/master"` (SIA unchanged) |
| UR-4 | `git init` with no remote | `=== "origin/master"`, and `describeTreeCurrency(dir).lines[0]` still contains `origin/master does not exist in this checkout` |
| UR-5 | Push a `develop` branch, then `git -C work fetch` and `git -C work remote set-head origin develop` | `=== "origin/develop"` (symbolic-ref wins over the `main` fallback) |
| UR-6 | Push one more commit to `main` from the seed clone, then `git -C work fetch` | `describeTreeCurrency(work)`: `severity !== "skip"`, `upstreamRef === "origin/main"`, `headBehind === 1`, and `lines.join("\n")` contains `origin/main` and does not contain `NOT CHECKED` |
| UR-7 | `work` as cloned | `resolveRecordSource(work).upstreamRef === "origin/main"`, and its `line` does not contain `does not exist in this checkout` |
| UR-8 | Commit `a.md` to `main` and push; in `work`, fetch, then commit a different `a.md` locally | `isBehindUpstream(work, "a.md", "origin/main") === true`; with the same blob on both sides it is `false` |

**Command** (PowerShell, from `open-brain/`). The run is a process whose PID you record. It gets a temp HOME, and the
10-minute cap stops only that PID's tree (checklist 17):

```powershell
$iso = Join-Path $env:TEMP ("t250-home-" + [guid]::NewGuid().ToString("N")); New-Item -ItemType Directory $iso | Out-Null
$env:HOME = $iso; $env:USERPROFILE = $iso
$files = "tests/pipelines/session-start/upstream-ref.test.ts tests/pipelines/session-start/tree-currency.test.ts tests/pipelines/session-start/tree-currency-fetch.test.ts tests/pipelines/session-start/record-source.test.ts tests/pipelines/session-start/role-files.test.ts tests/pipelines/bootstrap-fix.test.ts tests/pipelines/fleet-ae-a4.test.ts tests/pipelines/fleet-ae-f4.test.ts"
$p = Start-Process -FilePath "npx.cmd" -ArgumentList "vitest run $files --no-file-parallelism --testTimeout=20000" -NoNewWindow -PassThru -RedirectStandardOutput "$iso\vitest.out" -RedirectStandardError "$iso\vitest.err"
if (-not $p.WaitForExit(600000)) { taskkill /PID $p.Id /T /F; "BLOCKED: 10-minute cap, killed PID $($p.Id) tree only" } else { "EXIT=$($p.ExitCode)" }
Get-Content "$iso\vitest.out"
```

- Paste the vitest summary and the `EXIT=` line separately (G-042).
- Kill only with `taskkill /PID <the recorded PID> /T`. Never kill by name, image or command line. To see stray
  processes, LIST them and do not stop them.
- No test in this job spawns a waker or an agent. Afterwards, paste `Get-ChildItem $iso -Recurse -Name`.
- No watch mode, and never the whole suite.

## 7. Known red

If a file you did not change fails: `git switch --detach <BASE_SHA>`, run that one file, `git switch fix/t250-default-branch`,
and paste both outputs. If the failure is identical at the base, it was already there: name it and go on. You get at
most **2** fix attempts on your own failures. After that, STOP with `BLOCKED T-250 <test>`.

## 8. Typecheck

From `open-brain/`, run `npx tsc --noEmit; echo "EXIT=$LASTEXITCODE"`. Expect `EXIT=0` and no output lines.

## 9. Scope

Paste `git diff --name-only <BASE_SHA>..HEAD`. Only these files may appear:

```
open-brain/src/pipelines/session-start/upstream-ref.ts   (new)
open-brain/src/pipelines/session-start/tree-currency.ts
open-brain/src/pipelines/session-start/record-source.ts
open-brain/src/pipelines/session-start/role-files.ts
open-brain/tests/**
```

Anything else means STOP. Forbidden: `.agents/state.json`, `package.json`, `CHANGELOG.md` (D-031) and `.github/`.

## 10. Push and PR

```powershell
git push origin fix/t250-default-branch
git ls-remote origin refs/heads/fix/t250-default-branch
git rev-parse HEAD
```

Both SHAs must be equal; paste both. If the push is rejected, STOP. Never use `--force`. Then:

```powershell
gh pr create --base master --head fix/t250-default-branch --title "T-250: resolve origin's default branch (main-default repos get a real currency check)" --body "Brief: docs/loops/t250-default-branch-brief.md. D-143 small fix. Reviewed by the planner before QA."
```

## 11. STOP rules

At most 2 attempts at any failing step. A STOP still posts a reply whose second line is `BLOCKED T-250 <reason>`.

## 12. Reply

```powershell
$env:HUB_URL = "http://100.124.212.87:4000"
$ht = "C:/Users/Aaron Melven/Projects/A2A-Hub/scripts/hub-talk.mjs"
if (-not (Test-Path $ht)) { "hub-talk not at $ht: use the exact hub-talk.mjs path your --inbox call used at the start of this run" }
node $ht --as <your seat name> --session <your seat room, as the dispatch turn names it> --say-file "$iso\reply.txt"; "EXIT=$LASTEXITCODE"
```

- Exit codes follow `.cursor/rules/hub-room.mdc`: 0 means posted, end the turn. 1 means the call was wrong: fix it, and do
  not retry it unchanged. 3 means the hub is unavailable: back off 5 s, doubling to 60 s, and stop after 5 in a row.
- Keep each post under 9,000 characters.
- **Line 1:** `TASK: T-250 READY, default-branch upstream ref (fix/t250-default-branch)`. On a stop, `BLOCKED` replaces `READY`.
- **Line 2:** `READY T-250 <sha40>` or `BLOCKED T-250 <reason>`.
- **Then, in order:**
  1. `node -v`
  2. The start state
  3. The commit log
  4. The test command, the vitest summary and the `EXIT=` line
  5. The `role-files.ts` diff (W4's NUL check)
  6. The `tsc` `EXIT=`
  7. The scope diff
  8. Mutants 1–4
  9. The push readback
  10. The PR number
  11. **IMPACT:** each target clark's launcher rated HIGH, CRITICAL or UNKNOWN, with the UR rows or §6 files that cover
      its callers, or `IMPACT: no HIGH/CRITICAL/UNKNOWN`.
- Every number is pasted command output, with the command shown above it. Anything not run is `NOT RUN`. End your turn
  after posting.

## 13. RAM and time

One test process, and no hub listener running alongside it. No real sleeps: none of these rows depends on timing.

## Acceptance (QA after the planner's verification; D-140 routes it to a Grok bot)

| # | Check |
|---|---|
| T250-A1 | Every UR row passes at the head; `tsc` 0; scope as §9 |
| T250-A2 | Mutants 1–4 are each red on their named rows |
| T250-A3 | A real `ob_start` (fresh build) in `~/Worktrees/makerspace-planner` prints a `Tree currency:` line naming `origin/main` and no `NOT CHECKED`, and a `record source:` line that is not `LOCAL (origin/master unreadable…)` |
| T250-A4 | In this repo (`sia-planner`) the currency and record-source lines are byte-identical to the pre-fix build's apart from counts (master default unchanged) |
