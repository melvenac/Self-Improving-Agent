# Knowledge Retrieval Redesign — Design Spec

**Date:** 2026-03-26
**Status:** Approved
**Context:** Vault audit found 17 junk sessions, uniform-quality experiences, and weak extraction. Research confirmed FTS5 + structured metadata as optimal retrieval for AI coding agents.

---

## Problem Statement

The current vault-writer produces low-quality session and experience data:
- Sessions are raw user prompt dumps with no quality gate
- Experiences are rigid 5-line templates regardless of session depth
- Decisions only captured when Claude Code tags `category=decision` (rare)
- Gotcha detection is keyword-based, catches stdout noise
- No recency weighting in retrieval — stale results rank equally with fresh ones
- Smart Connections (embeddings) is the weakest retrieval path but still called during `/start`
- Obsidian vault is not used for browsing — it's a QC window into what the agent stores

## Design Principles

1. **Knowledge MCP (FTS5) is the primary store** — agent reads and writes here
2. **Obsidian vault is a QC view layer** — optional, human-readable, generated from FTS5 data
3. **Structured tuples over prose** — situation/action/outcome retrieves better than narratives
4. **Recency matters** — recent experiences are disproportionately valuable for coding agents
5. **Quality over quantity** — skip sessions that don't meet a substance threshold

---

## Phase 1: Quick Wins

### 1a. Recency Weighting in kb_recall

**What:** Add a time-decay multiplier to BM25 scores in Knowledge MCP's recall queries.

**Current behavior:** Pure BM25 ranking — a 90-day-old result ranks the same as yesterday's if keywords match.

**New behavior:** `weighted_rank = bm25_score * (1.0 / (1.0 + days_ago * 0.02))`

This means:
- Yesterday's result: score * 0.98 (barely decayed)
- 7 days ago: score * 0.88
- 30 days ago: score * 0.63
- 90 days ago: score * 0.36

The decay constant (0.02) is tunable. This applies to chunks and summaries queries. Knowledge entries (manually stored, vault-mirrored) should decay slower (0.005) since they're curated.

**Files to modify:** `knowledge-mcp/src/db.ts` (or wherever the recall SQL lives)

### 1b. File-Touch Tagging

**What:** When vault-writer extracts experiences, include which files were modified as tags.

**Current behavior:** Tags come only from topic matching (e.g., `convex`, `docker`).

**New behavior:** `filesChanged` array is added to experience tags. When the agent is working on a file, past experiences involving that file surface automatically via tag filtering.

**Implementation:** In `vault-writer.mjs` `extractStructuredExperiences()`, pass `filesChanged` into the experience metadata and include basenames as tags.

**Files to modify:** `scripts/vault-writer.mjs`

### 1c. Deprecate Smart Connections from Agent Retrieval

**What:** Remove the `mcp__smart-connections__lookup` call from `/start` Part B federated search.

**Current behavior:** `/start` calls both `kb_recall` and Smart Connections in parallel, deduplicates results.

**New behavior:** `/start` calls only `kb_recall`. Smart Connections remains installed for Aaron's personal Obsidian browsing but is no longer part of agent retrieval.

**Rationale:** Embedding search is the weakest path for task-specific retrieval. FTS5 with structured metadata handles the agent's query patterns ("what errors in vault-writer last week") better than semantic similarity.

**Files to modify:** `commands/start.md` (remove Smart Connections from Part B3 federated search)

---

## Phase 2: Structured Experiences

### 2a. New Experience Format

**What:** Replace the rigid 5-section prose template with structured tuples.

**Current format:**
```markdown
## Trigger
{first line of text}
## Action
{first 500 chars}
## Context
Session on {date} in **{project}**.
## Outcome
Auto-captured. Review and enrich...
## See Also
[[topics]]
```

**New format:**
```yaml
---
date: 2026-03-26
project: self-improving-agent
type: experience
subtype: gotcha | decision | pattern | fix
tags: [vault-writer, sqlite, windows]
files: [scripts/vault-writer.mjs]
outcome: success | failure | partial | unknown
source: auto-extracted
---

situation: "vault-writer crashed on SessionEnd with SQLITE_CANTOPEN because DB path used string concatenation instead of path.join()"

action: "Replaced string concatenation with path.join() for all DB path construction"

outcome_detail: "Fixed — vault-writer now runs on both Windows and Unix without path errors"

learned: "Always use path.join() for cross-platform file paths in Node.js"
```

**Why this retrieves better:**
- `situation` field can be matched against current problem context
- `tags` + `files` enable precise filtering
- `outcome` field lets retrieval weight successful experiences higher
- `learned` field provides the actionable takeaway without reading full narrative
- YAML frontmatter is machine-parseable for structured queries

