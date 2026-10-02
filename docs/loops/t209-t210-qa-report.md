# QA 253 report: T-209 (gaps newest-first) + T-210 (latest brief by git commit date)

**By:** QA 253 (headless Claude Code, Opus 5.5), record session 253, 2026-10-02. **Dispatch:**
`docs/loops/qa-253-t209-t210-dispatch.md`. **Dispatch tree:** `~/qa-scratch/qa253-wt` at
`00552846cc6d2b7469d3b202407b949bc2d3fc8c` (`git -C ~/qa-scratch/qa253-wt log -1 --format=%H`).
**Candidate:** `6c495794145097d47f009963c2c93dadfb1a319b` (worktree `~/qa-scratch/qa253-cand`), branch
`origin/loop/t209-t210-render` (tip `5ceb6eef7ed217cbb4fdcc6c9f34f9cc5ea37cd4`, the handoff only), PR #287. **Base:**
`79d1f5d915e2fb89680afec51ead485c9cf4e893` (worktree `~/qa-scratch/qa253-base`). Job class LIGHT: touched tests, the
`session-start` neighbours, mutants, `gh` reads. No full suite. **No live Jev call.** No issue or PR was created,
commented on or edited. Pushed only `qa/t209-t210-report`, through `push-qa.mjs`.

**Deviation, disclosed:** this session's shell permissions refused any command that set `TMPDIR` (as an inline variable,
`env` or `export`), so vitest ran with the default `TMPDIR`. The repo's `tests/setup-env.ts` still redirected the DB,
score history, shadow log, active-session slot and vault into a mkdtemp directory. My own fixtures were made under
`~/qa-scratch/qa253-fix` explicitly, and my `handleStart` driver sets `TMPDIR=~/qa-tmp` and `HOME=~/qa-scratch/qa253-home`
in-process. Some repo tests (`server.test.ts`, `latest-brief.test.ts`) created and removed fixtures under `/tmp`.

QA's own files are committed beside this report: `docs/loops/qa-253/tests/qa253-t209.test.ts`,
`docs/loops/qa-253/tests/qa253-t210.test.ts` (each copied into `open-brain/tests/pipelines/session-start/` of the tree
under test, then deleted), `docs/loops/qa-253/live-start.mts` (rows 4 and 7) and `docs/loops/qa-253/brief-dates.mjs`
(row 7).

## Verdicts

- **T-209: REJECT.** Two defects:
  1. **The numeric id tie-break is dead code.** `newestGapFirst` reads
     `Number(/(d+)s*$/.exec(a.id)?.[1])`. The backslashes are missing from the source bytes (checked with `od -c`), so the
     regex matches a literal `d`, `exec` returns `null` for every `G-NNN` id, and the comparator always falls through to
     `b.id.localeCompare(a.id)`, which compares the ids as text. **G-99 renders before G-100**, which fails row 2. The dev's
     T209-1 fixture (`G-1000`, `G-003`, `G-002`) happens to be in descending order as text too, so it passes either way.
  2. **CI `test` is red on the branch.** `tests/server.test.ts:199` ("renders the State section from a valid state.json…")
     still asserts `Gaps (5):\n  G-001 — …`, the old oldest-first order. It fails on the candidate (reproduced locally) and
     passes on the base. Both CI runs on `5ceb6eef` (which has the same code as `6c495794`) concluded **failure** with
     `test=failure`.
- **T-210: ACCEPT on its own rows** (5, 6 and 7 all met, and both mutants are killed). It ships in the same commit as T-209,
  so it cannot merge until T-209 is fixed.
- **Pair: REJECT.**

## 1. Confined: MET

`git diff --stat 79d1f5d9...6c495794`:

```
 .../src/pipelines/session-start/latest-brief.ts    |  56 +++++++++
 .../src/pipelines/session-start/state-render.ts    |  13 +-
 open-brain/src/server.ts                           |   6 +
 .../pipelines/session-start/latest-brief.test.ts   | 135 +++++++++++++++++++++
 .../pipelines/session-start/state-render.test.ts   |  33 +++++
 5 files changed, 242 insertions(+), 1 deletion(-)
```

`6c495794..5ceb6eef` adds only `docs/loops/t209-t210-developer-handoff.md`. The `server.ts` hunk:

