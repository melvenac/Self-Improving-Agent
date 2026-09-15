# Current Focus

## Current Objective

**Loop 4 of the extraction evaluation — dogfood: migrate this repo's `.agents/` prose into
`.agents/state.json`, switch `/end` to `ob_state`, run on it.** Per
`~/.agents/mailbox/channels/sia/loop-4-brief.md` (read it fully first). Branch
`loop/4-dogfood` from `loop/3-state-writer` head **ee2cdb8**. First deliverable is
`open-brain state import --draft` on this repo + the import report to the Planner;
`--commit` only after the Planner's authorization. Report to the Planner session, not to
Aaron. Session 54 shipped Loops 1–3 (v0.28.0, v0.29.0, v0.30.0 on PR #3) and hotfix v0.29.1
(merged; master 86ea010, CI green). Full handoff: `.agents/SESSIONS/next-session.md`.

**Session 53's objective (below) is superseded by the loop protocol; its P0 #2 and the
carried items stay open as pre-loop backlog.**

Next up from Session 53, in order (backlog):

   **DONE post-close-out as v0.27.1** (real upsert, `tests/index-upsert.test.ts`, 14 exposed rows verified on a DB copy). Item kept below for context; skip it.
1. **Replace `INSERT OR REPLACE` with a real upsert (P0).** A re-store resets maturity,
   all three counters, `success_rate`, `recall_count` and `created_at`, takes a new id
   and orphans the log rows. The dedup branch fires only when the *canonical note file*
   exists, so any row indexed under `Checkpoints/`/`Summaries/`/`Specs/` is permanently
   vulnerable. **Lead with entry 416** — it holds one of only two `harmful` ratings in
   the corpus and has no canonical note, so one re-store destroys half of all negative
   signal ever recorded. 18 rows exposed, 133 ratings / 122 recalls at risk.

2. **Make the session-identity key carry the session (P0).** `active-session.json` keys
   on `project::ide`, so a reconnect in a two-session repo adopts the other session's
   uuid — proven live, feedback row #348 sits under a uuid absent from `sessions`. Until
   the key changes, refuse attribution rather than guess it. Consider correcting row 348.

3. **Do NOT touch the lifecycle threshold.** The measurement is running
   (`feedback_log.rating_method`, v0.26.0). Read
   `~/Obsidian Vault v2/Research/rating-method-prereg-2026-09-01.md` §4 only after **10
   sessions with ≥1 rating**, and honour §5 on what cannot be concluded at that n.

4. **Cheap and unblocked, good filler:** delete the dead `db.ts`; implement-or-strike
   `ob_feedback`'s third `referenced` argument (not in the tool schema); the two owed
   `/sync` validators (MCP command paths in `~/.claude.json`; `.agents/skills/`
   three-source identity); surface `[id]` alongside `/start`-injected entries.
