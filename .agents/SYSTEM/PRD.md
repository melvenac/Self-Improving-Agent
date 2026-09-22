# Self-Improving Agent — Product Requirements Document

## Project Overview

| Field | Value |
|---|---|
| **Project** | Self-Improving Agent |
| **Description** | A memory protocol and automation layer that enables AI coding agents to learn across sessions. Provides retrieval/accumulation hooks, slash commands, and a project template for persistent AI learning. |
| **Repo** | https://github.com/melvenac/Self-Improving-Agent |
| **Version** | v0.44.0 |
| **License** | MIT |

## Target Users

- **Solo developers** using Claude Code who want persistent AI memory across projects (primary)
- **Small teams** wanting shared AI context across sessions
- **Aaron** (dogfooding — using the system to develop the system)

## Problem Statement

AI coding sessions start cold. Skills learned in one project die there. Lessons from past mistakes are forgotten. Each session repeats the same discovery process.

## Core Features

> **Stale as of v0.44.0 (2026-09-22), kept as written on purpose.** Loop 10 cut the maturity
> lifecycle, the reflection cycle and skill distillation, so items 2, 4 and 5 below describe
> things that no longer ship. The problem statement above still holds. What changed and why:
> the SIA Step-Back artifact, Part 5 (https://claude.ai/artifact/3Kv8BuKYrj5vaKQgD8NKC7), and
> `docs/loops/`. This list will be rewritten when Loop 15 closes.

1. **3-Tier Knowledge Architecture** — Global vault + domain-tagged experiences + project-level `.agents/`
2. **Tiered Memory Architecture** — 4 access tiers: Core (CLAUDE.md, always loaded), Hot (Obsidian Vault v2 Experiences/Skills/ via Smart Connections semantic search), Warm (vault Summaries/Archive/), Cold (SQLite chunks only). Obsidian Vault is the source of truth for content; SQLite `knowledge-v2.db` holds the retrieval index (vault_path, feedback counters, maturity) plus a `content` copy. The copy is not optional: `knowledge_fts` is an external-content FTS5 table over `knowledge_index`, so dropping the column would break keyword search and `ob_recall`. The vault remains authoritative — the DB copy exists to be indexed, not to be edited. Smart Connections is available as a separate MCP tool for vault semantic search, but is not fused into `ob_recall` ranking (see "Not currently implemented"). Reflection cycle: session-end flags tag clusters with 3+ entries; /start synthesizes principles with approval. Failures stored as structured .md with 1.3x recall boost.
3. **Automatic Accumulation** — SessionEnd hook captures session logs and summaries without manual steps (`cli-session-end.js` → skill-scan). The v1/v2 parallel period is complete; only the v2 TypeScript hook is registered.
4. **Ranked Retrieval** — FTS5 keyword search over the vault index, ranked by BM25 with recency, maturity (1.5x Mature, 1.2x Proven) and failure (1.3x) weighting. Ranking policy lives in `LIFECYCLE_CONFIG` and is emitted as SQL by `recallRankExpr()`.
5. **Skill Distillation** — Clusters of 3+ similar experiences proposed as reusable skills (`skill-scan.ts`)
6. **Project Template** — `.agents/` scaffold for any new codebase (Claude Code, Cursor support)
7. **Slash Commands** — `/start`, `/end`, `/sync`, `/skill-scan` for session lifecycle management
8. **Session Bootstrap** — SessionStart hook auto-detects project context, reads handoff notes, checks vault-writer health
9. **Session Backfill** — `--backfill-sessions` recovers missed sessions from .db files when hooks fail
10. **Noise Filtering** — Skips system reminders, empty sessions, and non-meaningful content during accumulation

### Not currently implemented

Documented in earlier revisions but absent from the codebase as of v0.7.2 — listed here so the
gap is explicit rather than implied:

- **Semantic/keyword hybrid retrieval.** `ob_recall` is FTS5-only. Smart Connections is available
  as a separate MCP tool but is not fused into recall ranking.
- **Reciprocal Rank Fusion (RRF).** No fusion step exists; ranking is a single weighted BM25 expression.
- **Recall diversification (cosine 0.85 near-duplicate filter).** Not present.
- **Vector search (`knowledge_vec`).** Disabled; v1 IDs are stale.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (LTS) |
| Database | SQLite (better-sqlite3) — `knowledge-v2.db`; also reads Claude Code session .db |
| Knowledge Store | Obsidian Vault (plain markdown) |
| Search | SQLite FTS5 via the open-brain MCP server (`ob_recall`) |
| CLI | Claude Code |
| VCS | Git + GitHub |

## Non-Functional Requirements

- **Portable** — markdown-based, no proprietary lock-in
- **Agent-guided setup** — guides written for users to walk through with their AI agent coaching each step
- **Works offline** — vault is local files, no cloud dependency
- **Beginner-friendly** — 5-step getting-started guide assumes no prior knowledge