```diff
+import { describeLatestBrief } from "./pipelines/session-start/latest-brief.js";
@@ -259,6 +260,11 @@ export async function handleStart(args: StartArgs): Promise<ToolResponse> {
       lines.push(`\nDrift: none`);
     }
 
+    // T-210: the newest brief by git commit date, so the briefing does not guess it from file names.
+    // Omitted when there is no brief; says so when git could not answer.
+    const latestBrief = describeLatestBrief(projectRoot);
+    if (latestBrief) lines.push(latestBrief);
+
```

What it changes: `handleStart` (ob_start) adds one line right after the drift block: `Latest brief: <path> (<date>)`
or `Latest brief: not determined (git: …)`. When `describeLatestBrief` returns `null`, nothing is added. Nothing else in
`server.ts` changes. The `state-render.ts` hunk adds `.sort(newestGapFirst)` to the open-gap list and the
`newestGapFirst` export. There are no edits outside T-209 and T-210.

## 2. T-209 red then green: PARTIAL (the numeric tie-break fails)

**Red on base:** the candidate's `state-render.test.ts` plus my `qa253-t209.test.ts`, copied into `qa253-base`:
`Tests 5 failed | 35 passed (40)`. **T209-1 fails**: `expected [ 'G-001', 'G-005', 'G-002', …(3) ] to deeply equal
[ 'G-049', 'G-1000', 'G-003', …(3) ]` (append order). The base tree was restored afterwards.

**On the candidate:** `state-render.test.ts` + `latest-brief.test.ts`: `Tests 46 passed (46)`. My rows:

| row | fixture (append order) | expected | candidate |
| --- | --- | --- | --- |
| Q253-2a | G-030@54, G-007@150, G-012@65 | G-007, G-012, G-030 (150, 65, 54) | **pass** |
| Q253-2b | G-99@60, G-100@60 (both orders) | **G-100, G-99** | **FAIL**: `[ 'G-99', 'G-100' ]` |
| Q253-2c | G-2@7, G-10@7, G-9@7 | G-10, G-9, G-2 | **FAIL**: `[ 'G-9', 'G-2', 'G-10' ]` |
| Q253-2d | G-100@10, G-005@200 | G-005, G-100 | pass |

Session order is right. Within a session, the ids sort as text, not by number. **Cause, confirmed:** source line 114 is
`const na = Number(/(d+)s*$/.exec(a.id)?.[1]);` (and line 115 is the same for `b`). As a diagnostic only, I restored the
backslashes (`/(\d+)\s*$/`): Q253-2b and 2c pass, and `state-render.test.ts` stays 36/36. I then reverted the file with
`git checkout 6c495794 --`. Note that the handoff's claim "Ids compare by number (`G-1000` after `G-999`)" does not hold.
As text, `G-999` sorts above `G-1000`.

On the live record's ids (`G-001` to `G-049`, all three digits) text and numeric order agree. So the reader sees nothing
wrong today. The defect shows only at 1,000 gaps or with unpadded ids. The dispatch asks for numeric order explicitly, and
the code says it implements it, so this row is not met.

## 3. T-209 mutant of my own (id only): KILLED

Mutant: the `opened_session` comparison is deleted from `newestGapFirst`, so only the id decides. Result: `Tests 5 failed |
35 passed (40)`. **Caught by the dev's T209-1** (`[ 'G-1000', 'G-049', 'G-005', …]`) and by my Q253-2a
(`[ 'G-030', 'G-012', 'G-007' ]`) and Q253-2d (`[ 'G-100', 'G-005' ]`). Q253-2b and 2c fail too, from the regex defect.
The candidate was restored afterwards.

The candidate as shipped is itself a mutant that no dev row catches: "text-only tie-break". Only Q253-2b and 2c catch it.

## 4. T-209, the record is untouched: MET

`docs/loops/qa-253/live-start.mts`, run with `npx tsx` from `qa253-cand/open-brain`, calls the candidate's
`handleStart({ project_root: ~/qa-scratch/qa253-live })`. `qa253-live` is a scratch worktree at `6c495794`. `HOME`, the DB,
the score history, the shadow log, the active-session slot and the vault all point into `~/qa-scratch/qa253-home`.

