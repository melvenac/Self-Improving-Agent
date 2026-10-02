# T-209, T-210 and T-183 (measured only): developer handoff

**By:** Forge (builder, sia-builder), 2026-10-02. **Dispatch:** Atlas, record session 157, `docs/loops/session-157-dev-dispatches.md`.
**Branch:** `loop/t209-t210-render` from `origin/master` `79d1f5d9`. **Code commit (freeze for QA): `6c495794145097d47f009963c2c93dadfb1a319b`.**
This handoff is a later docs-only commit. Not merged. One PR, no issues, no comments. LIGHT job: only the touched tests, plus `tsc --noEmit`.

## What changed (4 files + 2 tests)

| file | change |
|---|---|
| `open-brain/src/pipelines/session-start/state-render.ts` | `newestGapFirst` and `.sort(newestGapFirst)` on the open-gap list (a copy; `state.gaps` is not reordered) |
| `open-brain/src/pipelines/session-start/latest-brief.ts` (new) | `describeLatestBrief(projectRoot)` |
| `open-brain/src/server.ts` | `handleStart` prints the brief line after the drift line |
| `open-brain/tests/pipelines/session-start/state-render.test.ts` | T-209 rows |
| `open-brain/tests/pipelines/session-start/latest-brief.test.ts` (new) | T-210 rows, 10 tests |

Files owned by sia-forge (`tree-currency.ts`, `cli-bootstrap.ts`, `handoff-guard.ts`) were not touched. No role-file loading was touched.
GitNexus has no index in this tree (`gitnexus-index` skips), so `impact` could not run. Callers by grep: `renderState` is called by `server.ts`
(`handleStart`) and `pipelines/sync/checks.ts` (`greeting-size`); only the order of the Gaps lines changes, not their text or count.

## T-209: gaps newest-first

Order: opened session descending, then id descending. Ids compare by number (`G-1000` after `G-999`), then as text.

- **Red before** (`state-render.test.ts`, fixture G-001/54, G-005/54, G-002/60, G-003/60, G-049/150, G-1000/60):
  `T209-1` fails, 1 failed | 35 passed (36). The old order printed `G-001 G-005 G-002 G-003 G-049 G-1000` (append order).
- **Green after:** `["G-049","G-1000","G-003","G-002","G-005","G-001"]`; 36 passed (36).
- **Mutant, id order kept** (`.sort((a, b) => a.id.localeCompare(b.id))`): `T209-1` goes red, 1 failed | 35 passed. Reverted.
- Also pinned: the record's own array is not mutated (`T209-2`); the count line and the closed-gap filter are unchanged (`T209-3`).
  The existing T-183 clip tests look gaps up by id and pass unchanged.

## T-210: `Latest brief: <path> (<commit date>)`

A brief is a file under `docs/loops/` whose name contains `brief` and ends `.md`, present at HEAD. The date is the file's latest commit (`git log`),
shown as `YYYY-MM-DD`. Ties break by path, higher first.

| row | test | result |
|---|---|---|
| higher loop number is older, newer date wins | `T210-1` | green |
| a task-named brief (`t201-brief.md`) counts; a `qa-report` does not | `T210-1b` | green |
| no brief: `null`, so the line is omitted | `T210-2`, `T210-2b`, `T210-2c` | green |
| mtime does not decide: an old brief touched to 2027 and edited, uncommitted, does not win | `T210-3` | green |
| a re-committed brief takes its latest date | `T210-4` | green |
| a brief deleted at HEAD is not offered | `T210-5` | green |
| not a git repository, but `docs/loops` exists: the line says `not determined (git: ...)`, not "no brief" | `T210-6` | green |
| `handleStart` prints the line after `Drift`, once; omitted with no brief | `T210-7` | green |

- **Red before:** the test file fails to load, `Cannot find module '.../latest-brief.js'` (the module did not exist).
- **Mutants** (each reverted): (M1) pick the greatest path instead of the newest date: `T210-3` and `T210-4` go red (2 failed). Note
  `loop-9` sorts above `loop-10` as text, so `T210-1` alone does not catch M1. (M2) use file mtime for the date: 5 tests go red
  (`T210-1`, `T210-1b`, `T210-3`, `T210-4`, `T210-5`).
