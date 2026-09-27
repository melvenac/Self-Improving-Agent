# Loop 15 slice three: dispatch of candidate A9 to a FRESH, HEADLESS QA seat (record session 104)

**By:** Atlas (planner), record session 100 · 2026-09-25 (UTC). **Where QA 104 runs:** the QA PC `desktop-o4egb1e`
(D-045), in `C:\Users\Aaron Melven\Worktrees\sia-qa`, launched headless by `docs/loops/qa-104/drive.ps1`. **Nobody is
watching live and you cannot reach the planner.** Questions go in **"Open for the planner"**. Carry on with whatever
does not depend on the answer.
**Not available here, by ruling:** `/start`, the open-brain MCP server, the SessionStart hook, `gitnexus`.
**This PC has no git identity.** Pass it per command (`git -c user.name="Aaron Melven" -c user.email=melvenac@gmail.com
commit …`), as QA 102 did. Do not write any git config.

## The candidate

- **A9 is `6bd97f2a573394ce84f986531975f3d509d484c5`** on `origin/loop/15-slice-3-candidate-a9`. It is not for merge.
- It sits on A8 `9e2dd5d`. **This table is built from each commit's full `git diff --name-only`, read by the planner:**

  | Commit | Files | Carries |
  |---|---|---|
  | `5cf0b8b` | **merge** of master `9bc06e3` into `9e2dd5d`: master's docs, state, `ci.yml`, `paths.ts` (PR #156) and the rest | R76. **Its tree equals `git merge-tree 9e2dd5d 9bc06e3` exactly** (`fd23017…`), and `git diff 9e2dd5d 5cf0b8b -- open-brain/src/harness` is empty. The planner checked both. |
  | `0504910` | `configwatch-a7-seam.test.ts`, `configwatch-links.test.ts` | the tests only (the redcheck base) |
  | `cb2b605` | `configwatch.ts`, `runtime.ts` | **R72, R73 and R74 in one commit** (ruled acceptable). The handoff's **hunk map** assigns each hunk to its ruling. |
  | `0423d97` | `configwatch.ts` | keeps the resolved path in an unread record, so R60's stow-link test stays green |
  | `1c1d91c`, `6bd97f2` | the handoff only | — |

- **Built by:** Grok 4.7 in Cursor, developer record 103. **Handoff:** `docs/loops/loop-15-slice-3-a9-developer-handoff.md`
  at `6bd97f2`.

## Evidence the developer left (Linux CI, **tcm** runners)

Re-read per test yourself. The runs: redcheck `36095548004` (`0504910`); code `36095775536` (`0423d97`): 1 failed,
1168 passed, 5 skipped; and the second-wave mutant runs named in the handoff. A handoff-only run `36096803947` exists.
**CA-9 is red in every tcm run, including the redcheck, which has no product change.** tcm's installed `claude` lacks
`--permission-prompts`, which the adapter passes (`roles.ts:310`, `:350`). The QA PC's Claude Code 2.1.282 has it. The
planner ruled CA-9 outside A9 and records it as its own task. **Score CA-9 as attributed to the runner, as long as the
redcheck shows the same failure.** If you can run CA-9 against a claude that has the flag, do, and say where.

## Score against

- The criteria **FINAL at `6672e83`**, read with **rulings-9 to rulings-16**. Rulings-16 is on
  `origin/docs/session-100-qa99-dispatch`, and its "every defect and question, assigned" table says how each touched row
  is scored. D-042 and D-046 are in force.
- **Your predecessor's report:** QA 99's, on `origin/qa/loop-15-slice-3-a8-report` (`95727ef`). Read the verdict, §9, §11,
  §14 and §15.
- **Known positives:**
  - A8 `9e2dd5d` for A8-1 (R68-STABLE-UNREAD, R68-NOT-A-FILE, R68-UNREADABLE-STABLE, R70-HANDLE-FACTS);
  - A8-2 (WRITEONLY-LATER, R68-UNREADABLE-LATER; Linux);
  - A8-3 (R71-BASE-LABEL, R68-TWO-NAME-LATER-FACTS).
  QA 99's probe files are in `docs/loops/qa-scripts-a8/` on its report branch. **QA 99's §14 names M-R71-unreadable as a
  known NEGATIVE for A8-2's shape;** use it.
- **HANDLE-NLINK-BASE's old assertion is obsolete by rulings-16 (Q3).** R74 fixes its text, so score the text.

## Procedure

1. **Every row is re-run.**
   - Win32 locally: this PC is dedicated and quiet, and it can make symlinks and junctions.
   - POSIX rows on CI. **Probe branches built on `6bd97f2` carry master's `ci.yml` and run on tcm, which is free.**
     Confirm the runner. At most **10** runs; tcm has two runners and other seats share them.
2. **R72, both sides:**
   - an unreadable machine path written in place is reported (Linux);
   - an unreadable REPOSITORY file written in place is reported too (the handoff says what it tested);
   - a change is never decided from text equality. Check `runtime.ts` for any remaining string comparison of `before`
     and `after`.
3. **R73:** facts on every record, including stable ones, and the lstat-failure text.
4. **R74:** labels (`loop base`, `stage start`, `current`), `type` on every side, and the gained-a-name text.
5. **R75:** each named protection has its own candidate test, and a mutant that turns it red. The size mutant's wider kill
   set is ruled acceptable. Verify the reason the handoff gives.
6. **Regressions:**
   - everything QA 99 found closed stays closed: A7-1's trigger, R69's edges and guards, R70, D-042's trade, A4-1 H/J/LOOP;
   - QA 92's 31 win32 loop probes stay identical apart from the new facts.
7. **The merge:** confirm, independently, that `5cf0b8b` changes nothing of A8's code.
8. **The full suite once, at `6bd97f2`,** captured unpiped. Record the processes before and after. The 8.3-path test
   should pass here, because R76 brought PR #156.
9. **Plain `sync` in a scratch clone.** `/sync --check` after `gitnexus analyze` is unrun (no `gitnexus`).

## Authority

- **Push only `qa/loop-15-slice-3-a9-*`, through `node docs/loops/qa-104/push-qa.mjs <branch>`.** `git push` is
  denied to you.
- The driver audits remote heads and tags. Other seats' pushes will be flagged too, and the planner attributes them.
- Never: master, merges, PRs, tags, releases, other seats' branches, or this PC's Claude or git configuration.
- **A refusal or a denied command:** stop that line of work, record it verbatim, and continue with the rest.

## The report

- **Path:** `docs/loops/loop-15-slice-3-qa-report-a9.md`, in report A8's structure.
- **Model and effort** from your process command line and transcript. The driver passes
  `--model claude-opus-5-5 --effort high`.
- Commit the report and scripts (`docs/loops/qa-scripts-a9/`, with a README) to `qa/loop-15-slice-3-a9-report`, and push
  it with `push-qa.mjs`.
- **The LAST line is exactly `QA-104: REPORT COMPLETE`.** Write it only when every item is done or written up as blocked.
- No `/end` (T-163).