```
record gaps[] order (first 12): G-001@54 G-002@54 G-003@54 G-004@54 G-005@54 G-007@55 G-008@55 G-009@56 G-010@56 G-011@56 G-013@57 G-014@57
rendered gaps section (first 12):
  | Gaps (40):
  |   G-049 — Three seat checkouts share one hub identity: sia-builder, sia-infra and sia-forg
  |   G-044 — A TEST OR COMMAND THAT READS INHERITED process.env CANNOT DISTINGUISH 'THE VARIA
  |   G-043 — `gitnexus clean` exits 0 and deletes nothing unless `--force` is passed, printin
  |   G-042 — THE TEST SUITE EXITED 1 WHILE EVERY LINE OF ITS OUTPUT REPORTED 805 PASSED.… (45
  |   ...
  |   G-034 — build-freshness PASS means 'this build matches this checkout', NOT 'this build i
  |   G-045 — DELETING THE CHECKED-OUT BRANCH DURING A STAGE CRASHES THE RUNTIME WITH NO RECOR
gaps[] ids identical before/after: true
state.json byte-identical before/after: true
```

The render reorders the gaps (G-045 after G-034 because it was opened in an earlier session), and the record's `gaps[]` is
byte-identical after `ob_start`. `git -C qa253-live status --short` was empty afterwards.

## 5. T-210, my own fixtures: MET

Fixture repos under `~/qa-scratch/qa253-fix`. Each commit sets **only** `GIT_COMMITTER_DATE`; the author date is left at
"now". File: `qa253-t210.test.ts`, 9/9 pass on the candidate.

| row | fixture | output |
| --- | --- | --- |
| (a) | `loop-16-brief.md` @09-10, then `t201-brief.md` @09-20 | `Latest brief: docs/loops/t201-brief.md (2026-09-20)` |
| (a2) | `z-brief.md` @08-01, `a-brief.md` @09-01 (path order disagrees with date) | `a-brief.md (2026-09-01)` |
| (a3) | `b-brief.md` @09-25 committed BEFORE `c-brief.md` @09-05 | `b-brief.md (2026-09-25)` |
| (b) | `old-brief.md` @07-01, `mid-brief.md` @09-01, old touched to now | `mid-brief.md (2026-09-01)` |
| (c) | only `loop-1-qa-report.md`, plus `notes-brief.txt` at the repo root | `null`; `handleStart` text has **no** `Latest brief` line (no blank, no "none") |
| (d) | `kept-brief.md` @09-01, `deleted-brief.md` @09-28, then `git rm` @09-29 | `kept-brief.md (2026-09-01)` |
| (e) | `real-brief.md` @09-01, `debrief.md` @09-10, then `briefing-notes.md` @09-20 | `debrief.md (2026-09-10)`, then `briefing-notes.md (2026-09-20)`: **both are taken** |
| (f1) | not a git repo (`GIT_CEILING_DIRECTORIES` set), `docs/loops/x-brief.md` present | `Latest brief: not determined (git: fatal: not a git repository (or any of the parent directories): .git)` |
| (f2) | git missing from PATH | `Latest brief: not determined (git: spawnSync git ENOENT)` |

**(e) Does it matter?** The match is `base.includes("brief") && base.endsWith(".md")`, over `ls-tree -r`, so subdirectories
of `docs/loops` count as well. At the candidate it takes 67 files. Besides `*-brief.md`, that includes `loop-14-rebrief*.md`,
`loop-1x-brief-amendment-N.md`, `loop-15-slice-4-brief-draft.md`, `followups-r165-r167-briefs.md` and
`research-brief-jev-mcp.md`. No `debrief` or `briefing` file exists today. An amendment is arguably the newest brief text.
A draft committed after its final brief, or a future `debrief.md`, would be named in place of the brief. This is a
**non-blocking gap**, and it is the planner's call whether to narrow the match (for example `-brief(-amendment-\d+)?\.md$`).
(f) never claims there is no brief. When `docs/loops` is absent, the function returns `null` before it calls git, which is
correct because there is nothing to name.

## 6. T-210 mutants of my own: BOTH KILLED

Applied to `latest-brief.ts` in `qa253-cand` and restored with `git checkout 6c495794 --` after each. Run with
`latest-brief.test.ts` + `qa253-t210.test.ts` (19 tests).

- **(a) sort by path** (`best` is the greatest path, and the date is ignored): **6 failed | 13 passed**. Caught by the dev's
  **T210-3** and **T210-4**, and by my **5a2**, **5a3**, **5b** and **5e**. The dev's T210-1 and T210-1b, and my 5a, survive
  it, because `loop-9` > `loop-10` and `t201` > `loop-16` as text too. The handoff says the same about T210-1.
