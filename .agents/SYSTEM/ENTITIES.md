# Entities

> Conceptual entities the Self-Improving Agent system operates on. These are not database models — they are knowledge objects stored as markdown files.

## Entity Overview

| Entity | Description | Storage Location |
|---|---|---|
| **Experience** | A lesson learned — structured as TRIGGER/ACTION/CONTEXT/OUTCOME/CONCEPTS | `~/Obsidian Vault/Experiences/*.md` |
| **Skill** | Distilled from 3+ experiences — a reusable workflow | `~/Obsidian Vault/Guidelines/*.md` |
| **Session Log** | Record of one coding session's work and outcomes | `~/Obsidian Vault/Sessions/*.md` |
| **Summary** | Enriched session summary (What/Why/How/Lessons) for semantic recall | `~/Obsidian Vault/Summaries/*.md` |
| **Research** | Research captures from /end B1 step (gap analyses, findings) | `~/Obsidian Vault/Research/*.md` |
| **Topic** | A subject note with backlinks to related experiences | `~/Obsidian Vault/Topics/*.md` |
| **Skill Candidate** | A cluster of similar experiences not yet promoted to skill | `~/Obsidian Vault/Guidelines/SKILL-CANDIDATES.md` |
| **Project Context** | PRD + entities + rules + decisions for one codebase | `.agents/SYSTEM/` in each project |
| **Task** | A prioritized work item tracked within a project | `.agents/TASKS/INBOX.md` |

## Relationships

```
Sessions ──produce──> Experiences ──tagged by──> Domain
                          │
                          ├──update──> Topics (via WikiLinks)
                          │
                          └──cluster into──> Skill Candidates ──promoted to──> Skills
                                                                    │
                                                              (requires 3+ experiences
                                                               + human approval)

Project Context ──consumed by──> /start ──shapes──> Session
Tasks ──tracked across──> Sessions ──closed when──> Done
```

## Experience Format

YAML frontmatter:
```yaml
---
title: Short description of the lesson
project: Project Name
domain: comma, separated, tags
date: YYYY-MM-DD
type: gotcha | pattern | decision | fix | optimization
last-used: YYYY-MM-DD
retrieval-count: N
---
```

Body sections: `## TRIGGER`, `## ACTION`, `## CONTEXT`, `## OUTCOME`, `## CONCEPTS`

The `## CONCEPTS` section lists domain concept tags (one per line or comma-separated). These are used by `session-end.mjs` auto-feedback to determine domain overlap between recalled entries and the session summary, producing ternary ratings (helpful/neutral).

## Entity Storage (v2)

Knowledge content lives in the Obsidian Vault as .md files (source of truth). SQLite `knowledge-v2.db` holds metadata only — no content column.

| Store | Table / Location | What it holds |
|---|---|---|
| **Obsidian Vault v2** | `~/Obsidian Vault/Experiences/`, `Skills/` | Knowledge content (.md files) — source of truth |
| **SQLite `knowledge_index`** | `knowledge-v2.db` | Metadata: vault_path, key, tags, maturity, helpful/harmful/neutral counts, recall_count |
| **SQLite `reflection_log`** | `knowledge-v2.db` | Reflection history: cluster_tag, source_ids, synthesized result |
| **SQLite `chunks`** | `knowledge-v2.db` | Session chunks (cold tier, ephemeral) |
| **SQLite `sessions`** | `knowledge-v2.db` | Session records (UUID, timestamps, project) |

Recall pipeline: Smart Connections semantic search + FTS5 keyword search, merged with maturity ranking. Store pipeline: vault-first (write .md to Obsidian, index metadata in SQLite).

## Knowledge Entry Lifecycle Fields (SQLite)

Knowledge entries in `knowledge_index` track maturity via these fields:

| Field | Description |
|---|---|
| `helpful` | Times rated helpful by auto-feedback or `ob_feedback` (v1 name was `helpful_count`) |
| `harmful` | Times rated harmful |
| `neutral` | Times rated neutral |
| `success_rate` | `helpful / total_ratings` (0.0–1.0) |
| `maturity` | `progenitor` → `proven` (3 helpful, ≥0.5 rate) → `mature` (7 helpful) |
| `vault_path` | Path to the .md file in the vault (v2 stores no content in the DB) |
| `archived_into` | Set when consolidated into another entry — a soft delete. Every `dream` rule filters on `IS NULL` |
| `fact_kind` | `state` \| `event` \| NULL. See below |

Maturity boosts recall ranking: Mature = 1.5x, Proven = 1.2x, Failures = 1.3x. Apoptosis auto-prunes non-manual entries below 0.3 success rate after 5 ratings.

### `fact_kind` — state vs event (v0.10.0)

Which **update rule** a fact obeys, which is a different axis from the `type`
field above:

| Kind | Meaning | Correct update |
|---|---|---|
| `state` | one current value that changes — a path, a version, a port, an owner | **replace** |
| `event` | a timestamped thing that happened — a gotcha, a decision, a lesson | **append** |
| `NULL` | **unclassified** — not a synonym for `event` | — |

The rules are opposites. Replacing an event destroys history; appending a state
leaves two live answers to one question with nothing marking which is current.
`knowledge_index` can only append, so every changed state fact has left its
predecessor recallable — the condition `findSuperseded` looks for.

**Not validated by the schema.** SQLite cannot add a CHECK via `ALTER TABLE`, so
a constraint would hold on fresh databases and not on migrated ones; one shape
everywhere beats a guarantee half the installs lack. Validate with `isFactKind`.

**Note the gap with `type` above:** all five documented `type` values (gotcha,
pattern, decision, fix, optimization) are *events*. The experience format has no
way to express a state fact, which is why state facts get written as experiences
and then never replaced. Reconciling `type` across `ENTITIES.md`,
`vault-writer.ts` and the live vault is filed in INBOX.

New columns go in `ADDED_COLUMNS` (`db-v2.ts`) **and** the DDL — `CREATE TABLE IF
NOT EXISTS` reaches new installs only, so the DDL alone silently no-ops on every
existing database.

## Skill Format

Aligned with XSkill k=(M,W,P):
- **M (Metadata)** — YAML frontmatter (title, domain, triggers)
- **W (Workflow)** — Step-by-step procedure
- **P (Tool templates)** — Reusable code/command patterns

## Changelog

| Date | Change | Session |
|---|---|---|
| 2026-03-23 | Initial entity documentation | Scaffold session |
