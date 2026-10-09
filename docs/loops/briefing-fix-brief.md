# BRIEFING-FIX: ob_start briefing fixes, QA 295's four findings, #498's P1/P2

**By:** Atlas (planner), session 165, 2026-10-08. **Status:** the Makerspace import is PROVEN (D-141), so this is
dispatchable. Amended 2026-10-09 for checklist items 16–17 (PID-only kills, an isolated HOME, the impact reply). **The
base SHA in the dispatch turn overrides §2's.** **Specs:** clark's audit of Relay's session-32 greeting
(`docs/loops/fleet-deterministic-dispatch.md` §"ob_start fixes"), clark's BRIEFING-FIX spec of 2026-10-08 (pinned below),
QA 295's non-blocking findings (`qa/s164h-report` @ `bf0b9862`, `docs/loops/s164h-qa-report.md` §Findings), and #498's
P1/P2 (QA 291, `qa/s164d-report` @ `6561ae33`). Decisions: D-134, D-136, D-137, D-139. **Seat:** cursor-builder
(checkout `sia-builder`, QA PC). **Size:** LIGHT (named test files only, no HEAVY lease). **Written to**
`~/Worktrees/cursor-brief-checklist.md`; each section is numbered after the checklist item it satisfies.

```text
IMPACT-TARGETS: renderBriefing renderBudgeted describeUsage describeLatestBrief handleStart gitHashObjectStdin renderDeveloperBuildingChecksMdc installCommands preflightInstallCommandsWrite
```

New functions this job adds (not impact targets, since nothing calls them yet): `latestBriefPath`, `describeReadsOwed`,
`describeFleet`, `chicagoStamp`.

## 1. Shell and Node

PowerShell. Run these first and paste their output:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
```

If it prints `v24…`, STOP and reply `BLOCKED BRIEFING-FIX node v24`.

## 2. Start state

- **Checkout:** your own `sia-builder` worktree only.
- **Base:** `origin/master` at **`f6a50ebb1344b88631f8b34bf84ebd519e83b7dd`**. If the dispatch turn names a different
  40-char SHA, use the one in the dispatch turn. The planner restates it at dispatch, because master will move during
  the import.

```powershell
git fetch origin
git switch -c loop/briefing-fix <BASE_SHA>
git rev-parse HEAD
git status --porcelain
```

`git rev-parse HEAD` must print the base SHA, and `git status --porcelain` must print nothing. On any mismatch, STOP:
`BLOCKED BRIEFING-FIX start state`.

## 3. Forbidden git

Do not use any of these:

- `git stash`, which is shared by every worktree
- `reset --hard`
- `--force`
- rebase
- amend
- `cd` into another seat's tree

Do not touch any open PR other than the one you open (§10).

## The work: nine items (W1–W9)

Every user-visible string below is exact. Do not reword it.

### W1. Plain `## Briefing` header (clark §4)

- **Code:** `open-brain/src/pipelines/session-start/briefing.ts:19`. Change `BRIEFING_START` to exactly `"## Briefing"`.
- **Commands, same wording in all three files:** `.claude/commands/start.md`,
  `project-template/.claude/commands/start.md` and `project-template/.cursor/commands/start.md`.
  - The bootstrap command installs the template copies, and `/sync` checks them.
  - In each file, the sentence that tells the agent to print the block stays. That instruction now lives only in
    `start.md`.
  - Only these lines change: lines 69 and 103 in the two `.claude` copies, and 72 and 115 in the `.cursor` copy. They
    already say `## Briefing`. Check them with
    `git grep -n "## Briefing" -- .claude project-template`, and edit only if a line quotes the old long header.
- **Golden:** `open-brain/tests/fixtures-state/a2a-1c200b41-render.golden.txt` has the old header on lines 2, 129, 204
  and 300. Replace exactly those 4 lines with `## Briefing` and change nothing else in that file.
- **Snapshot:** `open-brain/tests/pipelines/__snapshots__/fleet-ae-f5.test.ts.snap` line 4. Update it with
  `npx vitest run tests/pipelines/fleet-ae-f5.test.ts -u`. Its diff must be that one header line.

