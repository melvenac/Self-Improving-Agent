# Project Summary

<!-- state:begin -->
<!-- generated from .agents/state.json rev 19 by open-brain v0.36.0 — do not edit; change state via ob_state -->
> **Status:** v0.36.0 — Loop 10 answered the question the project was started to ask: the ranker earns its keep, the injection does not, and after six months the memory half is still unproven. The next loop starts from that answer rather than from another measurement.

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
- The skill-proposal generator is off at both ends behind one constant, and no stale count is announced from the pending file that is left on disk. _(V-021, 2 evidence)_
- project.version is gone from every state.json in the tree and a file still carrying it fails parse, so a missed copy is loud rather than silent. _(V-022, 2 evidence)_
- No recency-decay variant beats the live 0.005 constant at better than chance on the repaired harness. _(V-023, 1 evidence)_
- Whether recalled knowledge changed what an agent did is not answerable on the existing record; the apparent signal is retrieval's own selection criterion. _(V-024, 1 evidence)_
- ob_start's State block replaces the four prose files rather than accompanying them, and renders task titles only: the payload fell from 7,971 to 2,142 words on the same rev-14 state, and the briefing was completable without opening task.md. _(V-025, 3 evidence)_

## What's broken

- Gap G-001: Cursor start.md/end.md copies are not on ob_start/ob_state
- Gap G-002: The repo's .claude/ is gitignored; mirror policy for slash commands is undecided
- Gap G-003: SESSION_TEMPLATE.md pre-session checklist still says to read SUMMARY/INBOX by hand
- Gap G-004: vault-index-parity warns on one unindexed Checkpoints note
- Gap G-005: DECISIONS.md is both the prose ADR log and the decisions[] index
- Gap G-007: `open-brain state import --commit` is denied by the auto-mode permission classifier inside an agent session ("Irreversible Local Destruction"); the one-shot migration must be run by the human
- Gap G-008: ob_start's prose baseline (24,888 words) vs the rev-0 render (7,360 words) was measured on a temp copy, not the live repo, because handleStart creates a session log per call
- Gap G-009: R4 is Claude-only: project-template/.cursor/commands/start.md still instructs writing .recalled-entries.json, so for a Cursor user the file still accumulates across sessions
- Gap G-010: The op vocabulary cannot subsequently change some of what it records, and closing destroys rather than marks. Three parts, as of session 61. (1) SHARPEST: close_gap splices the entry out of the array — state-writer.ts:292, s.gaps.splice(idx, 1) — with no closed_session, no status and no tombstone, so closing a gap destroys its text, evidence and reasoning in the same motion. G-018's evidence, including the 'Progenitor' vs lowercase 'progenitor' case mismatch across 519/25/14 rows, left the record this way at rev 16 and survives only at 6af5592. (2) STILL TRUE: decisions are add-only, and verified has add_verified and reopen_verified but no amend. The 13-op vocabulary contains no update_decision and no update_verified. (3) RESOLVED, recorded rather than deleted: 'project.version has no op at all' is moot — Loop 8 R3 / ADR-027 removed the field (state-schema.ts:44-50; state.json's project now carries name only), as V-022 records. 'gaps have add and close but no update' is false — update_gap exists at state-writer.ts:59, :273, :282, as V-017 records. This amendment is itself made with update_gap, which is the clause it retires.
- Gap G-011: The shadow-recall harness cannot currently answer any question about the maturity constants, in backfill OR in production
- Gap G-013: feedback_log holds only 31% of the non-neutral ratings the live counters know about (154 of 496), so any replay reconstructing maturity from it systematically under-promotes and cannot answer questions about maturity boosts.
- Gap G-014: success_rate excludes neutral ratings from its denominator and harmful is structurally near-unreachable, so success_rate is 1.00 for any entry ever rated helpful once. Maturity promotion therefore tracks recall volume rather than usefulness, and promotion grants a ranking boost that causes more recall.
- Gap G-015: One session uuid is written under two different project keys in active-session.json, corrupting project-scoped attribution.
- Gap G-016: Intermittent cross-test failure in state-writer.test.ts under the full suite.
- Gap G-017: 86% of ACTION: lines give prose advice rather than naming a file, which is why Loop 9's F1 fired at 14.2%. That is a fact about how the /end A12 template gets filled in, not about recall or retrieval.
- Gap G-019: The correction record's Loops 5-7 row is carried forward from the running count rather than re-derived, so unlike every other row it cannot be audited from its own list.
- Gap G-020: A session-log checklist ticked before the action it describes cannot fail, and misled the Planner into reporting that /end had never run.
- Gap G-021: R1's staleness signal is under-specified: a stale MCP server and a current one produce identical totals
- Gap G-022: The error-count table and the ordinal numbering disagree by 2 Planner and 1 Developer, at the Loops 5-7 boundary
- Gap G-023: PR #2 has been open and review-ready for three weeks against a head that no longer exists on origin
- Gap G-024: Done-task retention evicts entries from state.json permanently during a bulk close, while reporting it only in passing. Closing 13 tasks in session 61 dropped T-032 and T-052 out of the record entirely — nobody asked for those two to go, and it surfaced only because the tool output was read carefully. The count scales with the size of the close, so a large sweep evicts proportionally more, equally quietly.
- Gap G-025: open-brain/build is not pruned on rebuild, so a deleted source leaves its declaration file and sourcemap behind with no .js beside them. auto-feedback.ts was cut in Loop 10, but build/pipelines/session-end/ still holds auto-feedback.d.ts and auto-feedback.js.map dated Sep 15. Inert — nothing executes without the .js — and build/ is gitignored, so this is per-seat debris rather than a repo defect.

