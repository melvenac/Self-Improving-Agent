<!-- generated from .agents/state.json rev 3 by open-brain v0.31.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 56)_

Loop 6, in a FRESH session — one loop per developer session. Read ~/.agents/mailbox/channels/sia/loop-6-brief.md first. Base is master if Aaron merged PR #6, otherwise bf0a5a7 — check, do not assume. Loop 5 is closed and accepted; PR #6 is open as a draft with CI green at bf0a5a7 and the merge is Aaron's call. The Planner asked for a recommendation on C1's production half (Stage 6 scores what Stage 2 just wrote): reorder, snapshot at stage entry, or record pre-feedback maturity — answer with reasoning, since Forge has read that code and the Planner has not.

## Watch out

- Reordering Stage 6 before Stage 2 does NOT work: the shadow stage needs this session's labels, and Stage 2 is what creates them. The fix has to preserve that order while removing the shared cause.
- Promotion is gated on success_rate AND helpful count (lifecycle.ts:92-97), so any replay snapshot must carry both forward, in order.
- Run vitest from open-brain/, never the repo root: the root loads no setup, OPEN_BRAIN_VAULT_DIR is unset, and 36 tests fail as guards refusing to touch the real vault.
- state.json's project.version cannot be bumped through any op, so a version bump makes sync report two issues clearable only by hand-editing the record. Do not hand-edit it. Removal leads; set_version is a hardening fix and three times this session the right answer was delete rather than harden.
- A stored knowledge claim is not verification. Read the consuming code before designing a fix for it — that rule is now in force for every brief.

## Open questions

- Should project.version exist in state.json at all? Removal leads; no consumer treats it as authoritative.
- Should the op vocabulary be decided once as an ADR (update_gap, update_decision, and the project.version question) rather than one op per incident?
- T-003 remains the top P0 and is still unscoped — it needs a read of the reconnect path, which may already be addressed the same way the recall-file bug was.

## Last session

Session 56 — 2026-09-15 — `b10b59e8-90f1-4874-b92e-0f4738e8904e`