### W2. Usage line: new head, and a STALE marker (clark §3)

`describeUsage(projectRoot, env, now: Date = new Date())`. Add the `now` parameter as the LAST one; existing callers
are unchanged. Keep how it finds the usage file (`usage_file` frontmatter, then `SIA_USAGE_FILE`). Keep the STOP (weekly
≥ 98) branch and the weekly ≥ 95 branch exactly as they are today.

- **The head, below the STOP branch:** `<LEVEL> (5h <fiveHourPct>%, resets <chicagoStamp(fiveHourResetsAt)>; week <sevenDayPct>% <pace.level>)`.
  - Drop any part whose field is absent, with no empty separators.
  - `week <pct>%` without `pace.level` is just `week 45%`.
  - Example, from `~/slots.json` on 2026-10-08:
    `Usage: GREEN (5h 18%, resets 10-08 21:40 CDT; week 45% WELL AHEAD) → dispatches open`
- **The weekly ≥ 95 branch:** keeps its ` + WEEKLY <n>%` segment and its consequence, unchanged.
- **STALE:** append to the whole line, after the `→ …` consequence: ` · STALE (<reasons>)`.
  - **Reason A:** `usageLevel.set` older than **45 min** before `now` gives `set <chicagoStamp(set)>, <m> min ago`,
    where `m` is whole minutes, floored.
  - **Reason B:** `fiveHourResetsAt` at or before `now` gives `reset <chicagoStamp(fiveHourResetsAt)> passed`.
  - When both apply, join them with `; `, A first.
  - A missing or unparseable `set` is not a reason. Nothing is printed for it.
  - Constant: `const USAGE_STALE_MINUTES = 45;` beside `USAGE_CONSEQUENCES`.
- **The STOP branch** also gets the STALE suffix, by the same rules.
- **`chicagoStamp(d: Date): string`** gives `MM-DD HH:MM <TZ>`.
  - Build it with `Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" })`.
  - Assemble it from `formatToParts`: `MM-DD HH:MM` plus the `timeZoneName` part (`CDT` in summer, `CST` in winter).
    An hour of `24` prints as `00`.
  - Export it from `briefing.ts`. W4 uses it too.
- **Missing or unreadable file:** today's `Usage: not checked (…)` line, unchanged.

### W3. READS OWED line (clark §1)

- **`latestBriefPath(projectRoot): { path: string; date: string } | null`** in `latest-brief.ts`.
  - Extract it from `describeLatestBrief`, the same selection.
  - `describeLatestBrief` then calls it, and its output is byte-identical to today's.
- **`describeReadsOwed(projectRoot, state, sessionNumber: number | null, seat: Seat | null, checkout: string | null): string`**, in a new
  `open-brain/src/pipelines/session-start/reads-owed.ts`.
  - **`prevDate`:** the `date` of the newest `state.sessions[]` row with `checkout === checkout` and `n < sessionNumber`.
    If there is no such row, or `sessionNumber` / `checkout` is null, `prevDate = null`.
    - The record holds dates only, not times. So "newer than the previous session" is `commitDate >= prevDate`,
      compared as `YYYY-MM-DD` strings.
    - The same day counts as owed. This fails toward showing (planner ruling, s165).
  - **`commitDate(path)`:** `git log -1 --format=%cs -- <path>` (YYYY-MM-DD). An untracked or uncommitted file has no
    date, and is owed when `prevDate` is null; otherwise it is not owed.
  - **Sources, in this order, de-duplicated, repo-relative with forward slashes, and only files that exist on disk:**
    - **a.** `latestBriefPath().path`, if `prevDate === null` or its `date.slice(0,10) >= prevDate`.
    - **b.** Every match of `/(?:docs|\.agents)\/[A-Za-z0-9._\/-]+\.md\b/g` in the text of the handoff
      `ownHandoff(state.handoffs, seat, checkout)` returns: `pick_up`, each watch-out's text and each open question's
      text. Use `ownHandoff`, `watchText` and `questionText`, all imported from
      `open-brain/src/shared/state-schema.ts`. `handleStart` passes the same `seat` and `ownCheckout` it already passes
      to `renderBriefing`. Unconditional.
    - **c.** `.agents/AGENT.md`, `.agents/AGENT.local.md` and `.agents/SYSTEM/domains.json`, each if
      `prevDate === null` or `commitDate >= prevDate`.
  - **Output, one line:**
    - With N ≥ 1 paths: `READS OWED (N): <p1> · <p2> · …`. Show at most **6** paths, then ` · +K more`.
    - With none: `READS OWED: none`. This line is always printed.
