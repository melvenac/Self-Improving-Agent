# T-296 step 1: "Latest brief" counts task-named briefs (`*-task.md`)

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t296s1-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-16, session 173. **Task:** T-296 (P1), part (2). **Tag:** `T-296-S1`. **Size:** SMALL.
**Base:** the dispatch SHA clark names (a master that contains this brief). **Checklist:**
`~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: BRIEF_NAME isBrief (open-brain/src/pipelines/session-start/latest-brief.ts: one regex changes; isBrief's callers are latestBriefSelection, which serves describeLatestBrief (start-report.ts) and latestBriefPath (reads-owed.ts))
```

## Why

`ob_start`'s `Latest brief:` line, and the READS OWED entry built from it, count a file under `docs/loops/` only when
its name ends in `brief.md`, `rebrief.md` or an `-amendment-N` of either (`latest-brief.ts`, `BRIEF_NAME`). A2A-Hub
names its build briefs `l<N>-build-task.md` (104 `*task*` files in its `docs/loops/`). So on 10-16, Relay's `/start`
said `Latest brief: docs/loops/loop-50-brief.md (2026-10-14)` while L69 (`docs/loops/l69-build-task.md`, committed
2026-10-15) was in flight. READS OWED then sent Relay to loop 50. SIA's own fix rounds use the same name
(`t262-fix-1-task.md`).

A wrong line is worse than no line. This step counts `*-task.md` (and its `-amendment-N`) as a brief, everywhere
`BRIEF_NAME` applies.

**Out of scope:**
- T-296 part (1), the stale usage verdict. It is latent since clark removed `usageLevel` from `~/slots.json` on 10-16,
  and the STALE-suffix design is T-233/T-234's.
- T-296 part (3), the State block.
- Makerspace's `.agents/plans/` briefs. That folder mixes briefs with reports, jobs and handoffs under no name rule,
  so it keeps getting no line, which is honest.

## Ruling (exact)

1. `open-brain/src/pipelines/session-start/latest-brief.ts`:
   - `export const BRIEF_NAME = /(^|-)(re)?brief(-amendment-\d+)?\.md$/;` becomes
     `export const BRIEF_NAME = /(^|-)((re)?brief|task)(-amendment-\d+)?\.md$/;`.
   - In the doc comment directly above it, after the line ending `could be named the latest brief.`, add exactly
     this line (backticks are literal):
     ```ts
      * T-296: `*-task` counts too (A2A's `l69-build-task.md`, SIA's `t262-fix-1-task.md`), so a task-named brief is not passed over for an older `-brief`.
     ```
   - In the file's header comment (line 10), replace this text:
     ```text
     whose basename ends in `brief.md`, `rebrief.md` or an `-amendment-N` of either (T-233 C).
     ```
     with:
     ```text
     whose basename ends in `brief.md`, `rebrief.md`, `-task.md` (T-296) or an `-amendment-N` of any of them (T-233 C).
     ```
   - Nothing else in src changes. `ROOT_BRIEF_NAME` (the docs-root rule) stays exactly as it is.
2. The three `start.md` copies: `.claude/commands/start.md`, `project-template/.claude/commands/start.md` and
   `project-template/.cursor/commands/start.md`. In each, the text
   ``` `*rebrief.md` or an `-amendment-N` of either ``` (it occurs once per file) becomes
   ``` `*rebrief.md`, `*-task.md` or an `-amendment-N` of any of them ```. Nothing else in those files changes.

## Rows (commit 1: append to `open-brain/tests/pipelines/session-start/latest-brief.test.ts`)

Add a new top-level `describe("T-296 — task-named briefs", () => { ... })` at the END of the file. It reuses the file's
own `repo()` and `commit()` helpers. Add `readFileSync` and `resolve` to the existing imports from `node:fs` and
`node:path` if they are not already imported. Do not change any existing row.

- **K1** `it.each(["l69-build-task.md", "t262-fix-1-task.md", "l70-build-task-amendment-1.md", "v1.25.0-release-task.md", "task.md"])`
  titled `"K1 kept: %s is a brief"`. For each: `repo()`, `commit(root, "loop-1-brief.md", "2026-09-01T12:00:00+00:00")`,
  `commit(root, name, "2026-09-20T12:00:00+00:00")`. Expect `describeLatestBrief(root)` to be
  `` `Latest brief: docs/loops/${name} (2026-09-20)` ``.
- **K2** `it.each(["l69-qa-job.md", "l69-qa-results.md", "t262-task-notes.md", "loop-9-task-2.md", "multitask.md", "l69-build-task.md.orig"])`
  titled `"K2 excluded: %s is not a brief"`, with the same two commits. Expect
  `"Latest brief: docs/loops/loop-1-brief.md (2026-09-01)"`.
