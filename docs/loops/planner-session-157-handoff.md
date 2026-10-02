# Planner session 157 handoff: batch-QA groupings and open state at the STOP roll

**By:** Atlas (planner), 2026-10-02, about 09:45Z. Master is `41864860`. The record is at rev 281, and this commit
moves it to rev 282.

These are drafts, and the next planner verifies them first:

- Every head named below came from a seat's report. CI was green where marked, and **QA has not run on any of them.**
- **Re-read each PR's head before building a batch dispatch.** Seats may push again after a roll.

## Batch QA (Aaron's rule from 11:50Z: 4-6 related PRs per QA run, and one AskUserQuestion per accepted batch)

### B1: session-start render

- **#287** T-209/T-210 round 2, `0085e78a`. This is the QA 253 reject fix. CI is green.
- **#291** T-183 cut, `f76392d2`, stacked on #287. CI is green.
- **#297** T-226, the start.md brief line: code `ba22373c`, head `fc71d969`, stacked on #287. CI is green.
- **#312** T-148, the retire legend, `9a42f7db`. It also edits the three start.md files, in hunks other than #297's.
- **#292** T-224, the placeholder reason, `4c2129d3`. **It needs a round 2 before QA.** `PLACEHOLDER` lost a backslash:
  `/<[^<>s]+>/` should be `/<[^<>\s]+>/`, and it needs a row for a placeholder containing "s". sia-builder found this.
  QA either the fixed head, or B1 without #292.

### B2: sync checks (sia-forge, all in `sync/checks.ts` or `index.ts`)

| PR | Task | Commit | Notes |
| --- | --- | --- | --- |
| #295 | T-008, MCP command paths | `cc285738` | |
| #298 | T-008b, `.mcp.json` and plugin sources | `7b09c5b7` | Base is #295 |
| #300 | T-051, skills contract | `5ae7f9f2` | |
| #303 | T-176, index divergence | `112a4139` | |
| #306 | T-048, sync drop counts | `d8dc12db` | |
| #309 | Hook-configs nested | `bd3cd6aa` | Base is #306. An `sh -c` row was asked for; check whether it was pushed |

Merge order inside B2: #295 before #298, and #306 before #309. #309 and #295 conflict on the `node:path` import line.

### B3: maturity, records and tests

- **#294** T-215, the maturity cut, `c1fc5ecc`.
- **#301** T-163, regression test only, `11c183e4`.
- **#305** T-152, tests typecheck A+C, `84e75618`. Four category-B errors remain until #294 merges.
- **#308** T-186, BOM in `applySummaryRegion`, `65eb9e94`. **Impact is HIGH:** every `ob_state` write passes through it.
- **#293** T-223, the PR group pin, `c2d52d8a`. **Re-check it against #310's new `ci.yml`**, because T-227 changed the
  group expressions, so it probably needs a rebase and a re-pin.

### B4: session-end and misc

- **#299** T-050, foreign-writer detector, `ddea392b`.
- **#302** T-048, dropped counts, `b47eb897`. Both #299 and #302 touch session-end files, so expect a trivial rebase.
- **#313** T-065, drop `knowledgeDb`, `3b3b6c2a`.
- **#314** T-042, vault pollution, `41c87b16`.

### Not batched

- **#289 / #290** T-208 and T-212: **QA 254 REJECTED them.** The report is `origin/qa/t208-t212-report` `6a908ebf`. It
  is **not yet read by the planner**, so read it, rule, and dispatch round 2 to sia-forge.
- **#287** is B1's base. If B1 is rejected again, #291 and #297 rebase again.

## Other open items

- **T-227 (#310)** is merged as `02b505c2`. CI now runs on GitHub-hosted `ubuntu-latest`.
  - `push` runs only for master. A `qa/` or `loop/` branch with no PR gets no CI unless someone runs
    `gh workflow run CI --ref <branch>`. **Every QA dispatch that wants its own CI run must say so.**
  - The tcm self-hosted run is opt-in and was proven by run 36985450437.
  - **T-227 is not yet a task in the record. Open it and close it against #310.**
- **sia-forge parked items:** T-188 (WIP commit on `loop/t188-ci-status-hint`, unpushed) and T-184 (not started).
  The backlog gate says no new code PRs until fewer than 6 await QA.
- **Rulings open:** none pending for Aaron.
- **D-100 follow-ups:** T-225 (calibration-2 prerequisites) and G-050 (per-file retirement allowance) are open.