### 2b. Session Quality Gate

**What:** Skip vault writes for sessions that don't meet minimum substance thresholds.

**Current gate:** "has ANY content" — even a single 11-char prompt passes.

**New gate (all must pass):**
- At least 3 meaningful user prompts (>20 chars, not system noise), OR
- At least 1 file change, OR
- At least 1 decision/gotcha extracted

AND:
- Total meaningful text > 200 characters

Sessions that fail the gate get logged (`SKIP: session too thin`) but not written.

### 2c. Vault-Writer Rewrite

**What:** Restructure vault-writer's output pipeline.

**Current flow:**
```
Session DB → Extract events → Write Session markdown → Extract Experiences markdown → Mirror to FTS5 → Link Topics
```

**New flow:**
```
Session DB → Extract events → Quality gate check
  → PASS: Write structured experience to Knowledge MCP (primary)
        → Optionally render markdown to vault (QC view)
        → Link Topics
  → FAIL: Log skip, no write
```

Key changes:
- Knowledge MCP is the primary write target, not Obsidian
- Experience extraction uses the new structured tuple format
- Session summaries go directly to FTS5 `summaries` table
- Vault markdown is a generated QC artifact, not the source

### 2d. Vault as QC View

**What:** Sessions/ folder in Obsidian becomes an optional QC output.

**Decision: Option A** — Stop writing sessions to vault entirely. Rely on Knowledge MCP for storage, use `kb_recall` or `kb_list` to inspect. Experiences still get vault markdown for QC.

---

## Phase 3: Unified Retrieval

### 3a. Single Retrieval Interface

**What:** Replace the dual `kb_recall` + Smart Connections with a single retrieval path.

**Retrieval algorithm:**
```
1. Filter by project (current working directory)
2. Filter by tags (match against current files, framework, error type)
3. FTS5 keyword search within filtered results
4. Rank by: BM25 * recency_weight * outcome_weight
5. If results < 3: broaden scope (project → global, 7 days → 30 → all)
6. Return top K with source attribution
```

**Outcome weighting:** `success = 1.0, partial = 0.7, unknown = 0.5, failure = 0.3`

**Files to modify:** `knowledge-mcp/src/db.ts`, `knowledge-mcp/src/server.ts`

### 3b. Update /start to Use Unified Retrieval

**What:** Simplify `/start` Part B to a single `kb_recall` call with richer parameters.

**Files to modify:** `commands/start.md`

---

## Phase 4: Aging Pipeline

### 4a. Session Summarization

**What:** Auto-summarize sessions older than 7 days into condensed form.

**Tiers:**
- **Hot (0-7 days):** Full detail in FTS5 chunks
- **Warm (7-30 days):** Summarized to key decisions/gotchas/files
- **Cold (30-90 days):** Key takeaways only
- **Expired (90+ days):** Pruned via existing `kb_prune`

**Implementation:** A periodic script (run monthly via `/start` or cron) that:
1. Finds sessions older than 7 days without summaries
2. Calls `claude --print` to summarize chunks into a condensed form
3. Stores summary in `summaries` table
4. Optionally deletes raw chunks for warm/cold sessions

### 4b. Recall Count Tracking

**What:** Track how often experiences are recalled, boost frequently-accessed knowledge.

**Implementation:** Add `recall_count` and `last_recalled` columns to `knowledge` table. Increment on each `kb_recall` hit. Use as a ranking signal.

---

## Out of Scope

- Full SQLite-as-source-of-truth migration (research says incremental improvement over rebuild)
- Graph-based retrieval (Obsidian WikiLinks already provide lightweight graph)
- LLM critique step for experience quality (deferred — structured format reduces need)
- Automated repo → installed copy sync

---

## Files Affected

| File | Phase | Changes |
|---|---|---|
| `knowledge-mcp/src/db.ts` | 1, 3, 4 | Recency weighting SQL, outcome weighting, recall tracking |
| `scripts/vault-writer.mjs` | 1, 2 | File-touch tags, quality gate, structured experience format, primary write to FTS5 |
| `commands/start.md` | 1, 3 | Remove Smart Connections, simplify to unified retrieval |
| `knowledge-mcp/src/server.ts` | 3 | New retrieval parameters |
| `scripts/vault-utils.mjs` | 2 | Updated experience rendering helpers |

---

## Success Criteria

- Zero junk sessions written to any store
- Experiences contain structured situation/action/outcome tuples
- kb_recall returns recent, relevant results over stale ones
- `/start` uses a single retrieval path (no Smart Connections)
- Aaron can inspect stored data quality via vault QC view or kb_list
