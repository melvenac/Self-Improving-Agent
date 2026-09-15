# Project Summary

<!-- state:begin -->
<!-- generated from .agents/state.json rev 12 by open-brain v0.33.0 — do not edit; change state via ob_state -->
> **Status:** v0.33.0 — Loop 7 is complete and delivered: draft PR #8 at c84be1d, CI green, merging is Aaron's. The open decision is T-145 - adopt or reject C2's recommendation to keep session-start retrieval and suspend the maturity lifecycle. Nothing from C2 is implemented; item 1 is a LIFECYCLE_CONFIG change deliberately left out of the loop. Loop 8's scope is Aaron's to set, and the strongest candidate the loop surfaced is not on the gap list: the store repeatedly holds a correct observation of a live defect filed as something inert (four instances in one night), recorded as knowledge 563.

## What's working

- ob_start is the single startup implementation and returns state, drift, session and sizes _(V-001, 2 evidence)_
- state.json read side: strict schema, three-way reader, ob_start render, state-schema sync check _(V-002, 2 evidence)_
- state writer: revision check, atomic batch, retention, four views, ob_state _(V-003, 2 evidence)_
- /sync resolves the project root or refuses; identical from root and open-brain/ _(V-004, 2 evidence)_
- relocate existence check is case-insensitive; CI green on ubuntu _(V-005, 2 evidence)_
- reopen_task moves done → open with closed_session null and the note appended; TaskSchema refuses closed_session that disagrees with status in both directions _(V-006, 3 evidence)_
- summary-version with state.json present re-renders stale views through the shared renderers (applyStateOps with an empty batch: revision unchanged, no retention, state.json untouched) and never inserts prose; the prose regime runs only when state.json is absent _(V-007, 2 evidence)_
- ci-status, state-views and merge-markers sync checks pass / warn / skip with the reason, and ci-status + merge-markers print their number whatever the severity (REPORTED block in sync CLI and ob_sync) _(V-008, 2 evidence)_
- open-brain state import: --draft writes a schema-valid draft + report and nothing else; --commit snapshots .agents/ byte-complete before any change, writes state.json at revision 0, cuts SUMMARY's blockquote and Current State leaving the prose sections byte-identical, renders the four views, moves the draft into the snapshot, and refuses a second run _(V-009, 2 evidence)_
- /end writes state through ob_state when state.json exists (A7b), and the first real write on this repo went through the MCP tool at revision 0 _(V-010, 2 evidence)_
- The rendered Done list and the state record agree on which done tasks exist, at the same session, including on /sync's render-only path _(V-011, 1 evidence)_
- state.json can be read without the MCP server, through a door that writes nothing _(V-012, 1 evidence)_
- A session that resolves no recalled ids reports why, instead of being indistinguishable from a session with nothing to rate _(V-013, 1 evidence)_
- The interim ranking cut was tested rather than applied, and refused on evidence; LIFECYCLE_CONFIG is unchanged _(V-014, 1 evidence)_
- The shadow replay is evaluated as of the session it replays: lifecycle state is snapshotted pre-feedback, the candidate pool excludes entries created after the session, and the recency clock is anchored to the session's earliest recall. Production ranking is byte-identical. _(V-015, 3 evidence)_
- Stage 6 no longer ranks against maturity values Stage 2 wrote in the same session; the snapshot is captured over recalledEntryIds before the auto-feedback loop runs, and the stage order is preserved rather than reversed. _(V-016, 2 evidence)_
- update_gap amends a gap in place, preserving its id and opened_session, and refuses both an unknown id and an amendment that changes nothing. _(V-017, 1 evidence)_
- The unattended SessionEnd rating arm has never written a rating: the `heuristic` arm produced zero rows across the entire life of the `rating_method` column, because cli-session-end.ts read an environment variable the host does not set. _(V-018, 3 evidence)_
- The heuristic rating arm is gated off by default and skips an unjudged entry entirely, writing neither an aggregate counter nor an event row. _(V-019, 2 evidence)_
- T-003's write path already refuses the failure it describes: a slot is consulted only when the in-memory session id is absent, and is refused when older than 12h. _(V-020, 2 evidence)_

## What's broken

