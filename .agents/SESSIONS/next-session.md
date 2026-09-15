<!-- generated from .agents/state.json rev 2 by open-brain v0.31.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 55)_

Loop 5 starts in a fresh session with a new Planner brief (~/.agents/mailbox/channels/sia/). Loop 4 is accepted: loop/4-dogfood = 644465e + the chore(state) first-write commit, tag v0.31.0 at 644465e, draft PR #5 (CI run 34921172116 green). This repo now runs on state.json: /start shows `Revision:`; /end writes through ob_state (A7b) — never edit INBOX.md, task.md, next-session.md or SUMMARY.md's marked region by hand. First real write (session 55, rev 0→1): ops close_task T-001, open_task T-144, add_verified V-006..V-010, add_gap G-007/G-008, add_decision ADR-026, set_objective, set_handoff, end_session; retention dropped 96 done tasks. state.json 136,390 → 73,776 bytes; tasks 143 (42 open / 3 in_progress / 0 blocked / 98 done) → 48 (42 / 3 / 0 / 3); verified 5 → 10, gaps 6 → 8, decisions 25 → 26. Views: SUMMARY 610 → 867 words, INBOX 14,308 → 6,935, task 176 → 150, next-session 583 → 392. A second write (rev 1→2) only refreshed this handoff with those numbers.

## Watch out

- Run vitest, tsc and the CLI from open-brain/ with an explicit `cd` — parallel Bash calls share one cwd and a `cd` in one call moved a sibling vitest run to the repo root (20 false failures in Session 55).
- The auto-mode classifier denies `state import --commit` (and may deny other one-shot rewrites) in an agent session; hand the single command to Aaron with `! <cmd>` rather than routing around it.
- GitNexus incremental analyze fails on the FTS 'file_fts' inconsistency; `node .gitnexus/run.cjs analyze --force` works. Re-index before detect_changes; new files are not in the index until re-analyzed.
- Bash heredocs eat regex backslashes — write code through Write/Edit; use local calendar dates, not toISOString (an evening run stamped tomorrow).
- The live MCP server picks up a build only after `/mcp reconnect open-brain` (ADR-024); verify with a dry-run ob_state before relying on new ops.
- project-template/gitignore ships without the dot on purpose (a nested .gitignore would ignore the template's own .agents/ files in this repo); bootstrap Step 5 copies it.
- The unnumbered `### ADR:` heading at DECISIONS.md:173 is skipped by the importer and must not be numbered by an agent (G-005).

## Open questions

- Loop 5 scope (Planner): Done-section-by-retention rendering (T-144) vs DECISIONS.md dual role vs Cursor copies vs CLI door — which first?
- Should ob_start get a no-log read mode so sizes can be measured without minting a session log (G-008)?
- PR #3 (v0.30.0) and PR #5 (v0.31.0): Aaron's merge order and whether tags move to master at merge.

## Last session

Session 55 — 2026-09-14 — `5348fd7f-06d1-4073-ac07-c7174f39c440`