- **Final run:** `state-render` (36), `latest-brief` (10), `standing-cron`, `record-session-number`: 4 files, 61 tests passed. `tsc --noEmit` exit 0.
  `sync --check` from source: 31 passed, 0 fixed, 2 warnings, 4 issues, 1 skipped; the four issues are the same ones as on `master`
  (`build-freshness`, `worktree-layout`, `greeting-size`, `cursor-hook-compat`), none from these files.

**Not done, and why:** `.claude/commands/start.md` still tells the reader to find the brief by "largest loop number". Editing it needs the
same lines in `project-template/` and the Cursor copy (or a `claude_only` entry), and the dispatch did not ask for it. **Follow-up for the planner:**
change the briefing template's `Latest brief:` to "ob_start's `Latest brief:` line, verbatim".
`greeting-size` in `sync` does not count the new line (about 55 characters); it composes the greeting from parts.

## T-183: ob_start measured, nothing cut

Measured by calling `handleStart({ project_root })` on this repo (a Claude Code developer seat, `sia-builder`) at `79d1f5d9` plus the two changes above
(which add one 55-character line and reorder, but do not resize, the gap lines). State rev 278, 102 tasks (80 active).
**Total: 51,520 characters, 559 lines, about 12,880 tokens.** The `sync` `greeting-size` limit is 40,000 and it reports 50,473 for this seat.

| section | chars | share |
|---|---|---|
| header (tree currency, project, drift, brief, session, seat, cron, presence) | 919 | 1.8% |
| `## Sizes` block | 500 | 1.0% |
| State preamble (project, objective) | 685 | 1.3% |
| **State: Tasks (80 active)** | **12,066** | **23.4%** |
| State: Verified (10 shown) | 1,819 | 3.5% |
| **State: Gaps (40 open)** | **7,126** | **13.8%** |
| State: Decisions line | 182 | 0.4% |
| State: your handoff | 3,592 | 7.0% |
| State: other handoffs | 1,052 | 2.0% |
| State: last session | 108 | 0.2% |
| **Role files** | **23,471** | **45.6%** |
| of which `shared.md` | 17,670 | 34.3% |
| of which `developer.md` | 5,801 | 11.3% |

Tasks by priority: P0 24 tasks, 3,533 chars; P1 37, 5,531; P2 16, 2,516; P3 3, 432.

**What still dominates:** the role files (45.6%), and within them `shared.md` alone (34.3%), then the task list (23.4%), then gaps (13.8%).
Gaps and verified are already clipped; gaps are still 40 lines because the clip is per line, not per count.

**Proposed cuts, each with its saving (characters out of 51,520; the planner rules, none is built):**

1. **Gaps: show the newest N, count the rest.** T-209 now puts the newest first, which makes a top-N meaningful. Newest 10 plus one "30 older not shown, all: `state show --json`" line saves **5,103** (9.9%); newest 5 saves 6,055; newest 15 saves 4,130.
2. **Tasks: clip each line.** Clip at 100 characters saves **4,828** (9.4%); at 80, 5,934. Or list P0 and P1 and show P2 and P3 as a count line: saves **2,888** (5.6%) for P2+P3 only, 8,389 (16.3%) for P1+P2+P3.
3. **Role files** (needs a ruling; I changed nothing): `shared.md` is 17,643 bytes in seven sections: Measurement 3,159, Instruments 4,420, The record 1,513, Authority 3,477, Aaron's standing rulings 720, Git in this repo 3,888, preamble 412.
   Printing `shared.md` as a pointer plus its section headings would save about **17,000** (33%); printing only the Authority and Aaron's standing rulings sections (4,197) saves about **13,400** (26%).

Cuts 1 and 2 (newest 10 gaps, task lines clipped at 100) together save about 9,900 and bring the greeting to about 41,600; adding cut 3 in either form puts it under 40,000.
Cut 1 alone does not.

## Report

Reported to atlas-sia. Nothing was merged. The code SHA to freeze for QA is `6c495794`.