- **Plumbing:**
  - `BriefingInput` gains `readsOwed?: string`.
  - Both renderers push it right after the `Latest brief:` line. In the budgeted layout, `Latest brief:` may share its
    line with skills (`briefing.ts:296`); READS OWED goes on the next line either way.
  - When `readsOwed` is undefined, nothing is printed. This keeps the A2A golden byte-identical apart from W1.
  - `handleStart` (`server.ts`) always passes it.

### W4. Fleet block (clark §2)

- **`describeFleet(projectName: string, env = process.env, now = new Date()): { legacy: string[]; budget: string }`**,
  in a new `open-brain/src/pipelines/session-start/fleet.ts`.
- **Source:** `env.FLEET_JSON` if set, else `join(homedir(), "Projects", "fleet", "fleet.json")`.
- **Fields:** `verifiedAt`, `coordinator.name`, `hub.version`, `hub.url`, `dashboard.version`, `dashboard.url`, and
  `seats[]` (`name`, `project`, `kind`, `runtime`, `model`, `host`, `status`).
- **Seats shown:** `seats[]` whose `project` equals `projectName`, compared case-insensitively. Keep file order.
- **Legacy layout:** a block of lines, the first being `## Fleet (fleet.json, verified <chicagoStamp(verifiedAt)>)`:
  ```
  ## Fleet (fleet.json, verified 10-08 16:40 CDT)
  Coordinator: clark · questions and Aaron's decisions go to clark
  Hub: v1.21.0 http://100.124.212.87:4000 · Dashboard: v1.15.0 http://100.124.212.87:4100/
  Seats (SIA): atlas-sia planner claude-code/opus DESKTOP-UGEKR74 active · cursor-infra dev cursor/composer-2.5 DESKTOP-O4EGB1E active
  ```
  - Each seat prints as `<name> <kind> <runtime>/<model> <host> <status>`.
  - The `Seats (<projectName>):` line is never truncated in the legacy layout.
  - With no matching seats it reads `Seats (<projectName>): none in fleet.json`.
- **Budgeted layout:** one line,
  `FLEET: coordinator clark · hub v1.21.0 · dashboard v1.15.0 · seats atlas-sia, cursor-infra (verified 10-08 16:40 CDT)`.
  - Seat names only, joined with `, `.
  - The cap is `FLEET_LINE_CHARS = 200`, **including** ` +K more`. Cut whole names from the right.
  - The `(verified …)` and STALE parts are never cut. Cut names until the whole line fits.
- **Stale:** when `verifiedAt` is older than 24 h before `now`, append ` · STALE (verified <chicagoStamp(verifiedAt)>)`.
  In the legacy layout it goes on the header line; in the budgeted layout, at the end of the line.
- **Missing file, unreadable file or invalid JSON:** both layouts print one line,
  `FLEET: unavailable (<path>: not found)` or `FLEET: unavailable (<path>: invalid JSON)`. The briefing still renders,
  and nothing throws.
- **Placement:**
  - **Legacy:** directly before the `PICK UP HERE` section, as its own section starting with a blank line. The legacy
    layout has no SEATS line.
  - **Budgeted:** directly after the SEATS line when it is printed, otherwise directly before the `PICK UP HERE` line.
- **Plumbing:**
  - `BriefingInput` gains `fleet?: { legacy: string[]; budget: string }`, and nothing is printed when it is undefined.
  - `handleStart` passes `describeFleet(sj.data.project.name)`.

