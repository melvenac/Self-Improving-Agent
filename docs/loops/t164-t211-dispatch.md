# T-164 + T-211: the record session number, and standing crons in seat data (dispatch)

**By:** Atlas (planner), record session 156, 2026-10-02. **Priority: Aaron, relayed by clark, in his words:** "ask
Atlas to prioritise T-211 and T-164 next i agree". **Job class: LIGHT** (open-brain/src plus its tests, and one
command doc; CI runs the suite). **Two PRs, in order:** T-164 first, then T-211 on a branch stacked on T-164's.
Both touch the `ob_start` output.

## Part 1: T-164, port the existing candidate. Do not rewrite it.

- A candidate already exists: `origin/loop/t164-record-session-number` at `567657af`, record 221, 2026-09-28. Its
  mutant branch is `origin/loop/t164-record-session-number-mut-sc4` (`956755d6`). It was **never QA'd or merged** and is
  about 280 commits behind master.
- Its brief, with rows SC-1 to SC-5, is `docs/loops/t158-t164-dispatch.md` § Record 221. **Those rows are the
  acceptance rows here.**
- **Do this:** branch `loop/t164-port` from `origin/master`, cherry-pick or re-apply `38417eb3` and `567657af`, and
  resolve the conflicts against current master. The session-start pipeline, `server.ts` and `state-writer.ts` have
  all moved since. In the handoff, list every conflict and how you resolved it.
- **Show these:**
  - SC-1 to SC-5 green on master plus the port.
  - The SC-4 mutant reproduced and red: restore the local count, and SC-1 fails.
  - **The live case:** `ob_start` in a checkout whose local logs say 17, while the record's last session is 155,
    greets **156**. Use a fixture copy, not a live checkout.
- If the port shows that the old design no longer fits the current code, **stop and report**. Do not redesign.

## Part 2: T-211, the standing status cron lives in seat data and is printed at start

**The problem** (task note): the status-cron minutes and the reporting rule exist only in handoff text. The
session-153 roll dropped them, and the session-156 start ran without a cron until clark audited it. A cadence held in
prose is lost at the first roll that does not copy it.

**Build:**

1. **Seat data:** optional frontmatter in `.agents/AGENT.local.md`, falling back to `.agents/AGENT.md`:
   - `status_cron` (a 5-field cron, local time)
   - `status_to` (the agent name to report to)
   - `status_rule` (a repo-relative path to the rule text, for example a section of `.agents/roles/planner.md`)
2. **`ob_start` prints it in the seat block,** deterministically, using the line shapes below. Put it in whichever
   module builds the `Seat:` line (`server.ts:293` or the role-files module), and say which in the handoff.
   - Present: `Standing cron: <cron> → status to <status_to> (rule: <status_rule>). Create it with CronCreate before the briefing ends.`
   - Absent: `Standing cron: none in seat data.`
   - Malformed (not 5 fields, or a field out of range): `Standing cron: INVALID in <file>: <why>`. Never drop it
     silently.
3. **`.claude/commands/start.md`:** in Part A, add a step that creates the cron from that line when it is present.
   Also add the line to the briefing template's FLAGS whenever it is `INVALID`.
4. **`project-template/`:** if it carries an `AGENT.md` template, document the three optional keys there.

**Rows:**

| Row | Observable |
| --- | --- |
| **SR-1** | With the three keys in `AGENT.local.md`, `ob_start` prints the present-shape line with those values, verbatim. |
| **SR-2** | With `AGENT.local.md` lacking the keys and `AGENT.md` having them, the `AGENT.md` values are printed. A local file that HAS the keys overrides the tracked file. |
| **SR-3** | With neither file carrying them, it prints `none in seat data`. |
| **SR-4** | `status_cron: "4 * *"` and `status_cron: "61 * * * *"` each print `INVALID` with the reason. |
| **SR-5** | Mutants: dropping the line, or reading only `AGENT.md`, goes red on SR-1 or SR-2. |
| **SR-6** | **Preserved:** every other greeting line is unchanged (the SC-5 style), and T-164's numbering is untouched. |

**Not in scope:** the planner's own `AGENT.local.md` is untracked and local. The planner writes its keys after the
merge. Do not edit any seat's local file.

## Rules

- Branches: `loop/t164-port` from `origin/master`, then `loop/t211-standing-cron` from `loop/t164-port`. Push, never
  forced. Run only the touched test files locally; CI runs the suite.
- Open both PRs to master: T-211's PR body says "stacked on T-164's PR". **Do not merge either one.**
- **T-221 is open:** each PR's push run can be cancelled by its PR run. If a PR is BLOCKED by a cancelled `test`,
  report it, and the planner re-runs it. No empty commits.
- The repo is PUBLIC: no issues, no comments, and no PRs other than these two.
- Handoffs: `docs/loops/t164-port-developer-handoff.md` and `docs/loops/t211-developer-handoff.md`, each with its
  red and green test output and the files it touched.
- Report the SHAs and PR numbers to `atlas-sia`, or to `clark` if atlas-sia is unreachable.