- Gap G-001: Cursor start.md/end.md copies are not on ob_start/ob_state
- Gap G-002: The repo's .claude/ is gitignored; mirror policy for slash commands is undecided
- Gap G-003: SESSION_TEMPLATE.md pre-session checklist still says to read SUMMARY/INBOX by hand
- Gap G-004: vault-index-parity warns on one unindexed Checkpoints note
- Gap G-005: DECISIONS.md is both the prose ADR log and the decisions[] index
- Gap G-007: `open-brain state import --commit` is denied by the auto-mode permission classifier inside an agent session ("Irreversible Local Destruction"); the one-shot migration must be run by the human
- Gap G-008: ob_start's prose baseline (24,888 words) vs the rev-0 render (7,360 words) was measured on a temp copy, not the live repo, because handleStart creates a session log per call
- Gap G-009: R4 is Claude-only: project-template/.cursor/commands/start.md still instructs writing .recalled-entries.json, so for a Cursor user the file still accumulates across sessions
- Gap G-010: The state record can hold fields that nothing can subsequently change: project.version has no op at all, gaps have add and close but no update, decisions have add only
- Gap G-011: The shadow-recall harness cannot currently answer any question about the maturity constants, in backfill OR in production
- Gap G-012: project.version is a cached copy of package.json's version, and three checks plus a drift branch exist only to police the cache. ADR-027 decided removal; the work is not done.
- Gap G-013: feedback_log holds only 31% of the non-neutral ratings the live counters know about (154 of 496), so any replay reconstructing maturity from it systematically under-promotes and cannot answer questions about maturity boosts.
- Gap G-014: success_rate excludes neutral ratings from its denominator and harmful is structurally near-unreachable, so success_rate is 1.00 for any entry ever rated helpful once. Maturity promotion therefore tracks recall volume rather than usefulness, and promotion grants a ranking boost that causes more recall.
- Gap G-015: One session uuid is written under two different project keys in active-session.json, corrupting project-scoped attribution.
- Gap G-016: Intermittent cross-test failure in state-writer.test.ts under the full suite.

## What's next

- [P0] T-003 Session identity is keyed per project, not per session
- [P0] T-004 The lifecycle bundle's remaining three parts stay BLOCKED
- [P0] T-008 Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [P0] T-014 Make point-of-use rating reachable
- [P0] T-022 Replace-on-write for `state` facts

## Decisions

