# T-179 + T-163 (/end cut to a lessons step; a close-out cannot erase another session's record): dispatch to a FRESH, HEADLESS QA seat (record session 125)

**By:** Atlas (planner), record session 109 · 2026-09-26 (UTC). **Where QA 125 runs:** the QA PC `desktop-o4egb1e`,
launched headless by `docs/loops/qa-125/drive.ps1`. **Nobody is watching live, and you cannot reach the planner.**
Questions go in "Open for the planner".
**Not available here:** `/start`, the open-brain MCP server, the SessionStart hook, `gitnexus`.
**Temp and scratch (T-190):** `TEMP`=`TMP`=`C:\qa-tmp`, and scratch goes under `C:\qa-scratch`. The one full-suite run
uses the default temp (the Defender-on control).
**No git identity here:** pass it per command. **QA seats run ONE AT A TIME.** If `%USERPROFILE%\sia-qa123` has no
`done` marker, or another driver's `claude` is running, stop and say so.
**Commit your report from a separate worktree under `C:\qa-scratch`,** so the shared tree's HEAD never moves.

## Why this one matters more than most

**Merging this candidate MIGRATES THE LIVE RECORD** (`.agents/state.json`) to schema v3, and changes what every seat's
`ob_state` write may do. A defect here reaches every seat, and the record itself. **Never write this repository's live
`.agents/state.json`, in any step.** Work on copies under `C:\qa-scratch`.

## The candidate

- **`3c0bfdc`** on `origin/loop/t179-merge`, which is the tree that will merge. The handoff is at the tip, `f618b73`,
  and the diff after `3c0bfdc` is `docs/loops/` only.
- It is T-179's frozen `66b2173` (Forge 118, handoff `828a9d3`), plus a merge of master `aae0dce` (merge commit
  `d07920b`, Forge 124), plus the importer's v3 rule and its test. `3c0bfdc` merges cleanly into today's master (the
  planner checked `git merge-tree`).
- **CI:** tcm 36224382093 at `3c0bfdc`, success, 1285 passed and 2 skipped. **Redchecks:** `loop/t179-redcheck`
  (`4a6119b`), and the v3-import test, red first against `aae0dce`.

## Score against

- **`docs/loops/t179-t163-end-brief.md`** (T163-1, T163-2, T179-1, T179-2) and **`t179-merge-round-brief.md`**.
- **The planner's rulings,** given to the developer by message (as their handoffs quote them):
  - checkout retention;
  - the greeting renders only the newest handoff per (seat, checkout);
  - the migration keeps every uuid;
  - **Addition 1 as re-ruled:** the greeting may grow by a FIXED label cost (measured at +86 to +87 characters per
    seat), but **must not grow with the number of sessions.** Test that directly. Build a record with 1, 10 and 50
    sessions per seat, all within retention, and show the greeting is the same size at each, apart from the one count
    label.
  - the importer's v3 rule (an import writes legacy entries, stamped by no session), accepted.

## Check, not accept

1. **Nobody can erase another session's record.** Try it as an attacker would:
   - `set_handoff` with another uuid in the op (the brief says it is not an argument, so confirm that it is not);
   - two sessions of the same seat in the same checkout;
   - a session with no registered id;
   - `delete` or `update` ops against another uuid's entry;
   - a retention drop that is not the newest per (seat, checkout);
   - `update_task` replacing another session's note. **This is T-171, and it is known and NOT fixed.** Confirm it is
     the only remaining path, and say so.
2. **The migration, v2 → v3, on a COPY of this repository's live record** (rev 132 at `origin/docs/session-100-qa99-dispatch`,
   and master's rev 131). Count every uuid before and after, with two instruments. Run the migration twice: it must
   be idempotent. Then run an `ob_state` write on the migrated copy.
3. **T163-2, the history scan:** run `state erasures` on this repository's full history (a full clone, not shallow).
   Rev 60→61 and 61→62 must be flagged, as the known positives. Report the total, and spot-check three flagged entries
   by reading the two revisions yourself.
4. **T179-1:** the new `end.md` (59 lines) writes no project state. Run it as written in a scratch project, and show
   `state.json` is byte-identical before and after. Its lessons step stores through `ob_store`/`ob_store_chunk` and
   `ob_end`. What would a stranger's project need for that to work?
5. **T179-2:** a session that commits on `loop/*` with no handoff gets the SessionEnd warning, and never a block. Also
   test that a session WITH a handoff gets none, and that the next greeting shows the warning exactly once.
6. **The importer on v3:** QA 122's `probes-r4.mjs` and QA 111's `probes-r3.mjs` byte-exact on `3c0bfdc`. Every FAIL
   either names a ruling that changed it or is a defect.
7. **The after-merge steps (handoff §7):** rebuild, reconnect, migrate the live record, and install the new `end.md`.
   Walk them in a scratch clone as a stranger would, and say what is missing or out of order.
8. **Mutants of your own:** at least retention's (seat, checkout) key widened to seat only; the uuid check skipped for
   delete; and the erasure scan blind to one revision.

## CI and authority

- CI on **tcm**, at most **8** runs. Hosted minutes are exhausted until 2026-10-01. **The laptop is candidate B's**
  today: do not dispatch Windows jobs.
- **Push only `qa/t179-*`, through `node docs/loops/qa-125/push-qa.mjs <branch>`.** `git push` is denied.
- Never: master, merges, PRs, tags, releases, other seats' branches, this PC's configuration, **or any live
  `state.json`**.

## The report

- **Path:** `docs/loops/t179-qa-report.md`. The verdict comes first. Then the brief's items and each check above,
  mutants, the full suite and CI, what could not be verified, defects, disagreements, your error entries, reproduction,
  and "Open for the planner".
- **Model and effort** from your process command line and transcript.
- Commit it to `qa/t179-report`, and push with `push-qa.mjs`.
- **The LAST line is exactly `QA-125: REPORT COMPLETE`.** No `/end` (T-163).