- **(b) mtime instead of commit date** (each candidate's date is replaced with `statSync(...).mtime`): **12 failed | 7
  passed**. The rows that fail on **which file is picked**: the dev's **T210-1** (picks `loop-10`) and **T210-3** (picks
  `old-brief`), and my **5a3** (picks `c-brief`) and **5b** (picks `old-brief`). The rest, including T210-7, fail only on
  the printed date (the mtime is today's date).

## 7. The live line: MET

`live-start.mts` (row 4) quotes the line from the candidate's `handleStart` on the scratch worktree at `6c495794`:

```
Latest brief: docs/loops/jev-calibration-1-brief.md (2026-10-02)
```

Note: `open-brain start` (the CLI subcommand, `src/cli.ts:184`) calls `sessionStart` and **not** `handleStart`, so it prints
neither the State section nor this line. The line exists only in the `ob_start` MCP handler, so I called the handler
directly. Checked with `git log -1 --format=%cI -- <path>` over every brief at HEAD (`brief-dates.mjs`; 67 briefs, status
clean):

```
2026-10-02T00:27:50-05:00  docs/loops/jev-calibration-1-brief.md
2026-09-30T19:57:39-05:00  docs/loops/loop-15-slice-4-brief.md
2026-09-30T09:16:59-05:00  docs/loops/loop-15-slice-4-brief-draft.md
2026-09-30T02:40:15-05:00  docs/loops/t201-brief.md
2026-09-27T23:51:47-05:00  docs/loops/loop-15-slice-3-c-brief.md
...
```

The named file is the newest by commit date. The printed date is the first 10 characters of `%cI` in the committer's own
time zone, not UTC.

## 8. Nothing else moved: PARTIAL

- `state-render`, `latest-brief`, `record-session-number`, `standing-cron`, `session-log` and `sync/start-parity`:
  **Test Files 6 passed (6), Tests 74 passed (74)** on the candidate.
- `npx tsc --noEmit` on the candidate: **exit 0**, no output.
- **However**, `tests/server.test.ts`, a direct test of `handleStart` that the dispatch's neighbour list does not include,
  **fails** on the candidate: `server handlers > handleStart > renders the State section from a valid state.json and
  withholds the prose files`, `AssertionError: expected '…' to contain 'Gaps (5):\n  G-001 — Cursor start.md …'`. The
  render now starts with `G-005 — vault-index-parity …`, and all five gaps were opened in session 54, so the order falls
  back to the id. The same test **passes on the base** (`1 passed | 29 skipped`). This is the CI failure in row 9. The fix
  is to update the assertion to newest-first. That assertion would also fail if the id order were not descending.

## 9. CI on the head (read only): FAILURE

- `gh run list --commit 6c495794…`: **no runs**. The code commit was pushed together with the handoff commit, so CI ran
  only on the tip.
- `gh run list --commit 5ceb6eef…` (same code plus the handoff):

| run | event | branch | conclusion | jobs |
| --- | --- | --- | --- | --- |
| 36979243129 | push | loop/t209-t210-render | **failure** | changed=success, test-windows=skipped, **test=failure** |
| 36979246332 | pull_request | loop/t209-t210-render | **failure** | changed=success, test-windows=skipped, **test=failure** |

The push run's failed log shows `Test Files 1 failed | 151 passed (152)`, and the one failure is the `server.test.ts` row
above. The base `79d1f5d9` has push run 36978283502 with conclusion **success**.

## Gaps and notes

- **T-209 fix needed (blocking):** (1) restore `\d` and `\s` in the two regexes in `newestGapFirst`, and add a tie row the
  text order gets wrong (G-100 vs G-99, or G-10/G-9/G-2). (2) Update `tests/server.test.ts:199` to the newest-first order.
  The developer's final run did not include `server.test.ts`, so CI was the first to see it.
- T-210 (e): the `*brief*` match also takes drafts, amendments, `rebrief`, plural `briefs` and subdirectories, and it would
  take `debrief.md` and `briefing-notes.md`. Not blocking.
- T-210: the dev's T210-1 and T210-1b do not catch the path mutant on their own; T210-3 and T210-4 do. The handoff says so.
- The handoff's follow-up stands: `.claude/commands/start.md` still says "largest loop number".

QA-253: REPORT COMPLETE