- 2026-09-15 — ADR-030 - A bug fix that revives a dead code path ships gated off — Correcting the session-uuid bug in cli-session-end.ts would have switched the dormant heuristic rating arm on at the next session end, feeding topic-mention signal into a scoring system whose per-entry mean (0.311) sits one hundredth above its apoptosis threshold (0.3) - during the very loop deciding whether to keep that system. So the repair and the switch-on ship as two separable things: enableHeuristicRatings defaults false, and the doc comment carries the argument so whoever flips it later sees it rather than re-deriving it. Rows produced after the fix are out of sample for Loop 7, the population having been fixed before the change. Secondary rule, and the part that was nearly missed: with the gate closed an unjudged entry is SKIPPED, not recorded neutral - a fallback neutral is indistinguishable from a rater's considered 'retrieved and not used', so the cheaper diff would have destroyed the only signal the corpus still has while appearing to strengthen the data.
- 2026-09-15 — ADR-029 - Keep session-start retrieval; suspend the maturity lifecycle; leave the causal question unasked — Loop 7's deliverable, RECOMMENDED not yet adopted - Aaron rules (T-129). 'Does injection earn its place' was three questions wearing one coat, and bundling them is what nearly retired the cheap half on evidence that only ever concerned the expensive half. STEM Agent's argument is that a maturation lifecycle belongs on an EXECUTABLE unit because only an execution yields an objective outcome; that indicts success_rate, maturity and apoptosis on knowledge entries and says nothing about whether fetching a note is worthwhile. A bookmark is not improved by a promotion ladder. Keep retrieval: the case against it was a claim retracted in the vault 26 minutes after it was written, and the first adequately powered contrast this project has produced runs in its favour (start 0.337 vs explicit 0.259 per-entry, n=109 and n=56, opposite to the pre-registration's own selection-bias prediction). Per prereg §5 that is not evidence injection helps - it refutes the claim that injection is the low-value mode. Suspend the lifecycle: success_rate is near-two-valued (98% of rated entries read exactly 1.0), apoptosis cannot fire on arithmetic (needs >=4 harmful on one entry, observed max 1), no_maturity tied live in Loop 6, and the ladder is a ratchet. Recency decay by contrast IS validated, so this is not 'ranking is worthless'. The causal question: control arm named concretely (randomised withhold flag in sessions at ob_start plus a non-self-reported outcome) and then argued against on the pre-registration's own costing - at ~2 sessions/week no effect smaller than enormous is resolvable.
- 2026-09-15 — No ranking constant changes on one measured alternative beating one incumbent — Loop 6's repaired instrument made the recency question answerable and recency_strong (0.02/day) was the only strategy to beat live — 21-11-5, +0.0153 nDCG, winning against a presentation bias that favours the incumbent. The constant was still NOT changed.

Reasoning: recency_strong tests ONE alternative point against ONE incumbent. That 0.02 beats 0.005 is evidence the constant is too low. It is not evidence that 0.02 is right — nothing between or beyond was measured, and the optimum could be anywhere above 0.005. Adopting the one other number that happened to be guessed in the strategy list is the 'flipped because the new number is bigger' outcome the loop's own precondition rules out, and it rules it out whether or not the bigger number won.

shadow/index.ts states the same contract independently: changing production constants stays a human decision; the harness only supplies the evidence. The evidence is now worth supplying, which it was not before this loop.

Recommended next measurement: a sweep — 0.01 / 0.02 / 0.04 as separate strategies — to find where the gain turns over. Adoption is Aaron's call.

What the same run did NOT license: no_maturity ties live, and that must not be read as 'maturity boosts are harmless'. See G-013 (feedback_log 31% complete) and G-014 (success_rate ignores neutral).
- 2026-09-15 — Amendment vocabulary: which state records can be corrected, and which are append-only — Decided once rather than one op per incident. The op union grew by accident — update_task exists because someone needed it, update_gap did not because nobody had yet — and Loop 5 hit the consequence twice in one night.

RULE: a record is amendable when its text DESCRIBES SOMETHING STILL BEING LEARNED. A record is append-only when its text IS THE HISTORICAL FACT, so that editing it destroys the thing the record exists to preserve.

Per type:
- TASKS — amendable (open/update/close/reopen). Title and priority are current intent, which legitimately changes. Already correct.
- GAPS — amendable. A gap describes something we do not yet understand, so its text is provisional by construction. The record most needing correction was the one that could not be corrected. IMPLEMENTED this loop: update_gap. The prior workaround (close + re-add) silently minted a new id and reset opened_session, losing the history the gap list exists to keep.
- VERIFIED — claim append-only; evidence appends; status reopens. The claim is what evidence was gathered against, so editing it invalidates that evidence silently while leaving it attached. Already correct; no update_verified.
- DECISIONS — append-only. A decision log records what was decided and when; amending it is not a correction but a rewrite of the record. Supersede with a new decision instead. Already correct; no update_decision. Gap: decisions carry no supersedes field (tasks do), so superseding is convention only.
- OBJECTIVE / HANDOFF / LAST_SESSION — singletons, set wholesale. Already correct.
- PROJECT.VERSION — REMOVE; do not add set_version. No consumer treats it as authoritative: cli.ts:427 and session-start/state-render.ts:14 display it, state-import/index.ts:439,494 copy it, drift-detector.ts:9 + checks-state.ts:73 + checks.ts:783 compare it to package.json and complain, and state-writer.ts:166 prefers package.json with this only as fallback. It is a cached copy of a truth held elsewhere, with a drift branch and two checks existing solely to police the cache. DEFERRED to Loop 7: 7 call sites plus schema, a state.json migration and test updates is larger than the decision.

ID SCHEME, observed while filing this: the Planner's brief assumed the next ADR id was free, but ADR-021..ADR-026 already exist and nextId has since minted D-001..D-003 alongside them, so the list now carries both schemes. This decision took an explicit ADR-027 to avoid widening the split. The generation bug itself stays filed under G-005 — it is an id question, not an amendment one.
- 2026-09-15 — Delete the text that generates a false claim, not just the claim — Knowledge entry 556 asserted that ob_recalled compares the file's session_id. It was written from end.md A14, which described the fallback as if it were the mechanism. Rating 556 harmful and superseding it with 558 removes the entry but leaves the generator standing to mint it again. Loop 5 R4 corrects A14 itself. Deterministic and structural prevention before prompt-level correction.
<!-- state:end -->
## Architecture Overview

3-tier hub-and-spoke memory protocol:

| Tier | Location | Purpose |
|---|---|---|
| **Global** | `~/Obsidian Vault/` + `CLAUDE.md` | Cross-project experiences, reusable skills, user preferences |
| **Domain** | Tagged experiences in vault | Stack-specific knowledge (Convex patterns, Stripe gotchas, etc.) |
| **Project** | `.agents/` in each repo | Project-specific context (PRD, tasks, session logs) |

## Search Architecture (v0.6.0)

| Store | Search type | Access |
|---|---|---|
| SQLite FTS5 (knowledge-v2.db) | Keyword + snippet | `kb_recall` via open-brain MCP |
| Obsidian (Summaries/) | Semantic embeddings | `smart-connections__lookup` |
| SQLite vec (knowledge.db) | Semantic vector | Disabled — v1 IDs stale, rebuild pending |

## Key Distinction

- **Self-Improving Agent** = the memory protocol (how knowledge flows across sessions)
- **AI-First Development Framework** = the project template (how projects are structured for AI agents)
- These are complementary layers distributed from this repo, but they are not the same thing

## Research Context (Session 8)

Gap analysis against next-gen frameworks (STEM Agent, Memory-as-a-Tool, Anthropic Harness, Karpathy autoresearch). Full details: `docs/gap-analysis-next-gen-frameworks.md`. Knowledge base entries: IDs 155-161.