### W5. QA 295 N1: state the extraction convention

`renderDeveloperBuildingChecksMdc` (`open-brain/src/pipelines/sync/developer-building-checks.ts:79`). The header text
`(git hash-object of the extracted section)` becomes exactly:

`(git hash-object of the extracted section: trailing whitespace trimmed, one final LF)`

- Regenerate `.cursor/rules/developer-building-checks.mdc` with `node scripts/gen-cursor-rules.mjs` and commit it.
- `parseSectionShaFromMdc` must still parse the new header. Check it with
  `git grep -n "extracted section" -- open-brain`, and update every test that pins the old text.

### W6. QA 295 N2: two F8 test titles

In `open-brain/tests/pipelines/fleet-ae-f8.test.ts`, change only the titles:

| Line | Old title | New title |
|---|---|---|
| 20 | `cursor-rules-current fails when the .mdc drifts (mut-1 hashes whole file)` | `cursor-rules-current fails when the .mdc drifts (an appended line)` |
| 76 | `set_standing refuses unknown decision ids (mut-3 reads hub-partner-seats requiredBlock)` | `set_standing refuses unknown decision ids` |

### W7. QA 295 N3: F9 does not assume LF on disk

`open-brain/tests/pipelines/fleet-ae-f9.test.ts:30`:

- Old: `savedRole.replace(/\n/g, "\r\n")`
- New: `normalizeLf(savedRole).replace(/\n/g, "\r\n")`

Import `normalizeLf` from `../../src/pipelines/sync/developer-building-checks.js`.

### W8. QA 295 N4: no git process for the section hash

- In `developer-building-checks.ts`, delete `gitHashObjectStdin` and its `execFileSync` import.
- Every caller uses `gitBlobSha` from `open-brain/src/harness/gate-records.ts:283` instead, which computes the sha in
  process. List the callers with `git grep -n gitHashObjectStdin -- open-brain`.
- The value is unchanged: `gitBlobSha` equals `git hash-object --stdin` for the same UTF-8 bytes.

### W9. #498 P1 and P2 (`open-brain/src/pipelines/bootstrap/index.ts`)

- **P1, wrong advice on a permissions problem.**
  - **(a)** In `preflightInstallCommandsWrite`, replace both `accessSync(…, W_OK)` probes with a real write probe:
    `writeFileSync(join(dir, ".sia-write-probe-" + process.pid), "", { flag: "wx" })` then `unlinkSync` of it. On any
    throw, raise the same error message as today.
  - **(b)** In `installCommands`, move `preflightWrite(root);` (line 407) up so it runs BEFORE the dirty-tree check
    (line 400).
  - **(c)** In the dirty-tree branch, before throwing the `commit or stash it first` error, test whether the blocked path
    is readable.
    - Add `deps.readable?: (absPath: string) => boolean`. The default tries `readFileSync` for a file or `readdirSync`
      for a directory, and returns false on `EACCES` or `EPERM`.
    - If the path is not readable, throw exactly:
      ``\`${blocked}\` is not readable (permissions), so git reports it as changed — fix permissions and try again. Nothing written``
- **P2, a copied command survives a failure.**
  - In `installCommands`, record each `dest` whose `before === "absent"` once `copyFileSync` has run (`createdCopies`).
  - In the `catch`, before restoring renames, `unlinkSync` every `createdCopies` entry that exists.
  - After a forced failure, no command file may exist that did not exist before.

## 4. Commits (exactly three, in this order)

| # | Contents | Message |
|---|---|---|
| 1 | The new and changed tests only (§6). Red at this commit. | `BRIEFING-FIX: tests (red)` |
| 2 | W1–W9 product code, the start.md copies, the regenerated `.mdc`, golden/snapshot updates | `BRIEFING-FIX: plain header, stale usage, READS OWED, Fleet, QA 295 N1-N4, #498 P1/P2` |
| 3 | Only if a test from commit 1 needed a correction (explain it in the reply), otherwise do not make it | `BRIEFING-FIX: test corrections` |

