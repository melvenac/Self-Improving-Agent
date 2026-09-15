# Project Summary

<!-- state:begin -->
<!-- generated from .agents/state.json rev 0 by open-brain v0.31.0 — do not edit; change state via ob_state -->
> **Status:** v0.31.0 — **Loop 4 of the extraction evaluation — dogfood: migrate this repo's `.agents/` prose into `.agents/state.json`, switch `/end` to `ob_state`, run on it.** Per `~/.agents/mailbox/channels/sia/loop-4-brief.md` (read it fully first). Branch `loop/4-dogfood` from `loop/3-state-writer` head **ee2cdb8**. First deliverable is `open-brain state import --draft` on this repo + the import report to the Planner; `--commit` only after the Planner's authorization. Report to the Planner session, not to Aaron. Session 54 shipped Loops 1–3 (v0.28.0, v0.29.0, v0.30.0 on PR #3) and hotfix v0.29.1 (merged; master 86ea010, CI green). Full handoff: `.agents/SESSIONS/next-session.md`.

## What's working

- ob_start is the single startup implementation and returns state, drift, session and sizes _(V-001, 2 evidence)_
- state.json read side: strict schema, three-way reader, ob_start render, state-schema sync check _(V-002, 2 evidence)_
- state writer: revision check, atomic batch, retention, four views, ob_state _(V-003, 2 evidence)_
- /sync resolves the project root or refuses; identical from root and open-brain/ _(V-004, 2 evidence)_
- relocate existence check is case-insensitive; CI green on ubuntu _(V-005, 2 evidence)_

## What's broken

- Gap G-001: Cursor start.md/end.md copies are not on ob_start/ob_state
- Gap G-002: The repo's .claude/ is gitignored; mirror policy for slash commands is undecided
- Gap G-003: SESSION_TEMPLATE.md pre-session checklist still says to read SUMMARY/INBOX by hand
- Gap G-004: vault-index-parity warns on one unindexed Checkpoints note
- Gap G-005: DECISIONS.md is both the prose ADR log and the decisions[] index
- Gap G-006: No CLI door for ob_state (only the MCP tool)

## What's next

- [P0] T-001 Loop 4
- [P0] T-003 Session identity is keyed per project, not per session
- [P0] T-004 The lifecycle bundle's remaining three parts stay BLOCKED
- [P0] T-008 Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [P0] T-014 Make point-of-use rating reachable

## Decisions

- 2026-09-14 — Project state is a record; the prose files are generated views; loops ship on branches behind a bare-runner gate — imported; original date unknown
- 2026-09-14 — Per-session MCP servers require per-writer schema stamps — imported; original date unknown
- 2026-09-14 — A structural fix ships with its own instrumentation, in the same release — imported; original date unknown
- 2026-09-14 — Rejection must be representable — the ledger pattern — imported; original date unknown
- 2026-09-14 — A treatment column's default is 'unspecified', never a real treatment value — imported; original date unknown
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