- **K3** (A2A's case) `repo()`, then `commit(root, "loop-50-brief.md", "2026-10-14T12:00:00+00:00")`, then
  `commit(root, "l69-build-task.md", "2026-10-15T16:57:02+00:00")`. Expect
  `"Latest brief: docs/loops/l69-build-task.md (2026-10-15)"`.
- **K4** `const repoRoot = resolve(__dirname, "../../../..")`. For each of the three `start.md` paths in ruling 2,
  `readFileSync(join(repoRoot, f), "utf8")` contains `` "`*-task.md`" `` (pass `f` as the expect message).
  (`__dirname` is already used the same way in `briefing.test.ts:609`; if the file is ESM without `__dirname`, use
  `resolve(import.meta.dirname, "../../../..")`.)

**Expected at commit 1 (the base):** every K1 row, K3 and K4 RED; every K2 row green.

## Existing tests (verdicts)

The planner grepped `isBrief`, `BRIEF_NAME`, `describeLatestBrief`, `latestBriefPath`, `-task.md`, `rebrief.md` and
`amendment-N` under `open-brain/tests` at c84f0af9:

- `tests/pipelines/session-start/latest-brief.test.ts`: every T210, T233-C and T277 row stays green. No excluded name
  in T233-C (lines 128-138) ends in `-task.md`, and every kept name is still kept.
- `tests/pipelines/session-start/briefing.test.ts:608`, "every start.md copy says to print the block verbatim...":
  stays green. Its strings (`the serving-build line first, then usage`, `## End Briefing`, `verbatim`, and the
  absence of `` `*brief*.md` ``) are untouched by ruling 2.
- `tests/pipelines/session-start/briefing-fix.test.ts` (READS OWED rows) and `briefing-budget.test.ts`: stay green.
  Their fixtures name `-brief.md` files only.
- `tests/pipelines/sync/start-parity.test.ts`: stays green. Ruling 2 makes the same edit to both template copies.

**No other existing test changes.** Any other red row: STOP, `BLOCKED T-296-S1 <test name>`.

## Steps

1. PowerShell:
   `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t296s1-reply.md")); "REPLY_PATH=$reply"`, then
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`; otherwise STOP).
2. Fresh clone into `(Join-Path $env:TEMP "t296s1-wt")` unless the launcher named one.
   - `git checkout -q -b fix/t296-task-briefs <base>`.
   - Check that `git rev-parse HEAD` equals the base, that `git status --porcelain` is empty, and that
     `git ls-tree --name-only HEAD docs/loops/t296-task-briefs-brief.md` prints the path.
   - `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`. On "Could not locate the bindings file",
     run `npm rebuild better-sqlite3` and say so.
   - **Forbidden:**
     - `git stash`, `reset --hard`, `--force`, rebase and amend;
     - `cd` into another checkout;
     - `npm run test:heavy`;
     - killing any process by name;
     - any read or write of `~/.claude/open-brain/`;
     - any edit of any real `settings.json`.
3. **Commit 1, `T-296-S1: rows for task-named briefs`:** the test file only. `$env:NO_COLOR='1'`; in `open-brain`, run
   `npx vitest run tests/pipelines/session-start/latest-brief.test.ts --no-file-parallelism --testTimeout=180000`.
   Exactly the K1 rows, K3 and K4 must be red. Paste the summary and the `x` rows.
4. **Commit 2, `T-296-S1: Latest brief counts *-task.md briefs (A2A's l<N>-build-task.md)`:** rulings 1 and 2.
   - Run `npx vitest run tests/pipelines/session-start/latest-brief.test.ts tests/pipelines/session-start/briefing.test.ts tests/pipelines/session-start/briefing-fix.test.ts tests/pipelines/session-start/briefing-budget.test.ts tests/pipelines/sync/start-parity.test.ts --no-file-parallelism --testTimeout=180000`
     with a 20-minute wall-clock cap. All green. Paste the `Test Files` and `Tests` lines.
   - Then `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), and `npm run build` (exit 0).
5. Both commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline <base>..HEAD` shows 2 lines; `git status --porcelain` is empty.
6. **Mutants.** For each one:
   - Run `npx vitest run tests/pipelines/session-start/latest-brief.test.ts --no-file-parallelism --testTimeout=180000`.
   - Paste the summary, the `x` rows and the mutant's `git diff` line.
   - Restore with `git checkout -- <file>` and check that `git status --porcelain` is empty. Never commit a mutant.

   The mutants:
   - **M1** `BRIEF_NAME` back to `/(^|-)(re)?brief(-amendment-\d+)?\.md$/`. Expect every **K1** row and **K3** red.
   - **M2** `BRIEF_NAME` → `/((re)?brief|task)(-amendment-\d+)?\.md$/` (the `(^|-)` group dropped). Expect **K2
     `multitask.md`** red, and the existing **T233-C excluded `notabrief.md`** row red.
   - **M3** `BRIEF_NAME` → `/(^|-)((re)?brief|task)(-amendment-\d+)?\.md/` (the `$` dropped). Expect **K2
     `l69-build-task.md.orig`** red, and the existing **T233-C excluded `loop-9-brief.md.orig`** row red.
   - **M4** `project-template/.cursor/commands/start.md`: restore ruling 2's text to the base wording. Expect **K4**
     red.
7. `git diff --name-only <base>..HEAD` shows exactly these five files:
   - `.claude/commands/start.md`
   - `open-brain/src/pipelines/session-start/latest-brief.ts`
   - `open-brain/tests/pipelines/session-start/latest-brief.test.ts`
   - `project-template/.claude/commands/start.md`
   - `project-template/.cursor/commands/start.md`
8. Push and open the PR:
   - `git push origin fix/t296-task-briefs` (never force). `git ls-remote origin refs/heads/fix/t296-task-briefs` must
     equal `git rev-parse HEAD`. If the push is rejected, STOP.
   - `gh pr create --base master --head fix/t296-task-briefs --title "T-296-S1: Latest brief counts *-task.md briefs" --body "Brief: docs/loops/t296-task-briefs-brief.md. Relay's /start named loop-50 as the latest brief while L69's l69-build-task.md was in flight."`.
   - `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T-296-S1 <sha40> PR #<n>`, or `BLOCKED T-296-S1 <reason>`.
- **STOP rules:** at most 2 attempts at any one step, never "fix until green". A STOP still writes the reply.
- Then each command with its output. Every number is pasted output, with the command shown above it. Mark anything
  not run `NOT RUN`. Do not merge.