After each commit, run `git status --porcelain` (it must be empty) and `git log --oneline <BASE_SHA>..HEAD` (it must
show 1, then 2 lines, or 3 if commit 3 exists). Paste both.

## 5. Mutants (D-137: changed lines only; LOCAL ONLY, NEVER PUSHED)

For each mutant:

1. `git switch -c mut-N <final head>`
2. Make the one edit.
3. `git commit -am "MUTANT N"`
4. Run §6's test command.
5. Paste the red test name and its assertion line.
6. `git switch loop/briefing-fix`

The tree must be clean after each one.

| N | Edit | Must turn red |
|---|---|---|
| 1 | `BRIEFING_START` back to the old long string | BF-H1 |
| 2 | `USAGE_STALE_MINUTES = 45` changed to `100000` | BF-U2 |
| 3 | In `describeReadsOwed`, drop source b (handoff paths) | BF-R2 |
| 4 | In `describeFleet`, remove the 24 h STALE append | BF-F3 |
| 5 | In `installCommands`' catch, remove the `createdCopies` unlink loop | BF-P2 |
| 6 | Move `preflightWrite(root);` back below the dirty-tree check | BF-P1a |
| 7 | Restore `execFileSync("git", ["hash-object","--stdin"], …)` as the section hash | BF-N4 |

## 6. Tests

**New test files:**

- `open-brain/tests/pipelines/session-start/briefing-fix.test.ts`, with the BF-H, BF-U, BF-R and BF-F rows
- `open-brain/tests/pipelines/briefing-fix-install.test.ts`, with the BF-P rows
- `open-brain/tests/pipelines/briefing-fix-sync.test.ts`, with the BF-N rows

All are hermetic:

- Usage, READS OWED and Fleet inputs come from temp files (`mkdtempSync(join(tmpdir(), …))`), `FLEET_JSON` /
  `SIA_USAGE_FILE` set on a passed `env` object (never `process.env`), and a fixed `now`.
- READS OWED rows use a temp git repo (`git init` plus dated commits via `GIT_COMMITTER_DATE`).
- No test reads the live `.agents/state.json`, `~/slots.json` or `~/Projects/fleet/fleet.json`.

**Required rows:**

| Row | Asserts |
|---|---|
| BF-H1 | `renderBriefing(...)[0] === "## Briefing"` in both layouts |
| BF-U1 | Fresh file (set 10 min before `now`, reset 2 h after) → exactly `Usage: GREEN (5h 18%, resets 10-08 21:40 CDT; week 45% WELL AHEAD) → dispatches open` with `now` = 2026-10-08T22:00:00Z and reset 2026-10-09T02:40:00Z |
| BF-U2 | `set` 52 min before `now` → line ends ` · STALE (set <stamp>, 52 min ago)` |
| BF-U3 | Reset before `now` → ` · STALE (reset <stamp> passed)`; both stale → both reasons joined with `; `, set first |
| BF-U4 | A winter date prints `CST` |
| BF-R1 | No previous session row → owes the latest brief, `.agents/AGENT.md` and `.agents/SYSTEM/domains.json` (files exist in the temp repo) |
| BF-R2 | A handoff pick_up naming `docs/loops/x-brief.md` and a watch-out naming `.agents/roles/developer.md` (both exist) → both appear, in source order, de-duplicated |
| BF-R3 | Previous session date after every commit date → `READS OWED: none` |
| BF-R4 | 8 owed paths → 6 shown, then ` · +2 more` |
| BF-F1 | A valid fleet file → the legacy block equals the 4-line example (with fixture values) and the budget line equals the one-line example |
| BF-F2 | The budget line with 40 seats stays ≤ 200 chars including ` +K more`, with whole names only |
| BF-F3 | `verifiedAt` 25 h old → STALE suffix in both layouts |
| BF-F4 | Missing file and invalid JSON → the exact `FLEET: unavailable (…)` lines, and `renderBriefing` still returns a block that ends `## End Briefing` |
| BF-F5 | Placement: legacy block directly before `PICK UP HERE`; budget line directly after SEATS |
| BF-P1a | `.claude/commands` unwritable (inject `preflightWrite` that throws) AND a dirty path outside the allowlist → the error is the permissions message, not `commit or stash` |
| BF-P1b | Dirty blocked path and injected `readable: () => false` → the exact `is not readable (permissions)` message |
| BF-P2 | A forced failure (injected `rename` that throws on the second OLD file) with one `absent` slot → after the throw, the absent slot's file does not exist |
| BF-N4 | With `PATH` emptied in the test's spawn environment (or `child_process.execFileSync` spied to throw), the section sha still equals the fixture value |

