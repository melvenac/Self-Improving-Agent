# Project Summary

<!-- state:begin -->
<!-- generated from .agents/state.json rev 3 by open-brain v0.31.0 — do not edit; change state via ob_state -->
> **Status:** v0.31.0 — Loop 6 of the extraction evaluation — repair the shadow-recall instrument before re-asking the ranking questions. C1 has two halves that are one job: lifecycle-state snapshot as of the replayed session, and a candidate pool restricted to entries that existed then. Plus the op-vocabulary ADR (project.version removal leading), with the usage signal displaced to Loop 7. Brief at ~/.agents/mailbox/channels/sia/loop-6-brief.md.

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

## What's next

- [P0] T-003 Session identity is keyed per project, not per session
- [P0] T-004 The lifecycle bundle's remaining three parts stay BLOCKED
- [P0] T-008 Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [P0] T-014 Make point-of-use rating reachable
- [P0] T-022 Replace-on-write for `state` facts

## Decisions

- 2026-09-15 — Delete the text that generates a false claim, not just the claim — Knowledge entry 556 asserted that ob_recalled compares the file's session_id. It was written from end.md A14, which described the fallback as if it were the mechanism. Rating 556 harmful and superseding it with 558 removes the entry but leaves the generator standing to mint it again. Loop 5 R4 corrects A14 itself. Deterministic and structural prevention before prompt-level correction.
- 2026-09-15 — Retire .recalled-entries.json rather than harden it — recall_log already records every ob_recall hit against the live session uuid, and has won precedence whenever the session is known since 2026-08-11. The file was a redundant per-project copy that accumulated other sessions' ids without bound (33 entries here: 11 real, 22 from eight earlier sessions, all wearing the running session's id). It never corrupted a rating; its cost was diagnostic. /start no longer writes it; the read path stays for the pre-ob_set_session case, which R3 makes loud. Per-entry provenance explicitly NOT built.
- 2026-09-15 — Refuse the interim ranking cut on evidence, and refuse the opposing result too — no_maturity loses to live, so the brief's precondition for setting matureBoost/provenBoost to 1.0 is not met. maturity_strong wins by +0.0239 and is ALSO refused: helpful ratings promote maturity, so a replay ranked by today's maturity is scored on promotions its own labels caused. A result that favours the hypothesis is not evidence when its mechanism is circular. A negative result is the deliverable; LIFECYCLE_CONFIG unchanged.
- 2026-09-14 — Project state is a tracked record with one creator and one writer; the rest of .agents/ is local — state.json created once by `state import --commit` (human-run after a reviewed draft), written only through ob_state; git tracks state.json + the four views; views never edited by hand; /sync re-renders instead of inserting prose
- 2026-09-14 — Project state is a record; the prose files are generated views; loops ship on branches behind a bare-runner gate — imported; original date unknown
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