## What's next

- [P0] T-003 Session identity is keyed per project, not per session
- [P0] T-008 Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [P0] T-014 Make point-of-use rating reachable
- [P0] T-022 Replace-on-write for `state` facts
- [P0] T-023 Improve state-side classifier precision

## Decisions

- 2026-09-17 — R1's first production use was a true positive whose subject was R1 itself — After the merge, ob_sync via MCP omitted the state-schema line entirely while the CLI printed it: the server held the module from before R1 existed. Reconnect confirmed the fix - 'readable by the running MCP server'. But both runs reported an identical '23 passed, 0 issues', so a stale server and a current one differ only in whether one row among twenty-three is printed. The signal is an absent check, not a failing one - the same family as apoptosis reading 0 forever. Expectation of a pass was correct about parsing and would have concealed it, which is why expectation is not the instrument.
- 2026-09-17 — SUSPENDED deletes the code; it differs from CUT only by a named reviving observation and a recovery SHA — C1 forbids dormant code, and a component left switched off in the tree IS the open-ended suspension this loop was convened to end. Pinned for prompt artifacts in bfee8c0 before any was ruled, then extended to code after seeing E3/E18 and dated as such per C1's falsification clause. E3, E18, E9b and P1 are therefore deleted with their triggers written down. Every trigger carries the clause that reviving maturity ranking without the as-of replay is not a partial revival but one that cannot be honestly measured.
- 2026-09-17 — Loop 10 ruled the memory half: the ranker earns its keep, the injection does not — bm25_only loses to live 10-23 p=0.035 is evidence about RANKING, not about injection; the one attempt to measure injection collapsed to p=0.688 topic-matched. The upper bound is CLAUDE.md: injected at 100% delivery, top of context, every session, carrying the sentence that the summaries table does not exist, while /start instructed agents to call ob_summarize() and ob_store_summary() which do not exist and command-parity reported pass. Perfect delivery did not produce connection, so the problem is not delivery and no ranking/maturity/recency/scoping work can reach it. After six months the memory half is still unproven. 14 KEEP, 9 CUT, 4 SUSPENDED across 28 components. Released as v0.34.0 (4212f69), merged as PR #12 into master 4f93676.
- 2026-09-15 — Pre-register the disposition trace, then do not build it — Loop 9 R2. F1 was pinned at an in-population share below 15% before the number existed; the event record turned out to have no shell-command type, only path predicates were matchable, and the measured share was 14.2%. Building something already pre-registered as unable to answer would be goalpost-moving in the direction that produces work. A threshold chosen after seeing 14.2% would have been chosen at 10%.
- 2026-09-15 — Turn the skill-proposal generator off at both ends — Loop 9 R1, Aaron's ruling. The generator clusters on a single frontmatter tag and cannot carry action signal; he never reads the queue, which is why 39 proposals accumulated. Deterministic-first: remove the trigger rather than patch around it. Nothing deleted, vault notes accumulate as before, reversible by one constant.
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