**Command** (PowerShell, from `open-brain/`). Run only these files, and never pipe the output. The run is started as a
process whose PID you record. It has a temp HOME, and the 10-minute cap stops ONLY that PID's tree (checklist 17):

```powershell
$iso = Join-Path $env:TEMP ("bf-home-" + [guid]::NewGuid().ToString("N")); New-Item -ItemType Directory $iso | Out-Null
$env:HOME = $iso; $env:USERPROFILE = $iso
$files = "tests/pipelines/session-start/briefing-fix.test.ts tests/pipelines/briefing-fix-install.test.ts tests/pipelines/briefing-fix-sync.test.ts tests/pipelines/session-start/briefing.test.ts tests/pipelines/session-start/briefing-budget.test.ts tests/pipelines/session-start/missing-handoff.test.ts tests/pipelines/session-start/standing-budget.test.ts tests/pipelines/session-start/a2a-byte-identical.test.ts tests/pipelines/session-start/record-source.test.ts tests/pipelines/fleet-ae-f1.test.ts tests/pipelines/fleet-ae-f5.test.ts tests/pipelines/fleet-ae-f8.test.ts tests/pipelines/fleet-ae-f9.test.ts tests/pipelines/bootstrap-fix-r4.test.ts"
$p = Start-Process -FilePath "npx.cmd" -ArgumentList "vitest run $files --no-file-parallelism --testTimeout=20000" -NoNewWindow -PassThru -RedirectStandardOutput "$iso\vitest.out" -RedirectStandardError "$iso\vitest.err"
if (-not $p.WaitForExit(600000)) { taskkill /PID $p.Id /T /F; "BLOCKED: 10-minute cap, killed PID $($p.Id) tree only" } else { "EXIT=$($p.ExitCode)" }
Get-Content "$iso\vitest.out"
```

- Paste the vitest summary from `vitest.out` and the `EXIT=` line separately (G-042).
- **Killing:** only `taskkill /PID <the PID you recorded> /T`. Never kill by name, image or command-line filter
  (`Stop-Process -Name`, `taskkill /IM`, `Where-Object CommandLine -match`). To look at stray processes, LIST them and
  paste the list; do not stop them.
- **Isolation:** no test in this job spawns a waker or an agent.
  - Every test that reads usage, fleet or record files passes temp paths and an `env` object (§6, hermetic).
  - The run's HOME and USERPROFILE are the temp `$iso`.
  - After the run, paste `Get-ChildItem $iso -Recurse -Name` as evidence of what the run wrote.
- Also run every other test file that `git grep -ln "describeUsage\|describeLatestBrief\|installCommands\|gitHashObjectStdin\|BRIEFING_START" -- open-brain/tests`
  lists, with the same block. Paste that list.
- No watch mode. No whole suite.

## 7. Known red

Some failures were already there. If a file you did not change fails:

1. `git switch --detach <BASE_SHA>`
2. Run that one file.
3. `git switch loop/briefing-fix`

Paste both outputs. A failure that is identical at the base is pre-existing; name it and go on. At most **2** fix
attempts on your own failures, then STOP with `BLOCKED BRIEFING-FIX <test>`.

## 8. Typecheck

From `open-brain/`, run `npx tsc --noEmit; echo "EXIT=$LASTEXITCODE"`. Expect `EXIT=0` and no output lines.

## 9. Scope

Run `git diff --name-only <BASE_SHA>..HEAD` and paste it. Only these files may appear:

```
.claude/commands/start.md
project-template/.claude/commands/start.md
project-template/.cursor/commands/start.md
.cursor/rules/developer-building-checks.mdc
open-brain/src/pipelines/session-start/briefing.ts
open-brain/src/pipelines/session-start/latest-brief.ts
open-brain/src/pipelines/session-start/reads-owed.ts        (new)
open-brain/src/pipelines/session-start/fleet.ts             (new)
open-brain/src/server.ts
open-brain/src/pipelines/sync/developer-building-checks.ts
open-brain/src/pipelines/bootstrap/index.ts
open-brain/tests/**                                          (tests, the golden, the snapshot)
```

Anything else means STOP. Forbidden outright: `.agents/state.json`, `package.json`, `CHANGELOG.md` (D-031: no version
bump in a candidate) and `.github/`.

## 10. Push and PR

```powershell
git push origin loop/briefing-fix
git ls-remote origin refs/heads/loop/briefing-fix
git rev-parse HEAD
```

The two SHAs must be equal; paste both. If the push is rejected, STOP. Never `--force`. Then:

```powershell
gh pr create --base master --head loop/briefing-fix --title "BRIEFING-FIX: plain header, stale usage, READS OWED, Fleet, QA 295 N1-N4, #498 P1/P2" --body "Brief: docs/loops/briefing-fix-brief.md. Reviewed by the planner before QA."
```

## 11. STOP rules

At most 2 attempts at any one failing step. A STOP still posts a reply with `BLOCKED BRIEFING-FIX <reason>` as its
first line.

## 12. Reply (§13 of the checklist)

```powershell
$env:HUB_URL = "http://100.124.212.87:4000"
node <your A2A-Hub checkout>/scripts/hub-talk.mjs --as cursor-builder --session k575sfwr9wcx3r8fw83g3bc00x8fmar3 --say "<text>"
```

- **First line:** exactly `READY BRIEFING-FIX <sha40>` or `BLOCKED BRIEFING-FIX <reason>`.
- **Then, in order:**
  1. `node -v`
  2. The start-state output
  3. The commit log
  4. The test command, its vitest summary and `EXIT=` (shown separately; G-042)
  5. The extra test-file list
  6. `tsc` `EXIT=`
  7. The scope diff
  8. Each mutant: name, red test and assertion line
  9. The push readback
  10. The PR number
  11. **GitNexus impact (checklist 16).** Clark's launcher puts `gitnexus impact` output for every IMPACT-TARGET at the
      top of your prompt. Name each target it rates HIGH, CRITICAL or UNKNOWN, and for each one name the test rows
      (BF-…, or an existing file from §6) that cover its callers. If there are none, write `IMPACT: no HIGH/CRITICAL/UNKNOWN`.
- Every number is pasted command output, with the command above it. Anything not run is marked `NOT RUN`.
- End your turn after posting.

## 13. RAM and time (checklist §14–15)

- Single test process, no second node, no hub listener running alongside.
- Rows that depend on time use a passed `now`, never real sleeps.

## Acceptance (QA after the planner's verification; mutants scoped per D-137)

| # | Check |
|---|---|
| BF-A1 | Every §6 row passes at the head; `tsc` 0; scope as §9 |
| BF-A2 | A real `ob_start` against a temp copy of this repo, with `FLEET_JSON`/`SIA_USAGE_FILE` pointing at fixtures, prints `## Briefing` as the first block line, the usage line with or without STALE as the fixture dictates, `READS OWED…` after `Latest brief:`, and the Fleet block or line in its place, in both layouts (`greeting.json` `briefing_budget` on and off) |
| BF-A3 | The A2A golden diff is the 4 header lines only; the f5 snapshot diff is 1 line |
| BF-A4 | `/sync` `cursor-rules-current` passes after regeneration; the `.mdc` header carries the N1 wording |
| BF-A5 | Mutants 1–7 are each red on their named row |
| BF-A6 | Windows only: P1 reproduced with a real ACL (`icacls <dir> /deny "%USERNAME%:(W)"`) gives the permissions message, and the ACL is restored afterwards |
