# JEV-CAL-2 round 2: the case collector

**By:** Scout (Claude Code, builder task from atlas s162), 2026-10-06. **Branch:** `loop/jev-cal-2-collector`, cut from builder's
`loop/jev-cal-2` @ `c137ef28`. **Read:** `docs/loops/jev-calibration-2-brief.md`.
**Numbers below come from `pool.json` / `collect.json`, generated with `node collect.mjs` against origin/master
`ef2b71a5`. They move as QA reports are pushed; regenerate rather than copy them.**

## Why the pool was 14

The old collector looked for `origin/qa/<slug>-report` from the DISPATCH FILE NAME. A report branch is named by the PREFIX the QA
prompt states, which often differs (QA 258: dispatch `qa-258-b4-dispatch.md`, report `qa/b4-misc-report`; QA 280: `s162a`). It also
made one case per report, capped at QA 320, from QA 253.

## What changed

1. **`resolve.mjs`** finds each run's report from its own text: the headless prompt's "your prefix is `X`" line, else the dispatch's
   "Commit `docs/loops/X-qa-report.md` ... on `qa/X-report`" line (the prompt wins when they disagree, and the run notes it); then the
   branch must exist on origin and the report file on it. A run that cannot be resolved is listed with the reason.
2. **`verdicts.mjs`** reads the report's verdict table (columns by header: PR, head, verdict) or, when it has none, its verdict lines.
   One case PER PR verdict. A pair or batch-merge row is not a case. A head is taken from the row, else from a heading or table row the
   item leads, else from a single "**Candidate:**" field; otherwise the case is listed unresolved, never filled in. Rows that share one
   head are ONE case (REJECT when any row is a REJECT): QA 253's T-209 and T-210 are one commit.
3. **`collect.mjs`** runs QA 250 up to the highest QA number with a prompt on master (no cap), records the plan source of each case,
   tags `cal1-seen` (calibration 1's 67 scored cases, by candidate commit), tags rejected-then-fixed pairs, and counts the held-out candidates.

## Counts (88 cases from 29 of 31 QA runs, QA 250 to 281)

| | |
|---|---|
| by verdict | ACCEPT 62, REJECT 24, unlabelled 2 (INCOMPLETE or mixed verdict text) |
| by provenance | seat-built 88, runtime-built 0 (see limits) |
| plan | plan 88 (task-brief 7, QA dispatch section 14, QA dispatch whole 67), no-plan 0 |
| leak group | 17 (ACCEPT 13, REJECT 4); headline pool 71 |
| cal1-seen | 1 |
| pairs | 21 (rejected, later fixed) over 15 PRs; 36 cases carry a pair tag |
| unresolved | 6, listed below |
| **held-out candidates** | **68** (ACCEPT 48, REJECT 20): labelled ACCEPT or REJECT, not in the leak group, not cal1-seen. The held-out set needs at least 30 with 12 of each verdict. |

## Unresolved (6)

- QA 252 (run): report resolved but it has no PR verdict rows (no verdict table and no ACCEPT/REJECT verdict lines naming a PR or task)
- QA 271 (run): report resolved but it has no PR verdict rows (no verdict table and no ACCEPT/REJECT verdict lines naming a PR or task)
- QA 274 #425 (case): same head 9fcb97ca as qa273-pr425 (QA 273, ACCEPT); the earlier verdict stands
- QA 274 #427 (case): same head 270b550b as qa273-pr427 (QA 273, REJECT); the earlier verdict stands. LATER RUN DISAGREES: ACCEPT
- QA 276 #427 (case): same head 987901c9 as qa275-pr427-r2 (QA 275, REJECT); the earlier verdict stands
- QA 278 #427 (case): same head a6d75b52 as qa277-pr427-r3 (QA 277, ACCEPT); the earlier verdict stands

## Limits, stated

- **Plans are mostly the QA dispatch as a whole.** 67 of 88 cases take the dispatch of their run, shared by every PR in it
  (`plan_shared_with_cases` says how many), because most dispatch titles list every PR and their rows are not split per PR. Only
  14 have a section of their own. A QA dispatch is written after the build and before QA, so it is a plan written
  before the QA verdict and not before the work; 7 cases have the task's own brief (a brief whose file name starts with the task number, when exactly one does).
- **The leak group is computed on that plan text**, so a shared dispatch that quotes verdict wording puts every PR of its run in the leak group.
- **Provenance is read from the report's text** ("runtime-built"); no report says it, so every case is seat-built. It is not the builder's identity.
- **Pairs** group by PR number. A task-level row (a report that names no PR) joins a PR only when its task id belongs to exactly one PR
  across the pool, or a heading the PR leads names that task. Several REJECTs of one PR each pair with the first later ACCEPT.
- **Same head in two runs** (a narrow re-run): the earliest verdict stands, the later run is listed, and a disagreement is flagged
  (QA 274's #427 ACCEPT on rows 1, 4 and 20 against QA 273's REJECT of the same head).
- **No live Jev call, and no API key is read or printed by any file here.**
